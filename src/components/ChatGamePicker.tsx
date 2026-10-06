import { useRef } from 'react'
import type { ReactNode } from 'react'
import { CHAT_GAMES } from '../lib/chatGames'
import type { GameKind } from '../lib/chatGames'
import { useState } from 'react'
import GameArtwork from './ChatGameArtwork'
import '../stylesheets/ChatGames.css'

type Props = { gamesOpen: boolean; setGamesOpen: (open: boolean) => void; onStart: (kind: GameKind) => void; busy?: boolean; error?: string; children: (open: () => void) => ReactNode }
export default function ChatGamePicker({ gamesOpen, setGamesOpen, onStart, busy, error, children }: Props) {
  const [selected, setSelected] = useState<typeof CHAT_GAMES[number]>(CHAT_GAMES[0])
  const main = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLButtonElement>(null)
  function goBack() {
    setGamesOpen(false)
    requestAnimationFrame(() => main.current?.querySelector<HTMLButtonElement>('[data-game-start]')?.focus({ preventScroll: true }))
  }
  const soon = 'soon' in selected && selected.soon
  return <section id="chat-stuff-menu" className={`chat-tool-panel chat-stuff-menu game-picker${gamesOpen ? ' game-picker--games' : ''}`} aria-label="Stuff menu" onKeyDown={event => {
    if (event.key === 'Escape' && gamesOpen) { event.stopPropagation(); goBack() }
  }}>
    <div className="game-picker-window"><div className="game-picker-track" onTransitionEnd={event => { if (event.target === event.currentTarget && gamesOpen) back.current?.focus({ preventScroll: true }) }}>
      <div ref={main} className="game-picker-stuff" inert={gamesOpen}>{children(() => setGamesOpen(true))}</div>
      <nav className="game-picker-list" aria-label="Choose a game" inert={!gamesOpen} onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
        buttons[next]?.focus()
      }}>
        <button ref={back} type="button" className="game-picker-back" onClick={goBack}>← Back</button>
        {CHAT_GAMES.map(game => <button type="button" key={game.id} className="game-picker-option" aria-pressed={selected.id === game.id} onPointerEnter={() => setSelected(game)} onFocus={() => setSelected(game)} onClick={() => setSelected(game)}><span>{game.title}</span>{'soon' in game ? <small>soon</small> : <span aria-hidden="true">↗</span>}</button>)}
      </nav>
    </div></div>
    <article className="game-picker-detail" aria-label="Game details" inert={!gamesOpen}>
      <div key={selected.id} className="game-picker-detail-content"><GameArtwork game={selected.id} title={selected.title} /><div className="game-picker-copy"><h2>{selected.title}</h2><p>{selected.description}</p></div></div>
      <div className="game-picker-action">{error && <p className="chat-error" role="alert">{error}</p>}<button type="button" disabled={soon || busy} onClick={() => { if (selected.id !== 'gartic') onStart(selected.id) }}>{soon ? 'Coming soon' : busy ? 'Starting…' : 'Start game'}{!soon && <span aria-hidden="true">→</span>}</button></div>
    </article>
  </section>
}
