import type { ChatMessage, ChatSession } from '../lib/chat'
import type { GameResponse, GameView } from '../lib/chatGames'
import type { MusicAlbumPayload, MusicArtistPayload, MusicSearchResult, QueueTrack } from '../lib/musicTypes'

// Loaded only by the explicit theme-demo URL. All demo API traffic stays in this tab.
export function installThemeFixtures() {
  document.documentElement.dataset.themeDemo = 'true'
  const nativeFetch = window.fetch.bind(window)
  const me: ChatSession = { id: '00000000-0000-4000-8000-000000000010', username: 'You' }
  const people = [me, { id: 'demo-maya', username: 'Maya' }, { id: 'demo-jules', username: 'Jules' }]
  const artwork = (title: string, fill: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><rect width="360" height="360" fill="${fill}"/><circle cx="180" cy="160" r="92" fill="#eee"/><circle cx="180" cy="160" r="30" fill="${fill}"/><text x="180" y="310" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="28">${title}</text></svg>`)}`
  const cover = artwork('Midnight Radio', '#40546a')
  const tracks: QueueTrack[] = ['First Light', 'A Very Long Song Title to Check Narrow Screens', 'Night Bus', 'After Hours'].map((title, index) => ({
    trackId: `demo-track-${index}`, videoId: `demo-video-${index}`, albumId: 'demo-album', albumTitle: 'Midnight Radio',
    artist: 'The Sample Band', title, coverUrl: cover, duration: 24,
  }))
  const album: MusicAlbumPayload = {
    album: { id: 'demo-album', title: 'Midnight Radio', creator: 'The Sample Band', year: '2026', coverUrl: cover, description: 'A fictional album for testing colour themes, track rows and playback controls.' },
    tracks,
  }
  const albumResult = { type: 'album' as const, id: 'demo-album', albumId: 'demo-album', title: album.album.title, artist: 'The Sample Band', coverUrl: cover, year: '2026', description: album.album.description, trackCount: tracks.length }
  const songs = tracks.map(track => ({ type: 'song' as const, id: track.trackId, title: track.title, artist: track.artist, coverUrl: track.coverUrl, albumTitle: track.albumTitle, duration: track.duration, track }))
  const artist: MusicArtistPayload = { artistId: 'demo-artist', name: 'The Sample Band', imageUrl: artwork('The Sample Band', '#62506c'), albums: [albumResult], songs }
  const results: MusicSearchResult[] = [...songs, albumResult, { type: 'artist', id: 'demo-artist', artistId: 'demo-artist', name: artist.name, imageUrl: artist.imageUrl }]
  const wav = new ArrayBuffer(44 + 8000 * 24 * 2)
  const audio = new DataView(wav)
  const word = (offset: number, value: string) => [...value].forEach((char, index) => audio.setUint8(offset + index, char.charCodeAt(0)))
  word(0, 'RIFF'); audio.setUint32(4, wav.byteLength - 8, true); word(8, 'WAVE'); word(12, 'fmt ')
  audio.setUint32(16, 16, true); audio.setUint16(20, 1, true); audio.setUint16(22, 1, true)
  audio.setUint32(24, 8000, true); audio.setUint32(28, 16000, true); audio.setUint16(32, 2, true); audio.setUint16(34, 16, true)
  word(36, 'data'); audio.setUint32(40, wav.byteLength - 44, true)
  const playbackUrl = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
  const message = (id: number, username: string, content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
    id, client_id: `demo-${id}`, author_id: people.find(person => person.username === username)?.id ?? 'demo-ai',
    username, content, kind: 'message', created_at: new Date(Date.now() - (10 - id) * 60000).toISOString(), ...extra,
  })
  const messages = [
    message(1, 'Maya', '# Welcome to the theme demo\nTry **bold**, *italic*, [links](https://example.com), and `inline code`.'),
    message(2, 'Jules', '> A quoted message\n\n- A short list\n- A longer line that wraps naturally on a phone\n\n```js\nconst theme = "your favourite"\nconsole.log(theme)\n```'),
    message(3, 'You', 'Checking replies and mentions.', { reply_to: 1, reply_preview: { id: 1, authorId: people[1].id, username: 'Maya', content: 'Welcome to the theme demo', isAi: false } }),
    message(4, 'Maya', 'Hey @You, check the document tile too.', { mentioned_ids: [me.id], attachments: [{ id: 'demo-file', name: 'a-long-document-name.pdf', relativePath: null, size: 153600, contentType: 'application/pdf', url: '', downloadUrl: 'data:text/plain,Theme%20demo%20document', width: null, height: null }] }),
    message(5, 'Jules', 'started a game', { kind: 'action', modifiers: { game_id: 'demo-connect4' } }),
    message(6, 'AI', 'These are sample messages. Nothing is sent to the live room.', { is_ai: true }),
    message(7, 'You', 'The composer, menus, emoji picker and game card use the actual chat components.'),
  ]
  const games = new Map<string, GameResponse>()
  const makeGame = (id: string, kind: GameView['kind']): GameResponse => ({
    game: { id, kind, host: me.id, players: [{ id: me.id, name: me.username }, { id: people[1].id, name: people[1].username }], status: 'active', version: 1,
      turn: me.id, winner: null, reason: '', board: kind === 'connect4' ? Array(42).fill(0) : Array(9).fill(0), fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [], ready: [], shots: {}, counts: {}, top: { id: 'card', color: 'red', value: '5' }, color: 'red', direction: 1, drawn: null, uno: [], wordMarks: {} },
    hand: [{ id: 'card-1', color: 'red', value: '7' }, { id: 'card-2', color: 'blue', value: '5' }], fleet: [], guesses: [{ word: 'crane', marks: [0, 1, 0, 2, 0] }],
  })
  games.set('demo-connect4', makeGame('demo-connect4', 'connect4'))
  let floor = 0
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin)
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(input, init)
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {}
    const state = new URLSearchParams(location.search).get('demo-state')
    if (state === 'error') return json({ error: 'Demo: the service is temporarily unavailable.' }, 503)
    if (url.pathname === '/api/theme-demo-news') return json(state === 'empty' ? [] : [{ id: 'demo-news', title: 'A sample news article', content: 'Checking long paragraphs, timestamps and the news form with your favourite theme.', author: 'Maya', createdAt: new Date().toISOString() }])
    if (url.pathname === '/api/stats') return json({ deploymentsToday: 3, branch: 'labs', lastCommitMessage: 'Sample theme update', lastCommitAt: new Date().toISOString(), now: new Date().toISOString() })
    if (url.pathname === '/api/commits') return json([])
    if (/^\/api\/(dylan|phil)-tightness-presence$/.test(url.pathname)) return json({ ok: true })
    if (/^\/api\/(dylan|phil)-tightness$/.test(url.pathname)) {
      const now = new Date().toISOString()
      return json({ ok: true, configured: true, now, source: 'demo', current: { online: true, game: true, apex: false, elden: false, gameName: 'Sample game', tightness: 64, projectedTightness: 72, statusLabel: 'Playing a sample game' }, lastSeen: { online: now, game: now, apex: null, elden: null }, history: Array.from({ length: 24 }, (_, index) => ({ at: new Date(Date.now() - (23 - index) * 60000).toISOString(), tightness: 40 + index, projectedTightness: 48 + index, online: true, game: true, apex: false, elden: false, gameName: 'Sample game' })) })
    }
    if (url.pathname === '/api/music-search') return new Response(`${JSON.stringify({ type: 'final', response: { query: url.searchParams.get('q'), page: 1, totalResults: state === 'empty' ? 0 : results.length, hasMore: false, results: state === 'empty' ? [] : results } })}\n`, { headers: { 'Content-Type': 'application/x-ndjson' } })
    if (url.pathname === '/api/music-album') return json(album)
    if (url.pathname === '/api/music-artist') return json(artist)
    if (url.pathname === '/api/track-resolve') return json({ status: 'ready', playbackUrl, mimeType: 'audio/wav', cachedAt: new Date().toISOString() })
    if (url.pathname === '/api/chat') {
      if (url.searchParams.get('action') === 'session' || body.action === 'join') {
        if (typeof body.username === 'string') me.username = body.username
        return json({ session: new URLSearchParams(location.search).has('demo-guest') && !body.action ? null : me })
      }
      if (body.action === 'send') {
        const next = message(messages.length + 1, me.username, String(body.content ?? body.text ?? ''), { author_id: me.id, client_id: String(body.clientId), kind: body.kind === 'action' ? 'action' : 'message' })
        messages.push(next)
        return json({ message: next })
      }
      if (url.searchParams.has('messageId')) return json({ message: messages.find(item => item.id === Number(url.searchParams.get('messageId'))) })
      const after = Number(url.searchParams.get('after') ?? 0)
      return json({ messages: state === 'empty' ? [] : messages.filter(item => item.id > Math.max(after, floor)), hasMore: false, clearedThrough: floor, people })
    }
    if (url.pathname === '/api/chat-room') {
      if (body.action === 'clear' || body.action === 'force') floor = messages[messages.length - 1]?.id ?? 0
      return json({ room: { cleared_through: floor, clear_revision: 0, ai_name: 'AI' }, clearedThrough: floor, vote: null, requests: [] })
    }
    if (url.pathname === '/api/chat-game') {
      let id = String(body.id ?? url.searchParams.get('id') ?? 'demo-connect4')
      if (body.action === 'create') { id = `demo-${String(body.kind)}`; games.set(id, makeGame(id, body.kind as GameView['kind'])) }
      const data = games.get(id) ?? games.get('demo-connect4')!
      if (body.action === 'play') {
        const move = body.move as Record<string, unknown>
        const column = Number(move.cell ?? 0)
        if (data.game.kind === 'connect4') for (let row = 5; row >= 0; row--) { const cell = row * 7 + column; if (!data.game.board[cell]) { data.game.board[cell] = 1; break } }
        else if (data.game.kind === 'tictactoe') data.game.board[Number(move.cell)] = 1
        data.game.version++
      }
      return json({ ...data, ...(body.action === 'create' ? { message: message(messages.length + 1, me.username, 'started a game', { kind: 'action', modifiers: { game_id: id } }) } : {}) })
    }
    if (url.pathname === '/api/chat-ai') return json({ messages: [message(messages.length + 1, 'AI', 'A local sample AI reply.', { is_ai: true })] })
    if (url.pathname === '/api/theme-demo-gifs') {
      const gif = { id: 'demoGif', title: 'Demo animation', url: cover, images: { original: { url: cover, width: '360', height: '360' }, fixed_height: { url: cover, width: '360', height: '360' }, fixed_height_small: { url: cover, width: '360', height: '360' } } }
      return json({ data: url.searchParams.get('path') === 'demoGif' ? gif : [gif] })
    }
    return json({ error: 'This action is unavailable in the local theme demo.' }, 501)
  }
}
