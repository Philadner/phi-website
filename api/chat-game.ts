import type { VercelRequest, VercelResponse } from '@vercel/node'
import { WORDLE_DICTIONARY } from './_lib/wordleDictionary.js'
import { chatDatabase, chatTokenHash, sameOrigin } from './_lib/chatAuth.js'
import { applyMove, createGame, gameView, playerView } from './_lib/chatGames.js'
import type { GameState } from './_lib/chatGames.js'
import { CHAT_GAMES, gameKind } from '../src/lib/chatGames.js'
import { UUID } from '../src/lib/chatAttachments.js'

function validWord(word: string) { return WORDLE_DICTIONARY.has(word) }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' })
  if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'Send JSON.' })
  try {
    const db = chatDatabase()
    const token = chatTokenHash(req)
    const { data: session, error: sessionError } = token ? await db.from('chat_sessions').select('id,username,cleared_through').eq('token_hash', token).gt('expires_at', new Date().toISOString()).maybeSingle() : { data: null, error: null }
    if (sessionError) throw sessionError
    const actor = session ? { id: session.id, name: session.username } : null
    if (req.method === 'POST' && !actor) return res.status(401).json({ error: 'Choose a username first.' })
    if (req.method === 'POST' && req.body?.action === 'create') {
      const kind = typeof req.body.kind === 'string' ? gameKind(req.body.kind) : null
      if (!kind || !UUID.test(req.body.clientId || '')) return res.status(400).json({ error: 'Choose a valid game.' })
      const state = createGame(kind, actor!)
      const { data, error } = await db.rpc('create_chat_game', { p_token_hash: token, p_client_id: req.body.clientId, p_state: state, p_view: gameView(state), p_title: CHAT_GAMES.find(g => g.id === kind)!.title })
      if (error) throw error
      const { data: stored, error: storedError } = await db.from('chat_game_secrets').select('state').eq('id', data.id).single()
      if (storedError) throw storedError
      return res.status(200).json({ ...playerView(stored.state as GameState, actor!.id), message: data.message })
    }
    const id = req.method === 'GET' ? req.query.id : req.body?.id
    if (typeof id !== 'string' || !UUID.test(id)) return res.status(400).json({ error: 'Invalid game ID.' })
    const [{ data: row, error: rowError }, { data: room, error: roomError }] = await Promise.all([
      db.from('chat_games').select('message_id,version').eq('id', id).maybeSingle(),
      db.from('chat_room_state').select('cleared_through').eq('id', 1).single(),
    ])
    if (rowError || roomError) throw rowError || roomError
    if (!row || row.message_id <= Math.max(room.cleared_through, session?.cleared_through || 0)) return res.status(404).json({ error: 'This game is no longer visible.' })
    const { data: secret, error: secretError } = await db.from('chat_game_secrets').select('state').eq('id', id).single()
    if (secretError) throw secretError
    let state = secret.state as GameState
    if (state.kind === 'wordle' && state.status === 'active' && Date.now() - state.startedAt >= 600000) {
      const { data: expired, error: expireError } = await db.rpc('expire_chat_game', { p_id: id })
      if (expireError) throw expireError
      state = expired as GameState
    }
    if (req.method === 'GET') return res.status(200).json(playerView(state, actor?.id))
    if (req.body.action !== 'play' || !Number.isInteger(req.body.version) || !req.body.move || typeof req.body.move !== 'object' || Array.isArray(req.body.move)) return res.status(400).json({ error: 'Invalid move.' })
    if (req.body.version !== state.version) return res.status(409).json({ error: 'The game changed. Try your move again.' })
    let next: GameState
    try { next = applyMove(state, actor!, req.body.move, validWord) }
    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid move.' }) }
    const { data: saved, error: saveError } = await db.rpc('save_chat_game', { p_token_hash: token, p_id: id, p_version: state.version, p_state: next, p_view: gameView(next) })
    if (saveError) throw saveError
    if (!saved) return res.status(409).json({ error: 'Someone moved at the same time. Try again.' })
    return res.status(200).json(playerView(next, actor!.id))
  } catch (error) {
    const fault = error as { code?: string; message?: string }
    if (['28000', '22023', 'P0001'].includes(fault.code || '')) return res.status(fault.code === '28000' ? 401 : fault.code === 'P0001' ? 429 : 400).json({ error: fault.message })
    console.error('Chat game failed', fault.code || 'unavailable')
    return res.status(503).json({ error: 'Games are temporarily unavailable. Try again.' })
  }
}
