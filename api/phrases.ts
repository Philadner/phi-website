import type { VercelRequest, VercelResponse } from '@vercel/node'
import { phraseDatabase } from './_lib/phrases.js'
import { phraseAllowed, phraseIssues } from '../src/lib/phraseModeration.js'
import type { PhraseRecord } from '../src/lib/phraseModeration.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }) }
  if (req.query.includeFiltered !== undefined && req.query.includeFiltered !== '1') return res.status(400).json({ error: 'Invalid filter option.' })
  try {
    const db = phraseDatabase()
    const phrases: PhraseRecord[] = []
    let after = 0
    for (;;) {
      const { data, error } = await db.from('phrases').select('id,text,hatefulness').gt('id', after).order('id').limit(1000)
      if (error) throw error
      for (const row of data) if (phraseAllowed(row.hatefulness) && (req.query.includeFiltered === '1' || !phraseIssues(row.hatefulness).length)) phrases.push(row)
      if (data.length < 1000) break
      after = data[data.length - 1].id
    }
    return res.status(200).json({ phrases })
  } catch { return res.status(503).json({ error: 'The phrase list is temporarily unavailable.' }) }
}
