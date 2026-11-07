// Import the legacy feed without modifying it. Re-runs skip unchanged, reviewed articles.
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import ts from 'typescript'

const apply = process.argv.includes('--apply')
try {
  const env = parseEnv(await readFile('.env.phrases.local', 'utf8'))
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']) {
    if (!process.env[key]?.trim() && env[key]?.trim()) process.env[key] = env[key]
  }
} catch (error) { if (error.code !== 'ENOENT') throw error }
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', ...(apply ? ['OPENAI_API_KEY'] : [])]) {
  if (!process.env[key]?.trim()) throw new Error(`Missing ${key}. Set it in the environment or .env.phrases.local.`)
}
if (new URL(process.env.SUPABASE_URL).hostname !== 'somvkodojhizygkxupug.supabase.co') throw new Error('Unexpected Supabase project.')
await mkdir('node_modules/.tmp', { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/news-review-'))
try {
  for (const file of ['src/lib/phraseModeration.ts', 'src/lib/newsModeration.ts', 'api/_lib/phrases.ts', 'api/_lib/schoolSafety.ts']) {
    const target = resolve(temp, file.replace(/\.ts$/, '.js'))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
  }
  const { hardBlockedIssues, phraseIssues } = await import(pathToFileURL(resolve(temp, 'src/lib/phraseModeration.js')))
  const { newsReviewed, newsReviewText, parseNewsInput } = await import(pathToFileURL(resolve(temp, 'src/lib/newsModeration.js')))
  const { moderatePhrase } = await import(pathToFileURL(resolve(temp, 'api/_lib/phrases.js')))
  const { classifySchoolSafety } = await import(pathToFileURL(resolve(temp, 'api/_lib/schoolSafety.js')))
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const response = await fetch('https://api.phi.me.uk/kv/news', { signal: AbortSignal.timeout(20000), cache: 'no-store' })
  if (!response.ok) throw new Error(`Legacy news failed (${response.status}).`)
  const legacy = await response.json()
  if (!Array.isArray(legacy)) throw new Error('Invalid legacy feed.')
  const seen = new Set()
  const rows = legacy.map(row => {
    const input = parseNewsInput(row)
    if (!input || typeof row.id !== 'string' || !row.id || seen.has(row.id) || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))) throw new Error('Invalid or duplicate legacy article; no changes made.')
    seen.add(row.id)
    return { ...input, id: row.id, createdAt: row.createdAt }
  })
  const { data: existing, error } = await db.from('news_articles').select('*')
  if (error) throw new Error(error.message)
  // Do not overwrite articles that changed after a previous import.
  for (const row of rows) {
    const saved = existing.find(item => item.id === row.id)
    if (saved && (newsReviewText(saved) !== newsReviewText(row) || Date.parse(saved.createdAt) !== Date.parse(row.createdAt))) throw new Error(`Article ${row.id} changed; review the conflict before importing.`)
  }
  const pending = rows.filter(row => !existing.some(item => item.id === row.id && newsReviewed(item)))
  console.log(JSON.stringify({ total: rows.length, alreadyReviewed: rows.length - pending.length, pending: pending.length, apply }))
  if (apply) {
    await mkdir('output', { recursive: true })
    const stamp = Date.now()
    await writeFile(`output/news-backup-${stamp}.local`, JSON.stringify({ legacy, existing }, null, 2), { mode: 0o600 })
    const audit = []
    let failures = 0
    for (const row of pending) {
      try {
        const hatefulness = await moderatePhrase(newsReviewText(row))
        const blocked = hardBlockedIssues(hatefulness)
        const school_safety = blocked.length || phraseIssues(hatefulness).length ? null : await classifySchoolSafety(newsReviewText(row))
        const reviewed = { ...row, hatefulness, school_safety }
        audit.push({ ...reviewed, excluded: blocked.length > 0 })
        await writeFile(`output/news-reviews-${stamp}.local`, JSON.stringify(audit, null, 2), { mode: 0o600 })
        if (blocked.length) { console.log(`Excluded article ${row.id} under the hard-exclusion policy.`); continue }
        // Ignore concurrent inserts rather than overwriting somebody else's work.
        const { error: saveError } = await db.from('news_articles').upsert(reviewed, { onConflict: 'id', ignoreDuplicates: true })
        if (saveError) throw new Error(saveError.message)
        const { data: saved, error: readError } = await db.from('news_articles').select('*').eq('id', row.id).single()
        if (readError || !newsReviewed(saved) || newsReviewText(saved) !== newsReviewText(row)) throw new Error('Readback failed or article changed during review.')
        console.log(`Reviewed and verified article ${row.id}.`)
      } catch (error) { failures++; console.error(`Article ${row.id}: ${error.message}`) }
    }
    console.log(JSON.stringify({ reviewed: audit.length, excluded: audit.filter(row => row.excluded).length, failures }))
    if (failures) process.exitCode = 1
  }
} finally { await rm(temp, { recursive: true, force: true }) }
