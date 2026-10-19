import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve, dirname, sep } from 'node:path'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/phraseModeration.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const shared = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const { MODERATION_CATEGORIES, MODERATION_THRESHOLDS, HARD_BLOCKED_CATEGORIES, MODERATION_PREFERENCE_CATEGORIES, hardBlockedIssues, phraseIssues, phraseVisible, parsePhrasePreferences, moderationNotice } = shared
const scores = overrides => ({ flagged: false, categories: Object.fromEntries(MODERATION_CATEGORIES.map(c => [c, false])), category_scores: { ...Object.fromEntries(MODERATION_CATEGORIES.map(c => [c, 0])), ...overrides } })
const schoolSafe = { school_safe: true, reason: '', model: 'gpt-6-luna', prompt_version: 1, reviewed_at: new Date().toISOString() }
const defaults = parsePhrasePreferences(null)
for (const category of MODERATION_CATEGORIES) {
  const result = scores({ [category]: MODERATION_THRESHOLDS[category] })
  const phrase = { id: 1, text: 'category boundary sample', hatefulness: result, school_safety: schoolSafe }
  assert.deepEqual(phraseIssues(result), [category])
  assert.equal(phraseVisible(phrase, defaults), false)
  assert.equal(phraseVisible(phrase, { showFiltered: true, moderated: [] }), !HARD_BLOCKED_CATEGORIES.includes(category))
  assert.equal(phraseVisible(phrase, { showFiltered: true, moderated: [category] }), false)
  result.category_scores[category] -= .00001
  assert.equal(phraseVisible(phrase, defaults), true)
}
assert.equal(phraseVisible({ hatefulness: {} }, { showFiltered: true, moderated: [] }), false)
assert.deepEqual(parsePhrasePreferences({ showFiltered: 'true', moderated: ['hate', 'fake'] }), { showOffensive: false, showFiltered: false, moderated: ['hate'] })
assert.equal(MODERATION_PREFERENCE_CATEGORIES.length, 9)
assert.deepEqual(parsePhrasePreferences({ showFiltered: true, moderated: [...HARD_BLOCKED_CATEGORIES, 'hate'] }), { showOffensive: false, showFiltered: true, moderated: ['hate'] })
for (const category of HARD_BLOCKED_CATEGORIES) {
  assert.equal(MODERATION_PREFERENCE_CATEGORIES.includes(category), false)
  assert.deepEqual(hardBlockedIssues(scores({ [category]: MODERATION_THRESHOLDS[category] })), [category])
}
assert.match(moderationNotice(['hate']), /your message will be hidden by default unless people turn moderation off.*contains hate speech/)

const offensive = { id: 20, text: 'offensive', hatefulness: scores(), school_safety: { ...schoolSafe, school_safe: false, reason: 'Personal insult.' } }
assert.equal(phraseVisible(offensive, defaults), false)
assert.equal(phraseVisible(offensive, { ...defaults, showFiltered: true }), false)
assert.equal(phraseVisible(offensive, { ...defaults, showOffensive: true }), true)
assert.equal(phraseVisible({ ...offensive, school_safety: null }, { ...defaults, showOffensive: true }), false)
assert.equal(phraseVisible({ ...offensive, school_safety: { ...schoolSafe, prompt_version: 0 } }, defaults), false)

console.log('PASS: all 13 threshold boundaries, independent filters, malformed scores and preferences')

