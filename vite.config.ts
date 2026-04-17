import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { getMusicArtistPayload, streamMusicSearchResponse } from './api/_lib/musicSearch'
import { archiveFetch } from './api/_lib/archiveFetch'
import { resolveTrackPlayback } from './api/_lib/playbackCache'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/archive-api': {
        target: 'https://archive.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/archive-api/, ''),
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'music-api-dev-middleware',
      configureServer(server) {
        server.middlewares.use('/api/music-search', async (req, res) => {
          try {
            const url = new URL(req.url || '/', 'http://localhost')
            const query = url.searchParams.get('q')?.trim() || ''
            const page = Number(url.searchParams.get('page') || '1')

            if (!query) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Query required' }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')

            await streamMusicSearchResponse(query, page, async (chunk) => {
              res.write(`${JSON.stringify(chunk)}\n`)
            })

            res.end()
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
            res.end(
              `${JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown error',
              })}\n`
            )
          }
        })

        server.middlewares.use('/api/music-artist', async (req, res) => {
          try {
            const url = new URL(req.url || '/', 'http://localhost')
            const id = url.searchParams.get('id')?.trim() || ''

            if (!id) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Artist id required' }))
              return
            }

            const payload = await getMusicArtistPayload(id)
            if (!payload) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Artist not found' }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'Artist lookup failed',
                message: error instanceof Error ? error.message : 'Unknown error',
              })
            )
          }
        })

        server.middlewares.use('/api/archive-metadata', async (req, res) => {
          try {
            const url = new URL(req.url || '/', 'http://localhost')
            const id = url.searchParams.get('id')?.trim() || ''

            if (!id) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Album id required' }))
              return
            }

            const archiveRes = await archiveFetch(
              `https://archive.org/metadata/${encodeURIComponent(id)}`
            )
            const body = await archiveRes.text()

            res.statusCode = archiveRes.ok ? 200 : archiveRes.status
            res.setHeader('Content-Type', 'application/json')
            res.end(
              archiveRes.ok
                ? body
                : JSON.stringify({
                    error: 'Archive metadata failed',
                    details: body.slice(0, 300),
                  })
            )
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'Archive metadata failed',
                message: error instanceof Error ? error.message : 'Unknown error',
              })
            )
          }
        })

        server.middlewares.use('/api/track-resolve', async (req, res) => {
          try {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            let body = ''
            await new Promise<void>((resolve, reject) => {
              req.on('data', (chunk) => {
                body += chunk.toString()
              })
              req.on('end', () => resolve())
              req.on('error', reject)
            })

            const payload = await resolveTrackPlayback(JSON.parse(body))
            res.statusCode = payload.status === 'error' ? 500 : 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                status: 'error',
                message: error instanceof Error ? error.message : 'Track resolve failed',
              })
            )
          }
        })
      },
    },
  ],
})
