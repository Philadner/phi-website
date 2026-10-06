export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const MAX_ATTACHMENTS = 20
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']

export type ChatAttachment = {
  id: string
  name: string
  relativePath: string | null
  size: number
  contentType: string
  url: string
  downloadUrl: string
  width: number | null
  height: number | null
}
export type UploadProgress = { id: string; name: string; progress: number }
export type UploadOrigin = { x: number; y: number; size: number }

export function uploadContentType(type: string) {
  return IMAGE_TYPES.includes(type) ? type : 'application/octet-stream'
}

export function attachmentPath(author: string, id: string, name: string) {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file'
  return `chat/v2/${author}/${id}/${safe}`
}

export function fileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}
