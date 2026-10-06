import { useCallback, useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { attachmentPath, IMAGE_TYPES, MAX_ATTACHMENTS, MAX_FILE_BYTES, uploadContentType } from '../lib/chatAttachments'
import type { ChatAttachment, UploadOrigin } from '../lib/chatAttachments'
import type { DroppedFile } from '../lib/chatDrop'
import type { ChatSession } from '../lib/chat'
import { useChatPresence } from '../lib/chat'

export type DraftFile = {
  id: string
  file: File
  relativePath?: string
  previewUrl?: string
  state: 'queued' | 'uploading' | 'ready' | 'error'
  progress: number
  error?: string
  attachment?: ChatAttachment
  origin?: UploadOrigin
}

async function uploadRequest(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch('/api/chat-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || 'Upload could not finish.')
  return data as { attachment: ChatAttachment }
}

async function imageDimensions(file: File, signal: AbortSignal) {
  if (!IMAGE_TYPES.includes(file.type)) return { width: null, height: null }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<{ width: number | null; height: number | null }>((resolve) => {
      const image = new Image()
      const finish = (dimensions: { width: number | null; height: number | null }) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        image.onload = image.onerror = null
        resolve(dimensions)
      }
      const abort = () => finish({ width: null, height: null })
      const timer = setTimeout(abort, 5000)
      image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = abort
      signal.addEventListener('abort', abort, { once: true })
      image.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}

export default function useChatUploads(session: ChatSession | null) {
  const [files, setFiles] = useState<DraftFile[]>([])
  const [error, setError] = useState('')
  const state = useRef<DraftFile[]>([])
  const controllers = useRef(new Map<string, AbortController>())
  const alive = useRef(true)
  const { setUploads } = useChatPresence()

  const change = useCallback((update: (current: DraftFile[]) => DraftFile[]) => {
    state.current = update(state.current)
    if (alive.current) setFiles(state.current)
  }, [])

  useEffect(() => {
    alive.current = true
    const active = controllers.current
    return () => {
      alive.current = false
      active.forEach((controller) => controller.abort())
      state.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
        // Drafts are temporary. Sent items have already been released from this list.
        void uploadRequest({ action: 'discard', id: item.id }).catch(() => {})
      })
      state.current = []
      setUploads([])
    }
  }, [setUploads])

  useEffect(() => {
    setUploads(files.filter((item) => item.state === 'queued' || item.state === 'uploading').map(({ id, file, progress }) => ({ id, name: file.name, progress })))
  }, [files, setUploads])

  useEffect(() => {
    if (!session) return
    const queued = files.filter((item) => item.state === 'queued').slice(0, Math.max(0, 2 - controllers.current.size))
    for (const item of queued) {
      if (controllers.current.has(item.id)) continue
      const controller = new AbortController()
      controllers.current.set(item.id, controller)
      change((current) => current.map((file) => file.id === item.id ? { ...file, state: 'uploading' } : file))
      void (async () => {
        try {
          const dimensions = await imageDimensions(item.file, controller.signal)
          if (controller.signal.aborted) return
          await upload(attachmentPath(session.id, item.id, item.file.name), item.file, {
            access: 'public', handleUploadUrl: '/api/chat-upload',
            contentType: uploadContentType(item.file.type),
            clientPayload: JSON.stringify({ id: item.id, name: item.file.name, size: item.file.size, type: item.file.type, relativePath: item.relativePath, ...dimensions }),
            abortSignal: controller.signal,
            multipart: item.file.size > 5 * 1024 * 1024,
            onUploadProgress: ({ percentage }) => change((current) => current.map((file) => file.id === item.id ? { ...file, progress: Math.min(100, Math.max(0, percentage)) } : file)),
          })
          // Also finalize explicitly: signed webhooks can arrive before or after us.
          const { attachment } = await uploadRequest({ action: 'complete', id: item.id }, controller.signal)
          if (controller.signal.aborted) return
          const circle = document.querySelector(`[data-upload-circle="${item.id}"]`)?.getBoundingClientRect()
          const origin = circle ? { x: circle.x, y: circle.y, size: circle.width } : undefined
          change((current) => current.map((file) => file.id === item.id ? { ...file, state: 'ready', progress: 100, attachment, origin } : file))
        } catch (reason) {
          if (!controller.signal.aborted) change((current) => current.map((file) => file.id === item.id ? { ...file, state: 'error', error: reason instanceof Error ? reason.message : 'Upload failed.' } : file))
        } finally {
          controllers.current.delete(item.id)
          if (controller.signal.aborted) void uploadRequest({ action: 'discard', id: item.id }).catch(() => {})
          // Wake queued uploads even when the preceding one was cancelled.
          if (alive.current) change((current) => [...current])
        }
      })()
    }
  }, [files, session, change])

  function add(incoming: DroppedFile[], truncated = false) {
    if (!session) { setError('Choose a username to upload files.'); return }
    let message = truncated ? `Only the first ${MAX_ATTACHMENTS} files were added. Send these before adding more.` : ''
    const next: DraftFile[] = []
    for (const { file, relativePath } of incoming) {
      if (!file.size || file.size > MAX_FILE_BYTES) { message = `${file.name}: files must be between 1 byte and 25 MB.`; continue }
      if (state.current.length + next.length >= MAX_ATTACHMENTS) { message = `Up to ${MAX_ATTACHMENTS} files per message. Send these before adding more.`; break }
      next.push({ id: crypto.randomUUID(), file, relativePath, previewUrl: IMAGE_TYPES.includes(file.type) ? URL.createObjectURL(file) : undefined, state: 'queued', progress: 0 })
    }
    change((current) => [...current, ...next])
    setError(message)
  }

  function release(ids: string[], discard = false) {
    for (const item of state.current.filter((file) => ids.includes(file.id))) {
      controllers.current.get(item.id)?.abort()
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      if (discard) void uploadRequest({ action: 'discard', id: item.id }).catch(() => setError('Could not remove the stored draft. It will not be sent.'))
    }
    change((current) => current.filter((file) => !ids.includes(file.id)))
  }

  function retry(id: string) {
    const item = state.current.find((file) => file.id === id)
    if (!item) return
    release([id], true)
    add([{ file: item.file, relativePath: item.relativePath }])
  }

  return { files, error, setError, add, release, retry, busy: files.some((file) => file.state === 'queued' || file.state === 'uploading') }
}
