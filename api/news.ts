import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { sameOrigin } from './_lib/chatAuth.js'
import { moderatePhrase, phraseDatabase } from './_lib/phrases.js'
import { classifySchoolSafety } from './_lib/schoolSafety.js'
import { DEFAULT_PHRASE_PREFERENCES, hardBlockedIssues, moderationNotice, phraseIssues } from '../src/lib/phraseModeration.js'
import { newsReviewed, newsReviewText, newsVisible, parseNewsInput } from '../src/lib/newsModeration.js'
import type { NewsArticle } from '../src/lib/newsModeration.js'

export const config = { maxDuration: 60 }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
  if (req.method === 'GET') {
    if (req.query.includeFiltered !== undefined && req.query.includeFiltered !== '1') return res.status(400).json({ error: 'Invalid filter option.' })
    try {
      const db = phraseDatabase()
      const articles: NewsArticle[] = []
      let after = ''
      for (;;) {
        let query = db.from('news_articles').select('id,title,content,author,createdAt,hatefulness,school_safety').order('id').limit(1000)
        if (after) query = query.gt('id', after)
        const { data, error } = await query
        if (error) throw error
        for (const row of data) {
          if (req.query.includeFiltered === '1' ? newsReviewed(row) : newsVisible(row, DEFAULT_PHRASE_PREFERENCES)) articles.push(row)
        }
        if (data.length < 1000) break
        after = data[data.length - 1].id
      }
      return res.status(200).json(articles)
    } catch { return res.status(503).json({ error: 'News is temporarily unavailable.' }) }
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' })
  if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'Send JSON.' })
  const article = parseNewsInput(req.body)
  if (!article) return res.status(400).json({ error: 'Enter a title (1–120 characters), article (1–10,000 characters), and optional author (up to 60 characters).' })
  try {
    const db = phraseDatabase()
    const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for']
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
    const clientHash = createHash('sha256').update(`${process.env.SUPABASE_SERVICE_ROLE_KEY}:news:${ip}`).digest('hex')
    const { data: allowed, error: rateError } = await db.rpc('claim_phrase_submission', { client_hash: clientHash })
    if (rateError) throw rateError
    if (!allowed) { res.setHeader('Retry-After', '300'); return res.status(429).json({ error: 'Too many submissions. Try again in five minutes.' }) }
    const text = newsReviewText(article)
    const hatefulness = await moderatePhrase(text)
    const blocked = hardBlockedIssues(hatefulness)
    if (blocked.length) return res.status(422).json({ error: 'This article cannot be posted because it contains prohibited content.', issues: blocked })
    const issues = phraseIssues(hatefulness)
    const school_safety = issues.length ? null : await classifySchoolSafety(text)
    const { error } = await db.from('news_articles').insert({ ...article, hatefulness, school_safety })
    if (error) throw error
    const offensive = school_safety?.school_safe === false
    const notice = offensive ? `Your article will be hidden by default because: ${school_safety.reason}` : moderationNotice(issues)
    return res.status(201).json({ ok: true, hiddenByDefault: issues.length > 0 || offensive, issues, notice })
  } catch { return res.status(503).json({ error: 'Your article was not added because moderation or storage is unavailable. Please try again later.' }) }
}
