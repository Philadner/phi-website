// Uses the same approved classifier as new submissions. Existing valid reviews are resumable.
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import ts from 'typescript'

const apply = process.argv.includes('--apply')
const env = parseEnv(await readFile('.env.phrases.local', 'utf8'))
for (const key of ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[key]?.trim()) throw new Error(`Missing ${key} in .env.phrases.local`)
  process.env[key] = env[key]
}
// Refuse to touch any other Supabase project.
if (new URL(env.SUPABASE_URL).hostname !== 'somvkodojhizygkxupug.supabase.co') throw new Error('Unexpected Supabase project.')
await mkdir('node_modules/.tmp', { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/school-safety-'))
try {
  for (const file of ['src/lib/phraseModeration.ts', 'api/_lib/schoolSafety.ts']) {
    const target = resolve(temp, file.replace(/\.ts$/, '.js'))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
  }
  const { phraseAllowed, phraseIssues, isSchoolSafetyResult } = await import(pathToFileURL(resolve(temp, 'src/lib/phraseModeration.js')))
  const { classifySchoolSafety } = await import(pathToFileURL(resolve(temp, 'api/_lib/schoolSafety.js')))
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } })
  const rows = []
  let after = 0
  for (;;) {
    const { data, error } = await db.from('phrases').select('id,text,hatefulness,school_safety').gt('id', after).order('id').limit(1000)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < 1000) break
    after = data.at(-1).id
  }
  const eligible = rows.filter(row => phraseAllowed(row.hatefulness) && phraseIssues(row.hatefulness).length === 0)
  const pending = eligible.filter(row => !isSchoolSafetyResult(row.school_safety))
  console.log(JSON.stringify({ total: rows.length, sensitiveOrExcluded: rows.length - eligible.length, eligible: eligible.length, alreadyReviewed: eligible.length - pending.length, pending: pending.length, apply }))
  if (!apply) process.exitCode = 0
  else {
    await mkdir('output', { recursive: true })
    const backup = resolve(`output/school-safety-backup-${Date.now()}.local`)
    await writeFile(backup, JSON.stringify(rows, null, 2))
    console.log('Saved local database snapshot before updates.')
    let completed = 0
    const failures = []
    const queue = [...pending]
    await Promise.all(Array.from({ length: 3 }, async () => {
      for (let row; (row = queue.shift());) {
        try {
          let result
          for (let attempt = 0; attempt < 3; attempt++) {
            try { result = await classifySchoolSafety(row.text); break }
            catch (error) { if (attempt === 2) throw error; await new Promise(done => setTimeout(done, 1500 * (attempt + 1))) }
          }
          const { data, error } = await db.from('phrases').update({ school_safety: result }).eq('id', row.id).eq('text', row.text).eq('hatefulness', JSON.stringify(row.hatefulness)).select('id')
          if (error || data.length !== 1) throw new Error(error?.message || 'Phrase changed during review.')
          completed++
          if (completed % 20 === 0) console.log(`Reviewed ${completed}/${pending.length}`)
        } catch (error) { failures.push(row.id); console.error(`Review failed for id ${row.id}: ${error.message}`) }
      }
    }))
    const { data, error } = await db.from('phrases').select('id,hatefulness,school_safety').order('id')
    if (error) throw new Error(error.message)
    const reviewed = data.filter(row => phraseAllowed(row.hatefulness) && !phraseIssues(row.hatefulness).length)
    const unreviewed = reviewed.filter(row => !isSchoolSafetyResult(row.school_safety))
    console.log(JSON.stringify({ total: data.length, reviewed: reviewed.length - unreviewed.length, schoolSafe: reviewed.filter(row => isSchoolSafetyResult(row.school_safety) && row.school_safety.school_safe).length, generallyOffensive: reviewed.filter(row => isSchoolSafetyResult(row.school_safety) && !row.school_safety.school_safe).length, sensitive: data.length - reviewed.length, unreviewed: unreviewed.length, failures }))
    if (failures.length || unreviewed.length) process.exitCode = 1
  }
} finally { await rm(temp, { recursive: true, force: true }) }
