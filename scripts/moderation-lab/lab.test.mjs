import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request } from 'node:http'
import { CATEGORIES, matchedCategories, moderate, parseSamples } from './core.mjs'
import { createLabServer } from './server.mjs'

const result = (score = 0) => ({ flagged: false, categories: Object.fromEntries(CATEGORIES.map(c => [c, false])), category_scores: Object.fromEntries(CATEGORIES.map(c => [c, score])) })

test('sample parsing preserves JSON phrases containing newlines and rejects malformed input', () => {
  assert.deepEqual(parseSamples('["a\\nb", " c "]'), ['a\nb', 'c'])
  assert.deepEqual(parseSamples('one\r\ntwo\n\n'), ['one', 'two'])
  for (const value of ['', '[3]', '[broken', 'x'.repeat(10001)]) assert.throws(() => parseSamples(value))
})
test('threshold boundaries are inclusive and do not use the provider flagged boolean', () => {
  const scores = result()
  scores.category_scores.hate = .25
  const thresholds = Object.fromEntries(CATEGORIES.map(c => [c, .5]))
  thresholds.hate = .25
  assert.deepEqual(matchedCategories(scores, thresholds), ['hate'])
  thresholds.hate = .2501
  assert.deepEqual(matchedCategories(scores, thresholds), [])
})
test('batch moderation preserves text-to-result alignment and raw metadata', async () => {
  let calls = 0
  const samples = Array.from({ length: 65 }, (_, i) => `sample ${i}`)
  const rows = await moderate(samples, 'test-key', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/moderations')
    assert.equal(options.headers.Authorization, 'Bearer test-key')
    const input = JSON.parse(options.body).input
    calls++
    return Response.json({ model: 'model-snapshot', results: input.map(text => ({ ...result(Number(text.split(' ')[1]) / 100), category_applied_input_types: { hate: ['text'] } })) })
  })
  assert.equal(calls, 3)
  assert.equal(rows[64].text, 'sample 64')
  assert.equal(rows[64].hatefulness.category_scores.hate, .64)
  assert.equal(rows[64].hatefulness.model, 'model-snapshot')
  assert.deepEqual(rows[64].hatefulness.category_applied_input_types, { hate: ['text'] })
})
test('rejects incomplete scores and sanitises upstream errors', async () => {
  await assert.rejects(moderate(['x', 'y'], 'key', async () => Response.json({ results: [result()] })), /incomplete/)
  await assert.rejects(moderate(['x'], 'key', async () => Response.json({ results: [{}] })), /incomplete/)
  await assert.rejects(moderate(['x'], 'secret', async () => new Response('secret upstream error', { status: 401 })), { message: 'OpenAI rejected that API key.' })
})
test('local HTTP server enforces origin, host, token and validates before calling OpenAI', async t => {
  let calls = 0
  const server = createLabServer({ fetcher: async () => { calls++; return Response.json({ model: 'test', results: [result()] }) } })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const config = await (await fetch(`${origin}/config`)).json()
  const post = (headers, body) => fetch(`${origin}/moderate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  assert.equal((await post({}, {})).status, 403)
  assert.equal((await post({ 'X-Lab-Token': config.token, Origin: 'https://example.com' }, {})).status, 403)
  const spoofedHostStatus = await new Promise((resolve, reject) => {
    const req = request(`${origin}/config`, { headers: { Host: 'example.com' } }, res => { res.resume(); resolve(res.statusCode) })
    req.on('error', reject)
    req.end()
  })
  assert.equal(spoofedHostStatus, 403)
  assert.equal((await post({ 'X-Lab-Token': config.token }, { key: 'test', samples: '[3]' })).status, 400)
  assert.equal(calls, 0)
  const response = await post({ 'X-Lab-Token': config.token }, { key: 'test', samples: 'hello' })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).rows[0].text, 'hello')
  assert.equal(calls, 1)
})
