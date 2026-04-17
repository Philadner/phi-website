import { del, put } from "@vercel/blob"

export function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export async function putAudioBlob(trackId: string, body: Buffer) {
  return put(`audio/${trackId}.mp3`, body, {
    access: "public",
    addRandomSuffix: false,
    contentType: "audio/mpeg",
  })
}

export async function deleteBlobUrl(url: string) {
  await del(url)
}
