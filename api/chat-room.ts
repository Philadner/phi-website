import type { VercelRequest, VercelResponse } from '@vercel/node'
import { chatDatabase, chatTokenHash, sameOrigin } from './_lib/chatAuth.js'
import { UUID } from '../src/lib/chatAttachments.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' })
  if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'Send JSON.' })
  try {
    const db = chatDatabase()
    const tokenHash = chatTokenHash(req)
    const action = req.method === 'GET' ? 'state' : req.body?.action
    if (!['state', 'clear', 'start_vote', 'vote', 'force'].includes(action)) return res.status(400).json({ error: 'Invalid command.' })
    if (action === 'vote' && (typeof req.body?.voteId !== 'string' || !UUID.test(req.body.voteId) || typeof req.body.yes !== 'boolean')) return res.status(400).json({ error: 'Invalid vote.' })
    if (action === 'force' && req.body?.command !== '/badabingbadaboomforceclear') return res.status(400).json({ error: 'Invalid command.' })
    const { data, error } = await db.rpc('chat_room_action', { p_token_hash: tokenHash || '', p_action: action, p_vote_id: action === 'vote' ? req.body.voteId : null, p_yes: action === 'vote' ? req.body.yes : null })
    if (error?.code === '23505') return res.status(409).json({ error: 'That username is currently in use. Choose another.', code: 'username_taken' })
    if (error) return res.status(error.code === '28000' ? 401 : error.code === 'P0001' ? 429 : 400).json({ error: ['28000', 'P0001', '22023'].includes(error.code) ? error.message : 'Room action could not finish.' })
    let requests: unknown[] = []
    if (tokenHash) {
      const { data: session, error: sessionError } = await db.from('chat_sessions').select('id').eq('token_hash', tokenHash).gt('expires_at', new Date().toISOString()).maybeSingle()
      if (sessionError) throw sessionError
      if (session) {
        // The endpoint's max duration is 120s. Recover a worker lost beyond that.
        const { error: recoverError } = await db.from('chat_ai_requests').update({ status: 'error', error: 'AI timed out. You can retry.' }).eq('author_id', session.id).eq('status', 'processing').lt('started_at', new Date(Date.now() - 180000).toISOString())
        if (recoverError) throw recoverError
        const { data: pending, error: pendingError } = await db.from('chat_ai_requests').select('id,trigger_id,status,error').eq('author_id', session.id).gt('trigger_id', data.room.cleared_through).in('status', ['queued', 'processing', 'awaiting_context', 'error']).order('created_at', { ascending: false }).limit(10)
        if (pendingError) throw pendingError
        requests = pending || []
      }
    }
    return res.status(200).json({ ...data, requests })
  } catch {
    return res.status(503).json({ error: 'Could not reach the room. Try again shortly.' })
  }
}
