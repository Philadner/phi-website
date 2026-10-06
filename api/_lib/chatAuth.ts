import type { VercelRequest } from '@vercel/node'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export function chatDatabase() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Chat is not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function chatTokenHash(req: VercelRequest) {
  const token = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('phi_chat_session='))?.slice('phi_chat_session='.length)
  return token && /^[a-f0-9]{64}$/.test(token) ? createHash('sha256').update(token).digest('hex') : null
}

export function sameOrigin(req: VercelRequest) {
  try { return !req.headers.origin || new URL(req.headers.origin).host === (req.headers['x-forwarded-host'] || req.headers.host) }
  catch { return false }
}
