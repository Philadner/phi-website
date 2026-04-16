import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { getMusicArtistPayload, getMusicSearchResponse } from './api/_lib/musicSearch'

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

            const payload = await getMusicSearchResponse(query, page)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: 'Hybrid music search failed',
                message: error instanceof Error ? error.message : 'Unknown error',
              })
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
      },
    },
  ],
})
