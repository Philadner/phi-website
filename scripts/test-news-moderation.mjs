import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

await mkdir('node_modules/.tmp', { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/news-tests-'))
const originalFetch = globalThis.fetch
try {
  for (const file of ['api/news.ts', 'api/_lib/phrases.ts', 'api/_lib/schoolSafety.ts', 'api/_lib/chatAuth.ts', 'src/lib/phraseModeration.ts', 'src/lib/newsModeration.ts']) {
    const target = resolve(temp, file.replace(/\.ts$/, '.js'))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
  }
  const { default: handler } = await import(pathToFileURL(resolve(temp, 'api/news.js')))
  const { newsVisible, newsReviewText } = await import(pathToFileURL(resolve(temp, 'src/lib/newsModeration.js')))
  const { MODERATION_CATEGORIES, DEFAULT_PHRASE_PREFERENCES: defaults } = await import(pathToFileURL(resolve(temp, 'src/lib/phraseModeration.js')))
  const scores = (overrides = {}) => ({ flagged: false, categories: Object.fromEntries(MODERATION_CATEGORIES.map(c => [c, false])), category_scores: { ...Object.fromEntries(MODERATION_CATEGORIES.map(c => [c, 0])), ...overrides } })
  const safety = { school_safe: true, reason: '', model: 'gpt-6-luna', prompt_version: 2, reviewed_at: new Date().toISOString() }
  const clean = { id: 'a', title: 'News', content: 'A story', author: 'Author', createdAt: new Date().toISOString(), hatefulness: scores(), school_safety: safety }
  const offensive = { ...clean, id: 'b', school_safety: { ...safety, school_safe: false, reason: 'Personal abuse.' } }
  const sensitive = { ...clean, id: 'c', hatefulness: scores({ hate: .8 }), school_safety: null }
  const blocked = { ...clean, id: 'd', hatefulness: scores({ 'sexual/minors': .2 }) }
  const unknown = { ...clean, id: 'e', school_safety: null }
  for (const row of [offensive, sensitive, blocked, unknown]) assert.equal(newsVisible(row, defaults), false)
  assert.equal(newsVisible(offensive, { ...defaults, showOffensive: true }), true)
  assert.equal(newsVisible(sensitive, { ...defaults, showFiltered: true }), true)
  for (const row of [blocked, unknown]) assert.equal(newsVisible(row, { ...defaults, showOffensive: true, showFiltered: true }), false)
  Object.assign(process.env, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', OPENAI_API_KEY: 'test-key' })
  let mode = 'clean', inserts = [], reviewed = []
  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    if (url.pathname.includes('/rpc/')) return Response.json(mode !== 'limited')
    if (url.pathname === '/v1/moderations') {
      reviewed.push(JSON.parse(options.body).input)
      if (mode === 'failure') return new Response('', { status: 503 })
      return Response.json({ results: [mode === 'blocked' ? blocked.hatefulness : mode === 'sensitive' ? sensitive.hatefulness : scores()] })
    }
    if (url.pathname === '/v1/responses') return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(mode === 'offensive' ? { school_safe: false, reason: 'Personal abuse.' } : { school_safe: true, reason: '' }) }] }] })
    if (url.pathname === '/rest/v1/news_articles') {
      if (options.method === 'POST') { inserts.push(JSON.parse(options.body)); return new Response(null, { status: 201 }) }
      return Response.json([clean, offensive, sensitive, blocked, unknown])
    }
    throw new Error(`Unexpected request: ${url.pathname}`)
  }
  async function request(method, body, query = {}, headers = {}) {
    const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this }, json(value) { this.body = value; return this } }
    await handler({ method, body, query, headers: { host: 'site.test', origin: 'https://site.test', 'content-type': 'application/json', ...headers } }, res)
    return res
  }
  assert.deepEqual((await request('GET')).body.map(row => row.id), ['a'])
  assert.deepEqual((await request('GET', null, { includeFiltered: '1' })).body.map(row => row.id), ['a', 'b', 'c'])
  assert.equal((await request('GET', null, { includeFiltered: 'yes' })).code, 400)
  assert.equal((await request('POST', clean, {}, { origin: 'https://evil.test' })).code, 403)
  assert.equal((await request('POST', { ...clean, author: 10 })).code, 400)
  assert.equal((await request('POST', { ...clean, content: 'x'.repeat(10001) })).code, 400)
  for (const failure of ['limited', 'blocked', 'failure']) {
    mode = failure
    const count = inserts.length
    assert.equal((await request('POST', clean)).code, { limited: 429, blocked: 422, failure: 503 }[failure])
    assert.equal(inserts.length, count, 'failure must not insert')
  }
  for (mode of ['clean', 'offensive', 'sensitive']) {
    const res = await request('POST', { ...clean, hatefulness: blocked.hatefulness })
    assert.equal(res.code, 201)
    assert.equal(res.body.hiddenByDefault, mode !== 'clean')
    assert.equal(reviewed.at(-1), newsReviewText(clean), 'title, body and author are all reviewed')
    assert.notDeepEqual(inserts.at(-1).hatefulness, blocked.hatefulness, 'client-provided scores are ignored')
  }
  console.log('PASS: news filtering, whole-article review, write validation, rate limiting, hard exclusions and provider failures')
} finally { globalThis.fetch = originalFetch; await rm(temp, { recursive: true, force: true }) }
