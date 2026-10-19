import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { sameOrigin } from './_lib/chatAuth.js'
import { moderatePhrase, phraseDatabase } from './_lib/phrases.js'
import { hardBlockedIssues, MODERATION_LABELS, moderationNotice, PHRASE_MAX_LENGTH, phraseIssues } from '../src/lib/phraseModeration.js'

export const config = { maxDuration: 30 }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' })
  if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'Send JSON.' })
  const phrase = typeof req.body?.phrase === 'string' ? req.body.phrase.trim() : ''
  if (!phrase || phrase.length > PHRASE_MAX_LENGTH) return res.status(400).json({ error: `Enter a phrase between 1 and ${PHRASE_MAX_LENGTH} characters.` })
  try {
    const db = phraseDatabase()
    const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for']
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
    const clientHash = createHash('sha256').update(`${process.env.SUPABASE_SERVICE_ROLE_KEY}:${ip}`).digest('hex')
    const { data: allowed, error: rateError } = await db.rpc('claim_phrase_submission', { client_hash: clientHash })
    if (rateError) throw new Error('Submission limit could not be checked.')
    if (!allowed) { res.setHeader('Retry-After', '300'); return res.status(429).json({ error: 'Too many submissions. Try again in five minutes.' }) }
    const hatefulness = await moderatePhrase(phrase)
    const blocked = hardBlockedIssues(hatefulness)
    if (blocked.length) return res.status(422).json({ ok: false, error: `This phrase cannot be added because it contains ${blocked.map(issue => MODERATION_LABELS[issue]).join(', ')}.`, issues: blocked })
    const { error } = await db.from('phrases').insert({ text: phrase, hatefulness })
    if (error?.code === '23505') return res.status(409).json({ error: 'That phrase is already on the list.' })
    if (error) throw new Error('The phrase could not be saved.')
    const issues = phraseIssues(hatefulness)
    return res.status(201).json({ ok: true, hiddenByDefault: issues.length > 0, issues, notice: moderationNotice(issues) })
  } catch {
    return res.status(503).json({ error: 'Your phrase was not added because moderation or storage is unavailable. Please try again later.' })
  }
}