await mkdir('node_modules/.tmp', { recursive: true })
const directory = await mkdtemp(resolve('node_modules/.tmp/phrase-tests-'))
const originalFetch = globalThis.fetch
const envKeys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]))
try {
  for (const file of ['api/append.ts', 'api/phrases.ts', 'api/_lib/phrases.ts', 'api/_lib/schoolSafety.ts', 'api/_lib/chatAuth.ts', 'src/lib/phraseModeration.ts']) {
    const output = resolve(directory, file.replace(/\.ts$/, '.js'))
    await mkdir(dirname(output), { recursive: true })
    const input = await readFile(file, 'utf8')
    await writeFile(output, ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
  }
  const { default: append } = await import(pathToFileURL(resolve(directory, 'api/append.js')).href)
  const { default: list } = await import(pathToFileURL(resolve(directory, 'api/phrases.js')).href)
  Object.assign(process.env, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'test-openai-key' })
  let mode = 'hate'
  let blockedCategory = HARD_BLOCKED_CATEGORIES[0]
  let calls = []
  const clean = { id: 1, text: 'clean sample', hatefulness: scores(), school_safety: schoolSafe }
  const hateful = { id: 2, text: 'hate category sample', hatefulness: scores({ hate: .9 }) }
  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    calls.push(url.href)
    if (url.pathname.includes('rpc/claim_phrase_submission')) return Response.json(mode !== 'limited')
    if (url.pathname === '/v1/responses') {
      const body = JSON.parse(options.body)
      assert.equal(body.model, 'gpt-6-luna')
      assert.equal(body.store, false)
      assert.equal(body.text.format.strict, true)
      if (mode === 'luna-error') return Response.json({}, { status: 503 })
      const result = mode === 'luna-invalid' ? { school_safe: false, reason: '' } : { school_safe: mode !== 'offensive', reason: mode === 'offensive' ? 'Personal insult.' : '' }
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] })
    }
    if (url.hostname === 'api.openai.com') {
      if (mode === 'provider-error') return Response.json({ error: { message: 'private detail' } }, { status: 503 })
      if (mode === 'invalid-result') return Response.json({ results: [{}] })
      return Response.json({ model: 'moderation-snapshot', results: [['clean', 'offensive', 'luna-error', 'luna-invalid'].includes(mode) ? scores() : mode === 'blocked' ? scores({ [blockedCategory]: MODERATION_THRESHOLDS[blockedCategory] }) : scores({ hate: .9 })] })
    }
    if (options?.method === 'POST') {
      const row = JSON.parse(options.body)
      assert.equal(row.hatefulness.model, 'moderation-snapshot')
      assert.ok(row.hatefulness.reviewed_at)
      if (['clean', 'offensive'].includes(mode)) assert.equal(row.school_safety.school_safe, mode === 'clean')
      else assert.equal(row.school_safety, null)
      return mode === 'duplicate' ? Response.json({ code: '23505', message: 'duplicate' }, { status: 409 }) : Response.json(null, { status: 201 })
    }
    if (mode === 'pagination') {
      const lastPage = url.searchParams.get('id') === 'gt.1000'
      return Response.json(lastPage ? [{ ...clean, id: 1001 }] : Array.from({ length: 1000 }, (_, index) => ({ ...clean, id: index + 1 })))
    }
    return Response.json([clean, hateful, { ...clean, id: 30, school_safety: { ...schoolSafe, school_safe: false, reason: 'Personal insult.' } }, { ...clean, id: 31, school_safety: null }, { id: 3, text: 'unreviewed', hatefulness: {} }, ...HARD_BLOCKED_CATEGORIES.map((category, index) => ({ id: 4 + index, text: 'excluded category sample', hatefulness: scores({ [category]: MODERATION_THRESHOLDS[category] }) }))])
  }
  const request = (body = { phrase: 'test phrase' }, extra = {}) => ({ method: 'POST', headers: { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json' }, body, socket: { remoteAddress: '127.0.0.1' }, ...extra })
  const invoke = async (handler, req) => {
    const response = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value }, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
    calls = []
    await handler(req, response)
    return response
  }
  let response = await invoke(append, request())
  assert.equal(response.statusCode, 201)
  assert.equal(response.body.hiddenByDefault, true)
  assert.deepEqual(response.body.issues, ['hate'])
  assert.equal(calls.some(url => url.endsWith('/v1/responses')), false, 'sensitive phrases skip Luna')
  mode = 'clean'
  response = await invoke(append, request())
  assert.equal(response.body.notice, '')
  mode = 'offensive'
  response = await invoke(append, request())
  assert.equal(response.statusCode, 201)
  assert.equal(response.body.hiddenByDefault, true)
  assert.match(response.body.notice, /generally offensive content.*Personal insult/)
  mode = 'blocked'
  for (const category of HARD_BLOCKED_CATEGORIES) {
    blockedCategory = category
    response = await invoke(append, request())
    assert.equal(response.statusCode, 422)
    assert.equal(response.body.ok, false)
    assert.equal(response.body.error, 'Your message has not been posted because what the fuck is this??')
    assert.deepEqual(response.body.issues, [category])
    assert.equal(calls.some(url => url.includes('/rest/v1/phrases')), false, 'hard exclusions must never be sent to storage')
  }
  for (const failure of ['provider-error', 'invalid-result', 'luna-error', 'luna-invalid']) {
    mode = failure
    response = await invoke(append, request())
    assert.equal(response.statusCode, 503)
    assert.equal(calls.some(url => url.includes('/rest/v1/phrases')), false, 'provider failure must never insert a phrase')
  }
  mode = 'limited'
  assert.equal((await invoke(append, request())).statusCode, 429)
  assert.equal(calls.length, 1)
  mode = 'duplicate'
  assert.equal((await invoke(append, request())).statusCode, 409)
  delete process.env.OPENAI_API_KEY
  assert.equal((await invoke(append, request())).statusCode, 503)
  assert.equal(calls.length, 1, 'no moderation call or insert without a key')
  for (const body of [{}, { phrase: 3 }, { phrase: 'x'.repeat(501) }]) {
    assert.equal((await invoke(append, request(body))).statusCode, 400)
    assert.equal(calls.length, 0)
  }
  assert.equal((await invoke(append, request({}, { method: 'GET' }))).statusCode, 405)
  assert.equal((await invoke(append, request({}, { headers: { host: 'localhost', origin: 'https://example.com' } }))).statusCode, 403)
  mode = 'list'
  assert.equal((await invoke(list, { method: 'GET', query: {} })).body.phrases.length, 1)
  assert.equal((await invoke(list, { method: 'GET', query: { includeFiltered: '1' } })).body.phrases.length, 3)
  mode = 'pagination'
  assert.equal((await invoke(list, { method: 'GET', query: {} })).body.phrases.length, 1001)
  console.log('PASS: hard-excluded categories are rejected without inserts and never returned, including unfiltered reads; submission notices, duplicates, rate limits, provider failures and pagination')
} finally {
  globalThis.fetch = originalFetch
  for (const key of envKeys) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key] }
  assert.ok(directory.startsWith(resolve('node_modules/.tmp') + sep))
  await rm(directory, { recursive: true, force: true })
}
