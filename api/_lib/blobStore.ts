import { del, put } from "@vercel/blob"

export function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export async function putAudioBlob(
  trackId: string,
  extension: string,
  body: Buffer,
  contentType: string
) {
  return put(`audio/${trackId}${extension}`, body, {
    access: "public",
    addRandomSuffix: false,
    contentType,
  })
}

export async function deleteBlobUrl(url: string) {
  await del(url)
}
