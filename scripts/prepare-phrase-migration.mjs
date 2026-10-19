import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import ts from 'typescript'
import { validateResult } from './moderation-lab/core.mjs'

const file = process.argv[2]
if (!file) throw new Error('Usage: node scripts/prepare-phrase-migration.mjs <scored-samples.json>')
const source = await readFile(new URL('../src/lib/phraseModeration.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { MODERATION_THRESHOLDS, MODERATION_MODEL, MODERATION_VERSION, phraseIssues, phraseAllowed } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const exported = JSON.parse(await readFile(file, 'utf8'))
if (exported.version !== 1 || exported.comparison !== '>=' || exported.model !== MODERATION_MODEL ||
    Object.entries(MODERATION_THRESHOLDS).some(([category, threshold]) => exported.thresholds?.[category] !== threshold)) throw new Error('The exported thresholds do not match the website configuration.')
if (!Array.isArray(exported.rows) || !exported.rows.length || exported.rows.some(row => typeof row.text !== 'string' || !row.text.trim() || row.text.length > 10000 || !validateResult(row.hatefulness))) throw new Error('The scored phrase list is invalid.')
const response = await fetch('https://api.phi.me.uk/kv/phrases', { signal: AbortSignal.timeout(20000) })
if (!response.ok) throw new Error('Could not verify the legacy phrase list. Nothing has been changed.')
const legacy = await response.json()
if (!Array.isArray(legacy) || legacy.some(text => typeof text !== 'string')) throw new Error('Invalid legacy list.')
const byText = new Map(exported.rows.map(row => [row.text, row]))
const missing = legacy.filter(text => !byText.has(text.trim()))
if (missing.length) throw new Error(`${missing.length} legacy phrases have no scores. Re-score the current list before migrating.`)
const reviewedAt = new Date().toISOString()
const candidates = [...new Set(legacy.map(text => text.trim()))].map(text => ({ text, hatefulness: { ...byText.get(text).hatefulness, model: byText.get(text).hatefulness.model ?? exported.model, imported_at: reviewedAt, threshold_version: MODERATION_VERSION } }))
const rows = candidates.filter(row => phraseAllowed(row.hatefulness))
let schema = await readFile(new URL('../supabase/migrations/20261019001000_phrase_moderation.sql', import.meta.url), 'utf8')
schema = schema.replace(/^begin;\s*/, '').replace(/commit;\s*$/, '')
const delimiter = `$phi_${randomBytes(12).toString('hex')}$`
const sql = `begin;\n${schema}\ninsert into public.phrases (text, hatefulness)\nselect text, hatefulness from jsonb_to_recordset(${delimiter}${JSON.stringify(rows)}${delimiter}::jsonb) as imported(text text, hatefulness jsonb)\non conflict (text_hash) do nothing;\ninsert into supabase_migrations.schema_migrations(version, name, statements)\nvalues ('20261019001000', 'phrase_moderation', array[${delimiter}${schema}${delimiter}])\non conflict (version) do nothing;\ncommit;\n`
await mkdir(new URL('../output/', import.meta.url), { recursive: true })
await writeFile(new URL('../output/phrase-import.local', import.meta.url), sql)
await writeFile(new URL('../output/phrase-backup.local', import.meta.url), JSON.stringify({ captured_at: reviewedAt, legacy, exported }, null, 2) + '\n')
const hidden = rows.filter(row => phraseIssues(row.hatefulness).length).length
console.log(JSON.stringify({ legacyPhrases: legacy.length, uniqueScoredPhrases: rows.length, excludedEntirely: candidates.length - rows.length, hiddenByDefault: hidden, visibleByDefault: rows.length - hidden, sql: 'output/phrase-import.local', backup: 'output/phrase-backup.local' }, null, 2))
