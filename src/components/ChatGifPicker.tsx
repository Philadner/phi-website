import { useEffect, useRef, useState } from 'react'
import { giphyFetch } from '../lib/chatGifs'
import type { ChatGifRef, GiphyGif } from '../lib/chatGifs'

export default function ChatGifPicker({ initialQuery, choose, close }: { initialQuery: string; choose: (gif: ChatGifRef) => void; close: () => void }) {
  const [query, setQuery] = useState(initialQuery.slice(0, 50))
  const [offset, setOffset] = useState(0)
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [busy, setBusy] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    const controller = new AbortController()
    setBusy(true); setError('')
    const timer = window.setTimeout(() => {
      void giphyFetch(query ? 'search' : 'trending', { ...(query ? { q: query, lang: 'en' } : {}), limit: '18', offset: String(offset), rating: 'pg-13' }, controller.signal)
        .then(result => { if (!controller.signal.aborted) { setGifs(old => offset ? [...old, ...result.data] : result.data); setMore(result.pagination.offset + result.pagination.count < result.pagination.total_count) } })
        .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'GIFs could not load.') })
        .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, offset])
  return <section className="chat-gif-picker" aria-label="GIPHY picker" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}>
    <header><input ref={input} aria-label="Search GIPHY" placeholder="Search GIPHY" value={query} maxLength={50} onChange={e => { setQuery(e.target.value); setOffset(0); setGifs([]) }} /><button type="button" aria-label="Close GIF picker" onClick={close}>×</button></header>
    <div className="chat-gif-results">{gifs.map((gif, index) => <button type="button" key={`${gif.id}-${index}`} aria-label={`Choose ${gif.title || 'GIF'}`} onClick={() => choose({ id: gif.id, title: gif.title.slice(0, 200) })}><img src={(gif.images.fixed_width || gif.images.original).url} alt={gif.title || 'GIF'} loading="lazy" /><span>{gif.user?.display_name || gif.user?.username || ''}</span></button>)}</div>
    {error && <p className="chat-error" role="alert">{error}</p>}{busy && <p className="chat-game-muted" role="status">Loading…</p>}{!busy && !error && !gifs.length && <p className="chat-game-muted">No GIFs found.</p>}
    <footer><a href="https://giphy.com" target="_blank" rel="noopener noreferrer">Powered by <strong>GIPHY</strong></a>{more && <button type="button" disabled={busy} onClick={() => setOffset(offset + 18)}>Load more</button>}</footer>
  </section>
}
