import { useRef, useState } from 'react'
import GameArtwork from '../components/ChatGameArtwork'
import '../stylesheets/ChatGames.css'
import '../stylesheets/Chatroom.css'
import './GameMenuPreview.css'

const games = [
  { id: 'chess', title: 'Chess', description: 'Challenge someone in the room. Take turns, plan your next move, and put their king in checkmate.' },
  { id: 'connect4', title: 'Connect 4', description: 'Drop a disc into the grid. Connect four in a row before your opponent does.' },
  { id: 'tictactoe', title: 'Tic tac toe', description: 'Pick a square and take your turn. Three in a row wins. Try to avoid another draw.' },
  { id: 'wordle', title: 'Wordle race', description: 'Same word, same six guesses. Race the room to solve it first without giving away your answer.' },
  { id: 'battleships', title: 'Battleships', description: 'Hide your fleet, call your shots, and sink their ships. Your opponent only sees what you hit.' },
  { id: 'uno', title: 'Uno', description: 'Match colours and numbers, throw down action cards, and get rid of your hand. Remember to call Uno.' },
  { id: 'gartic', title: 'Gartic Phone', description: 'Write a prompt, draw what you get, then guess the next drawing. Pass it around and see how far it goes.', soon: true },
]

const stuff = [
  ['Change username', '/nick'], ['Send an action', '/me'], ['Choose emoji', '/emoji'], ['Text style', '/format'],
  ['Upload files', '/upload'], ['Ask AI', '/ai'], ['Clear for you', '/clear'], ['Clear for everyone', '/bigahhclear'],
  ['Start a game', '/game'], ['Find a GIF', '/gif'],
]

export default function GameMenuPreview() {
  const [open, setOpen] = useState(true)
  const [gamesOpen, setGamesOpen] = useState(false)
  const [selected, setSelected] = useState(games[0])
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState('')
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const startItem = useRef<HTMLButtonElement>(null)
  const back = useRef<HTMLButtonElement>(null)

  function returnToStuff() {
    setGamesOpen(false)
    window.requestAnimationFrame(() => startItem.current?.focus({ preventScroll: true }))
  }

  return <>
    <header className="game-preview-header"><a href="/" aria-label="Back to main phi(l)">←</a><strong>phi(chat)</strong><span><i />1 online</span><button type="button" aria-label="Open menu">☰</button></header>
    <main className="chat-shell game-preview-shell" onPointerDown={event => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setOpen(false)
    }}>
      <section className="chat-room">
        <div className="chat-feed">{notice && <p className="game-preview-notice" role="status">{notice}</p>}</div>
        <div className="chat-composer">
          <div ref={menu} className="chat-composer-tools" onKeyDown={event => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            if (gamesOpen) returnToStuff()
            else { setOpen(false); trigger.current?.focus() }
          }}>
            <div className="chat-composer-buttons">
              <button type="button" aria-label="Text style">Aa</button>
              <button ref={trigger} type="button" aria-expanded={open} aria-controls="game-preview-menu" onClick={() => { setOpen(!open); if (!open) setGamesOpen(false) }}>stuff menu™</button>
              <button type="button" aria-label="Choose emoji">☺</button>
              <button type="button" className="chat-preview-toggle">Preview</button>
            </div>
            {open && <section id="game-preview-menu" className={`chat-tool-panel chat-stuff-menu game-picker${gamesOpen ? ' game-picker--games' : ''}`} aria-label="Stuff menu">
              <div className="game-picker-window">
                <div className="game-picker-track" onTransitionEnd={event => {
                  if (event.target === event.currentTarget && gamesOpen) back.current?.focus({ preventScroll: true })
                }}>
                  <div className="game-picker-stuff" inert={gamesOpen}>
                    {stuff.map(([label, command], i) => <div key={command}>
                      {i === 4 && <div className="chat-stuff-divider" />}
                      <button ref={command === '/game' ? startItem : undefined} type="button" className="chat-stuff-item" aria-label={`${label} (${command})`} aria-disabled={command === '/gif'} onClick={() => {
                        if (command === '/game') { setGamesOpen(true); setNotice('') }
                        else if (command !== '/gif') { setDraft(`${command} `); setOpen(false) }
                      }}>
                        <span className="chat-stuff-label" aria-hidden="true"><span className="chat-stuff-name">{label}</span><span className="chat-stuff-command">{command}</span></span>
                        {command === '/gif' && <small>soon</small>}
                      </button>
                    </div>)}
                  </div>
                  <nav className="game-picker-list" aria-label="Choose a game" inert={!gamesOpen} onKeyDown={event => {
                    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
                    event.preventDefault()
                    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
                    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
                    buttons[next]?.focus()
                  }}>
                    <button ref={back} type="button" className="game-picker-back" onClick={returnToStuff}>← Back</button>
                    {games.map(game => <button type="button" key={game.id} className="game-picker-option" aria-pressed={selected.id === game.id} onPointerEnter={() => setSelected(game)} onFocus={() => setSelected(game)} onClick={() => setSelected(game)}>
                      <span>{game.title}</span>{game.soon ? <small>soon</small> : <span aria-hidden="true">↗</span>}
                    </button>)}
                  </nav>
                </div>
              </div>
              <article className="game-picker-detail" aria-label="Game details" inert={!gamesOpen}>
                <div key={selected.id} className="game-picker-detail-content">
                  <GameArtwork game={selected.id} title={selected.title} />
                  <div className="game-picker-copy"><h2>{selected.title}</h2><p>{selected.description}</p></div>
                </div>
                <div className="game-picker-action"><button type="button" disabled={selected.soon} onClick={() => setNotice(`${selected.title} selected. This is a design preview; games aren't connected yet.`)}>{selected.soon ? 'Coming soon' : 'Start game'}{!selected.soon && <span aria-hidden="true">→</span>}</button></div>
              </article>
            </section>}
          </div>
          <textarea aria-label="Message" placeholder="Message" value={draft} onChange={event => setDraft(event.target.value)} />
          <footer className="chat-composer-footer"><span>Chatting as <button type="button">Codex</button><small>Enter to send · Shift + Enter for a new line</small></span><span>{draft.length} / 8,000</span><button type="button" className="chat-send" onClick={() => { setNotice('This is a design preview; messages stay on this page.'); setDraft('') }}>Send ↑</button></footer>
        </div>
      </section>
    </main>
  </>
}
