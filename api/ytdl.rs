use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue};
use rusty_ytdl::{choose_format, Video, VideoOptions};
use serde::Deserialize;
use serde_json::{json, Value};
use url::form_urlencoded;
use vercel_runtime::{run, service_fn, Error, Request, Response};

fn json_response(status: u16, payload: Value) -> Result<Response<Value>, Error> {
    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .header("Cache-Control", "no-store")
        .body(payload)?)
}

#[derive(Deserialize)]
struct BlobPutResponse {
    url: String,
    #[serde(rename = "downloadUrl")]
    download_url: String,
    pathname: String,
    #[serde(rename = "contentType")]
    content_type: Option<String>,
}

fn query_value(req: &Request, key: &str) -> Option<String> {
    req.uri().query().and_then(|query| {
        form_urlencoded::parse(query.as_bytes()).find_map(|(candidate_key, candidate_value)| {
            if candidate_key == key {
                Some(candidate_value.into_owned())
            } else {
                None
            }
        })
    })
}

fn extract_secret(req: &Request) -> String {
    let query_secret = query_value(req, "secret")
        .map(|value| value.trim().to_string())
        .unwrap_or_default();

    if !query_secret.is_empty() {
        return query_secret;
    }

    req.headers()
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim())
        .and_then(|value| {
            value
                .strip_prefix("Bearer ")
                .or_else(|| value.strip_prefix("bearer "))
        })
        .map(|value| value.trim().to_string())
        .unwrap_or_default()
}

fn extract_input(req: &Request) -> String {
    for key in ["url", "arg", "q", "query"] {
        if let Some(value) = query_value(req, key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    String::new()
}

fn make_blob_path(video_id: &str, extension: &str) -> String {
    format!("audio/{video_id}.{extension}")
}

async fn collect_stream_bytes(video: &Video) -> Result<Vec<u8>, rusty_ytdl::VideoError> {
    let stream = video.stream().await?;
    let mut body = Vec::with_capacity(stream.content_length());

    while let Some(chunk) = stream.chunk().await? {
        body.extend_from_slice(&chunk);
    }

    Ok(body)
}

async fn upload_to_blob(
    pathname: &str,
    content_type: &str,
    body: Vec<u8>,
) -> Result<BlobPutResponse, Error> {
    let token = std::env::var("BLOB_READ_WRITE_TOKEN").map_err(|_| "BLOB_READ_WRITE_TOKEN missing")?;

    let url = format!(
        "https://vercel.com/api/blob/?pathname={}",
        url::form_urlencoded::byte_serialize(pathname.as_bytes()).collect::<String>()
    );

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {token}"))?,
    );
    headers.insert("x-vercel-blob-access", HeaderValue::from_static("public"));
    headers.insert("x-add-random-suffix", HeaderValue::from_static("0"));
    headers.insert("x-allow-overwrite", HeaderValue::from_static("1"));
    headers.insert("x-content-type", HeaderValue::from_str(content_type)?);

    let client = reqwest::Client::new();
    let response = client
        .put(url)
        .headers(headers)
        .body(body)
        .send()
        .await?
        .error_for_status()?;

    Ok(response.json::<BlobPutResponse>().await?)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let service = service_fn(handler);
    run(service).await
}

async fn handler(req: Request) -> Result<Response<Value>, Error> {
    if req.method().as_str() != "GET" {
        return json_response(405, json!({ "error": "Method not allowed" }));
    }

    let configured_secret = match std::env::var("YTDL_SECRET") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return json_response(500, json!({ "error": "YTDL_SECRET missing" })),
    };

    if extract_secret(&req) != configured_secret.trim() {
        return json_response(401, json!({ "error": "Unauthorised" }));
    }

    let input = extract_input(&req);
    if input.is_empty() {
        return json_response(
            400,
            json!({
                "error": "One input argument is required via url, arg, q, or query"
            }),
        );
    }

    let video_options = VideoOptions::default();

    let video = match Video::new_with_options(input.clone(), video_options.clone()) {
        Ok(video) => video,
        Err(error) => {
            return json_response(
                400,
                json!({
                    "error": "Invalid YouTube input",
                    "message": error.to_string(),
                }),
            )
        }
    };

    let video_id = video.get_video_id();
    let video_url = video.get_video_url();

    match video.get_info().await {
        Ok(info) => {
            let selected_format = match choose_format(&info.formats, &video_options) {
                Ok(format) => format,
                Err(error) => {
                    return json_response(
                        502,
                        json!({
                            "error": "No downloadable format found",
                            "message": error.to_string(),
                            "videoId": video_id,
                            "videoUrl": video_url,
                        }),
                    )
                }
            };

            let content_type = format!(
                "{}/{}",
                selected_format.mime_type.mime.type_(),
                selected_format.mime_type.mime.subtype()
            );
            let extension = selected_format.mime_type.container.clone();
            let blob_path = make_blob_path(&video_id, &extension);

            let body = match collect_stream_bytes(&video).await {
                Ok(body) => body,
                Err(error) => {
                    return json_response(
                        502,
                        json!({
                            "error": "rusty_ytdl download failed",
                            "message": error.to_string(),
                            "videoId": video_id,
                            "videoUrl": video_url,
                        }),
                    )
                }
            };

            let blob = match upload_to_blob(&blob_path, &content_type, body).await {
                Ok(blob) => blob,
                Err(error) => {
                    return json_response(
                        502,
                        json!({
                            "error": "Blob upload failed",
                            "message": error.to_string(),
                            "videoId": video_id,
                            "videoUrl": video_url,
                            "pathname": blob_path,
                        }),
                    )
                }
            };

            json_response(
                200,
                json!({
                    "ok": true,
                    "runtime": "rust",
                    "input": input,
                    "videoId": video_id,
                    "videoUrl": video_url,
                    "info": info,
                    "blob": {
                        "url": blob.url,
                        "downloadUrl": blob.download_url,
                        "pathname": blob.pathname,
                        "contentType": blob.content_type.unwrap_or(content_type),
                    },
                }),
            )
        }
        Err(error) => json_response(
            502,
            json!({
                "error": "rusty_ytdl lookup failed",
                "message": error.to_string(),
                "videoId": video_id,
                "videoUrl": video_url,
            }),
        ),
    }
}
