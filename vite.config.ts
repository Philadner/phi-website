import { defineConfig, loadEnv } from 'vite'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import phraseListHandler from './api/phrases'
import appendPhraseHandler from './api/append'
import react from '@vitejs/plugin-react'
import { themes, contrast, paintTheme, themeVisible, THEME_STORAGE_KEY } from './src/lib/themes'
import {
  getMusicAlbumPayload,
  getMusicArtistPayload,
  streamMusicSearchResponse,
} from './api/_lib/musicSearch'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const sourceName = assetInfo.names?.[0] ?? assetInfo.name ?? ''
          return sourceName.endsWith('.mjs')
            ? 'assets/[name][extname]'
            : 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
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
      name: 'phrase-api-dev-middleware',
      configureServer(server) {
        const env = loadEnv(server.config.mode, server.config.envDir, '')
        for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']) {
          if (!process.env[key]?.trim() && env[key]?.trim()) process.env[key] = env[key]
        }
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url || '/', 'http://localhost')
          if (url.pathname !== '/api/phrases' && url.pathname !== '/api/append') return next()
          const reply = Object.assign(res, {
            status(code: number) { res.statusCode = code; return reply },
            json(body: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return reply },
          }) as unknown as VercelResponse
          try {
            let text = ''
            for await (const chunk of req) {
              text += String(chunk)
              if (Buffer.byteLength(text) > 16384) { reply.status(413).json({ error: 'Request too large.' }); return }
            }
            let body: unknown
            try { body = text ? JSON.parse(text) : undefined } catch { reply.status(400).json({ error: 'Invalid JSON.' }); return }
            const query: Record<string, string | string[]> = {}
            for (const key of new Set(url.searchParams.keys())) {
              const values = url.searchParams.getAll(key)
              query[key] = values.length === 1 ? values[0] : values
            }
            const request = Object.assign(req, { query, body }) as unknown as VercelRequest
            await (url.pathname === '/api/phrases' ? phraseListHandler : appendPhraseHandler)(request, reply)
          } catch { reply.status(500).json({ error: 'The local phrase API failed.' }) }
        })
      },
    },
    {
      name: 'phi-theme-before-paint',
      transformIndexHtml() {
        return [{ tag: 'script', injectTo: 'head-prepend', children: `
          (() => {
            const themes = ${JSON.stringify(themes)};
            let id;
            let showOffensive = false;
            try { id = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch {}
            try { showOffensive = JSON.parse(localStorage.getItem('phi.phrase-moderation.v1') || 'null')?.showOffensive === true; } catch {}
            const theme = themes.find(theme => theme.id === id && (${themeVisible.toString()})(theme, showOffensive)) || themes[0];
            (${paintTheme.toString()})(theme, ${contrast.toString()});
          })();
        ` }]
      },
    },
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
