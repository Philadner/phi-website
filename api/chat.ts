import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { MAX_ATTACHMENTS, UUID } from '../src/lib/chatAttachments.js'
import { mentionsAi, mentionNames, parseChatCommand } from '../src/lib/chatFeatures.js'
import { gifReference } from '../src/lib/chatGifs.js'

const COOKIE = 'phi_chat_session'
const MAX_AGE = 30 * 24 * 60 * 60

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return res.status(503).json({ error: 'Chat is not configured yet.' })
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  const token = cookie && /^[a-f0-9]{64}$/.test(cookie) ? cookie : null
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')

  try {
    if (req.method === 'GET') {
      if (req.query.action === 'session') {
        if (!token) return res.status(200).json({ session: null })
        const { data, error } = await db.from('chat_sessions').select('id,username,cleared_through').eq('token_hash', hash(token)).gt('expires_at', new Date().toISOString()).maybeSingle()
        if (error) throw error
        return res.status(200).json({ session: data })
      }
      const before = req.query.before
      const after = req.query.after
      if ((before && (typeof before !== 'string' || !/^\d{1,16}$/.test(before))) ||
          (after && (typeof after !== 'string' || !/^\d{1,16}$/.test(after))) || (before && after)) {
        return res.status(400).json({ error: 'Invalid message cursor.' })
      }
      const { data: room, error: roomError } = await db.from('chat_room_state').select('cleared_through').eq('id', 1).single()
      if (roomError) throw roomError
      let floor = room.cleared_through
      if (token) {
        const { data: session, error: sessionError } = await db.from('chat_sessions').select('cleared_through').eq('token_hash', hash(token)).gt('expires_at', new Date().toISOString()).maybeSingle()
        if (sessionError) throw sessionError
        floor = Math.max(floor, session?.cleared_through || 0)
      }
      if (req.query.messageId) {
        if (typeof req.query.messageId !== 'string' || !/^\d{1,16}$/.test(req.query.messageId)) return res.status(400).json({ error: 'Invalid message ID.' })
        const { data, error } = await db.from('chat_messages').select('*').eq('id', req.query.messageId).gt('id', floor).maybeSingle()
        if (error) throw error
        return res.status(200).json({ message: data })
      }
      let query = db.from('chat_messages').select('*').gt('id', floor).order('id', { ascending: Boolean(after) }).limit(100)
      if (before) query = query.lt('id', before)
      if (after) query = query.gt('id', after)
      const { data, error } = await query
      if (error) throw error
      return res.status(200).json({ messages: after ? data : data.reverse(), hasMore: data.length === 100, clearedThrough: floor })
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      return res.status(405).json({ error: 'Method not allowed.' })
    }
    // Cookie-authenticated writes must originate from this site (also allows local dev).
    const origin = req.headers.origin
    const host = req.headers['x-forwarded-host'] || req.headers.host
    if (origin && new URL(origin).host !== host) return res.status(403).json({ error: 'Invalid request origin.' })
    if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'Send JSON.' })
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Invalid request.' })

    if (body.action === 'join') {
      const username = typeof body.username === 'string' ? body.username.trim() : ''
      if (!/^[A-Za-z0-9_ -]{2,24}$/.test(username)) {
        return res.status(400).json({ error: 'Use 2–24 letters, numbers, spaces, underscores or hyphens.' })
      }
      if (/^(system|admin|moderator)$/i.test(username)) return res.status(400).json({ error: 'That username is reserved.' })
      const nextToken = token || randomBytes(32).toString('hex')
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
      const ipHash = createHmac('sha256', key).update(ip).digest('hex')
      const { data, error } = await db.rpc('join_chat', { p_token_hash: hash(nextToken), p_username: username, p_ip_hash: ipHash })
      if (error?.code === '23505') return res.status(409).json({ error: 'That username is taken. Try another.' })
      if (error?.code === 'P0001') return res.status(429).json({ error: error.message })
      if (error) throw error
      const session = data[0]
      // The credential never goes into localStorage, message rows, or presence.
      const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL === '1'
      const remaining = Math.max(0, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000))
      res.setHeader('Set-Cookie', `${COOKIE}=${nextToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.min(MAX_AGE, remaining)}${secure ? '; Secure' : ''}`)
      return res.status(200).json({ session: { id: session.id, username: session.username } })
    }

    if (body.action === 'send') {
      if (!token) return res.status(401).json({ error: 'Choose a username to join.' })
      const raw = typeof body.text === 'string' ? body.text : typeof body.content === 'string' ? body.content : ''
      const command = parseChatCommand(raw)
      if (!['message', 'action', 'ai'].includes(command.kind)) return res.status(400).json({ error: 'Invalid command. Use /help to open the stuff menu.' })
      const gif = body.gif == null ? null : gifReference(body.gif)
      if (body.gif != null && !gif) return res.status(400).json({ error: 'Invalid GIF.' })
      const content = command.content || (gif ? 'GIF' : '')
      const attachmentIds = body.attachmentIds ?? []
      if (!Array.isArray(attachmentIds) || attachmentIds.length > MAX_ATTACHMENTS || attachmentIds.some((id) => typeof id !== 'string' || !UUID.test(id)) || new Set(attachmentIds).size !== attachmentIds.length) return res.status(400).json({ error: 'Invalid attachments.' })
      if ((!content && !attachmentIds.length) || content.length > 8000) return res.status(400).json({ error: 'Add a message or a file (up to 8,000 characters).' })
      if (typeof body.clientId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.clientId)) {
        return res.status(400).json({ error: 'Invalid message ID.' })
      }
      const kind = command.kind === 'action' ? 'action' : body.kind ?? 'message'
      if (kind !== 'message' && kind !== 'action') return res.status(400).json({ error: 'Invalid message type.' })
      const replyTo = body.replyTo ?? null
      if (replyTo !== null && (!Number.isSafeInteger(replyTo) || replyTo < 1)) return res.status(400).json({ error: 'Invalid reply.' })
      const [{ data: room, error: roomError }, { data: people, error: peopleError }] = await Promise.all([
        db.from('chat_room_state').select('ai_name').eq('id', 1).single(),
        db.from('chat_sessions').select('id,username').gt('expires_at', new Date().toISOString()).limit(500),
      ])
      if (roomError || peopleError) throw roomError || peopleError
      const names = mentionNames(content)
      const mentionedIds = (people || []).filter((person) => names.includes(person.username.toLowerCase())).map((person) => person.id)
      let invokesAi = command.kind === 'ai' || mentionsAi(content, room.ai_name)
      if (replyTo !== null) {
        const { data: parent, error: parentError } = await db.from('chat_messages').select('is_ai').eq('id', replyTo).maybeSingle()
        if (parentError) throw parentError
        if (parent?.is_ai) invokesAi = true
      }
      const { data, error } = await db.rpc('send_chat_message', { p_token_hash: hash(token), p_client_id: body.clientId, p_content: content, p_kind: kind, p_attachment_ids: attachmentIds, p_reply_to: replyTo, p_mentioned_ids: mentionedIds, p_invokes_ai: invokesAi, p_gif: gif })
      if (error?.code === '28000') return res.status(401).json({ error: error.message })
      if (error?.code === 'P0001') return res.status(429).json({ error: error.message })
      if (error?.code === '22023') return res.status(400).json({ error: error.message })
      if (error) throw error
      return res.status(200).json({ message: data[0] })
    }
    return res.status(400).json({ error: 'Unknown chat action.' })
  } catch (error) {
    console.error('Chat request failed', error instanceof Error ? error.message : (error as { code?: string }).code)
    return res.status(503).json({ error: 'Chat is temporarily unavailable. Try again shortly.' })
  }
}
