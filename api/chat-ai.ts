import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { chatDatabase, chatTokenHash, sameOrigin } from './_lib/chatAuth.js'
import { AI_MODEL, AI_PROMPT, AI_SCHEMA, aiMessageInput, parseAiOutput } from './_lib/chatAi.js'
import { mentionNames } from '../src/lib/chatFeatures.js'
import type { ChatMessage } from '../src/lib/chat.js'

export const config = { maxDuration: 120 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' })
  if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'Send JSON.' })
  const hash = chatTokenHash(req)
  if (!hash) return res.status(401).json({ error: 'Choose a username to invoke AI.' })
  const id = req.body?.messageId
  const count = req.body?.contextCount
  if (!Number.isSafeInteger(id) || id < 1 || (count != null && count !== 5 && count !== 20) || (req.body?.withImages != null && typeof req.body.withImages !== 'boolean') || (req.body?.decline != null && typeof req.body.decline !== 'boolean')) return res.status(400).json({ error: 'Invalid AI request.' })
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return res.status(503).json({ error: 'AI is not configured.' })
  const db = chatDatabase()
  const lease = randomUUID()
  let requestId: string | undefined
  try {
    const { data: claimed, error } = await db.rpc('claim_chat_ai', { p_token_hash: hash, p_trigger_id: id, p_context_count: count ?? null, p_with_images: req.body.withImages === true, p_decline: req.body.decline === true, p_lease: lease })
    if (error) return res.status(error.code === '28000' ? 401 : error.code === 'P0001' ? 429 : 400).json({ error: ['28000', '22023', 'P0001'].includes(error.code) ? error.message : 'AI request could not start.' })
    const job = claimed?.[0]
    if (!job) return res.status(404).json({ error: 'AI request not found.' })
    if (job.lease !== lease || job.status !== 'processing') return res.status(200).json({ status: job.status })
    requestId = job.id
    const [{ data: room, error: roomError }, { data: trigger, error: triggerError }] = await Promise.all([
      db.from('chat_room_state').select('cleared_through,ai_name').eq('id', 1).single(),
      db.from('chat_messages').select('*').eq('id', id).single(),
    ])
    if (roomError || triggerError) throw new Error('The invoking message could not load.')
    if (id <= room.cleared_through) return res.status(200).json({ status: 'declined' })
    const { data: memory, error: memoryError } = await db.from('chat_messages').select('*').gt('id', room.cleared_through).lt('id', id).or('is_ai.eq.true,invokes_ai.eq.true').order('id', { ascending: false }).limit(99)
    if (memoryError) throw new Error('AI memory could not load.')
    const input: { role: 'user' | 'assistant'; content: unknown }[] = (memory || []).reverse().map((message) => ({ role: message.is_ai ? 'assistant' : 'user', content: message.is_ai ? JSON.stringify({ username: message.username, Message: message.content }) : aiMessageInput(message as ChatMessage, false) }))
    if (job.phase === 1) {
      const { data: context, error: contextError } = await db.from('chat_messages').select('*').gt('id', room.cleared_through).lt('id', id).order('id', { ascending: false }).limit(job.context_count)
      if (contextError) throw new Error('Granted chat context could not load.')
      // Images only enter this input when this invocation's owner checked the box.
      input.push({ role: 'user', content: [{ type: 'input_text', text: `One-time approved room context: last ${job.context_count} messages before this invocation. Images ${job.with_images ? 'included' : 'excluded'}. Do not request more context.` }, ...(context || []).reverse().flatMap((message) => aiMessageInput(message as ChatMessage, job.with_images))] })
    }
    input.push({ role: 'user', content: [{ type: 'input_text', text: `CURRENT invocation from ${trigger.username}. Your current display name is ${room.ai_name}. ${job.phase === 1 ? 'Context has been granted for this invocation.' : 'No room history has been granted for this invocation.'}` }, ...aiMessageInput(trigger as ChatMessage, true)] })
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(85000),
      body: JSON.stringify({ model: AI_MODEL, store: false, reasoning: { effort: 'low' }, max_output_tokens: 3000, max_tool_calls: 3, instructions: AI_PROMPT, input, tools: [{ type: 'web_search' }], text: { format: { type: 'json_schema', name: 'phi_chat_reply', strict: true, schema: AI_SCHEMA } } }),
    })
    const payload = await response.json()
    if (!response.ok) {
      console.error('Chat AI provider error', response.status, payload.error?.code)
      const message = payload.error?.code === 'credit_balance_exhausted' || payload.error?.code === 'insufficient_quota'
        ? 'OpenAI API credit is exhausted. Add API credit to enable AI replies.'
        : response.status === 429 ? 'OpenAI is rate limited. Try again shortly.' : 'AI could not reply. Try again shortly.'
      await db.from('chat_ai_requests').update({ status: 'error', error: message }).eq('id', job.id).eq('lease', lease).eq('status', 'processing')
      return res.status(response.status === 429 ? 429 : 422).json({ error: message })
    }
    const result = parseAiOutput(payload)
    const { data: people, error: peopleError } = await db.from('chat_sessions').select('id,username').gt('expires_at', new Date().toISOString()).limit(500)
    if (peopleError) throw new Error('Mentions could not load.')
    const names = mentionNames(result.Message)
    const mentions = (people || []).filter((person) => names.includes(person.username.toLowerCase())).map((person) => person.id)
    const { data: messages, error: finishError } = await db.rpc('finish_chat_ai', { p_request_id: job.id, p_phase: job.phase, p_attempt: job.attempts, p_message: result.Message, p_request_context: result.modifiers.request_context, p_name: result.modifiers.name, p_mentions: mentions })
    if (finishError) throw new Error('AI reply could not be saved. Try again.')
    return res.status(200).json({ messages: messages || [], status: messages?.length ? job.phase === 0 && result.modifiers.request_context ? 'awaiting_context' : 'done' : 'declined' })
  } catch (reason) {
    const message = reason instanceof Error && reason.name !== 'TimeoutError' ? reason.message : 'AI timed out. You can retry.'
    if (requestId) await db.from('chat_ai_requests').update({ status: 'error', error: message }).eq('id', requestId).eq('lease', lease).eq('status', 'processing')
    return res.status(502).json({ error: message })
  }
}
