import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {
  getMusicAlbumPayload,
  getMusicArtistPayload,
  streamMusicSearchResponse,
} from './api/_lib/musicSearch'

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
            const harder = ['1', 'true', 'yes', 'on'].includes(
              (url.searchParams.get('harder') || '').toLowerCase()
            )

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
            }, undefined, harder)

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

        server.middlewares.use('/api/music-album', async (req, res) => {
          try {
            const url = new URL(req.url || '/', 'http://localhost')
            const id = url.searchParams.get('id')?.trim() || ''

            if (!id) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Album id required' }))
              return
            }

            const payload = await getMusicAlbumPayload(id)
            if (!payload) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Album not found' }))
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
                error: 'Album lookup failed',
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

            const parsed = JSON.parse(body) as { trackId?: string; videoId?: string }
            if (!parsed.trackId || !parsed.videoId) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid track payload' }))
              return
            }

            // Local dev doesn't bundle the Rust serverless function through Vite, so keep
            // the contract visible and prompt callers to use the deployed backend here.
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ status: 'preparing', mode: 'loading' }))
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
