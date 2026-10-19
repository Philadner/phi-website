import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { CATEGORIES, MODEL, moderate, parseSamples } from './core.mjs'

export function createLabServer({ fetcher = fetch } = {}) {
  const token = randomBytes(32).toString('hex')
  let busy = false
  return createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${res.socket.localPort}`
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(body))
    }
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) {
      json(403, { error: 'Only the local moderation lab may access this server.' })
      return
    }
    try {
      const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/core.mjs': ['core.mjs', 'text/javascript'] }
      if (req.method === 'GET' && files[req.url]) {
        const [name, type] = files[req.url]
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` })
        res.end(await readFile(new URL(name, import.meta.url)))
      } else if (req.method === 'GET' && req.url === '/config') {
        json(200, { token, categories: CATEGORIES, model: MODEL })
      } else if (req.method === 'GET' && req.url === '/phrases') {
        const response = await fetcher('https://api.phi.me.uk/kv/phrases', { signal: AbortSignal.timeout(20000) })
        if (!response.ok) throw new Error('Could not load the current phrases.')
        const phrases = await response.json()
        if (!Array.isArray(phrases) || phrases.some(text => typeof text !== 'string')) throw new Error('Unexpected phrase list format.')
        json(200, { phrases })
      } else if (req.method === 'POST' && req.url === '/moderate') {
        if (req.headers['x-lab-token'] !== token || req.headers['content-type'] !== 'application/json') {
          json(403, { error: 'Refresh the lab and try again.' })
          return
        }
        if (busy) { json(409, { error: 'A moderation pass is already running.' }); return }
        let body = ''
        for await (const chunk of req) {
          body += chunk.toString()
          if (Buffer.byteLength(body) > 2000000) { json(413, { error: 'Request too large.' }); return }
        }
        let parsed
        try { parsed = JSON.parse(body) } catch { json(400, { error: 'Invalid JSON request.' }); return }
        const key = typeof parsed.key === 'string' ? parsed.key.trim() : ''
        if (!key || key.length > 512 || /\s/.test(key)) { json(400, { error: 'Enter a valid OpenAI API key.' }); return }
        let samples
        try { samples = parseSamples(parsed.samples) } catch (error) { json(400, { error: error.message }); return }
        busy = true
        try { json(200, { rows: await moderate(samples, key, fetcher) }) } finally { busy = false }
      } else json(404, { error: 'Not found' })
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'The request timed out. Try a smaller sample list.'
        : error.message.startsWith('OpenAI') || error.message.startsWith('Could not') || error.message.startsWith('Unexpected') ? error.message
        : 'The request failed. Check your connection and try again.'
      json(502, { error: message })
    }
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.MODERATION_LAB_PORT || 4318)
  const server = createLabServer()
  server.requestTimeout = 300000
  server.on('error', error => { console.error(`Cannot start moderation lab: ${error.message}`); process.exitCode = 1 })
  server.listen(port, '127.0.0.1', () => console.log(`Moderation lab: http://127.0.0.1:${server.address().port}\nAPI keys and samples are not saved. Press Ctrl+C to stop.`))
}
