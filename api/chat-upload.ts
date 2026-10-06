import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleUpload } from '@vercel/blob/client'
import type { HandleUploadBody } from '@vercel/blob/client'
import { del, head } from '@vercel/blob'
import { chatDatabase, chatTokenHash, sameOrigin } from './_lib/chatAuth.js'
import { attachmentPath, MAX_FILE_BYTES, uploadContentType, UUID } from '../src/lib/chatAttachments.js'

class UploadError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

const hasControlCharacters = (value: string) => [...value].some((character) => character.charCodeAt(0) < 32)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
  if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'Send JSON.' })
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' })
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid request.' })

  try {
    const db = chatDatabase()
    if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) return res.status(503).json({ error: 'File storage is not configured.' })
    async function session() {
      const tokenHash = chatTokenHash(req)
      if (!tokenHash) throw new UploadError('Choose a username to upload files.', 401)
      const { data, error } = await db.from('chat_sessions').select('id').eq('token_hash', tokenHash).gt('expires_at', new Date().toISOString()).maybeSingle()
      if (error) throw error
      if (!data) throw new UploadError('Choose a username to join again.', 401)
      return { id: data.id as string, tokenHash }
    }

    async function complete(id: string, author?: string) {
      const { data: row, error } = await db.from('chat_attachments').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      if (!row || (author && row.author_id !== author)) throw new UploadError('Attachment not found.', 404)
      if (row.status === 'discarded') {
        await del(row.pathname)
        throw new UploadError('This attachment was removed.', 410)
      }
      if (row.status === 'uploading') {
        // Verify the exact reserved path in our store; never accept a URL from the client.
        const blob = await head(row.pathname)
        if (blob.pathname !== row.pathname || blob.size !== row.size || blob.contentType !== row.content_type) {
          await db.from('chat_attachments').update({ status: 'discarded' }).eq('id', id).is('message_id', null)
          await del(row.pathname)
          throw new UploadError('The uploaded file did not match its details.')
        }
        const { error: updateError } = await db.from('chat_attachments').update({ status: 'ready', url: blob.url, download_url: blob.downloadUrl }).eq('id', id).eq('status', 'uploading')
        if (updateError) throw updateError
      }
      const { data: ready, error: readError } = await db.from('chat_attachments').select('*').eq('id', id).eq('status', 'ready').maybeSingle()
      if (readError) throw readError
      if (!ready) { await del(row.pathname); throw new UploadError('This attachment was removed.', 410) }
      return { id: ready.id, name: ready.name, relativePath: ready.relative_path, size: ready.size, contentType: ready.content_type, url: ready.url, downloadUrl: ready.download_url, width: ready.width, height: ready.height }
    }

    if (req.body.action === 'complete' || req.body.action === 'discard') {
      const owner = await session()
      const id = req.body.id
      if (typeof id !== 'string' || !UUID.test(id)) throw new UploadError('Invalid file ID.')
      if (req.body.action === 'complete') return res.status(200).json({ attachment: await complete(id, owner.id) })
      const { data, error } = await db.from('chat_attachments').update({ status: 'discarded' }).eq('id', id).eq('author_id', owner.id).is('message_id', null).select('pathname')
      if (error) throw error
      if (data?.length) await del(data[0].pathname)
      return res.status(200).json({ ok: true })
    }

    if (!['blob.generate-client-token', 'blob.upload-completed'].includes(req.body.type)) throw new UploadError('Unknown upload action.')
    const result = await handleUpload({
      request: req,
      body: req.body as HandleUploadBody,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const owner = await session()
        let payload
        try { payload = JSON.parse(clientPayload || '') } catch { throw new UploadError('Invalid file details.') }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new UploadError('Invalid file details.')
        const { id, name, size, type, relativePath, width, height } = payload
        if (typeof id !== 'string' || !UUID.test(id) || typeof name !== 'string' || !name.length || name.length > 255 || hasControlCharacters(name) || /[/\\]/.test(name)) throw new UploadError('Invalid file name or ID.')
        if (!Number.isInteger(size) || size < 1 || size > MAX_FILE_BYTES) throw new UploadError('Files must be between 1 byte and 25 MB.')
        if (typeof type !== 'string' || type.length > 100) throw new UploadError('Invalid file type.')
        if (relativePath != null && (typeof relativePath !== 'string' || relativePath.length > 1024 || hasControlCharacters(relativePath) || relativePath.includes('\\') || relativePath.split('/').some((part: string) => part === '..' || part === '.'))) throw new UploadError('Invalid folder path.')
        for (const dimension of [width, height]) if (dimension != null && (!Number.isInteger(dimension) || dimension < 1 || dimension > 100000)) throw new UploadError('Invalid image dimensions.')
        if (pathname !== attachmentPath(owner.id, id, name)) throw new UploadError('Invalid upload path.')
        const contentType = uploadContentType(type)
        const { error } = await db.rpc('reserve_chat_upload', { p_token_hash: owner.tokenHash, p_id: id, p_name: name, p_relative_path: relativePath || null, p_size: size, p_content_type: contentType, p_pathname: pathname, p_width: width || null, p_height: height || null })
        if (error) throw new UploadError(error.code === 'P0001' || error.code === '28000' || error.code === '22023' ? error.message : 'Could not reserve this upload.', error.code === 'P0001' ? 429 : error.code === '28000' ? 401 : 400)
        return { allowedContentTypes: [contentType], maximumSizeInBytes: size, validUntil: Date.now() + 10 * 60 * 1000, addRandomSuffix: false, allowOverwrite: false, tokenPayload: JSON.stringify({ id }) }
      },
      onUploadCompleted: async ({ tokenPayload }) => {
        const payload = JSON.parse(tokenPayload || '{}')
        if (typeof payload.id !== 'string' || !UUID.test(payload.id)) throw new UploadError('Invalid upload callback.')
        try { await complete(payload.id) } catch (reason) {
          if (!(reason instanceof UploadError && reason.status === 410)) throw reason
        }
      },
    })
    return res.status(200).json(result)
  } catch (reason) {
    if (reason instanceof UploadError) return res.status(reason.status).json({ error: reason.message })
    console.error('Chat upload failed', reason instanceof Error ? reason.message : 'Storage request failed')
    return res.status(503).json({ error: 'Upload could not finish. Try again shortly.' })
  }
}
