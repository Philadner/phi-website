import { useEffect, useRef } from 'react'
import ChatGamePicker from './ChatGamePicker'
import type { GameKind } from '../lib/chatGames'

type Props = {
  formattingOpen: boolean
  setFormattingOpen: (open: boolean) => void
  stuffOpen: boolean
  setStuffOpen: (open: boolean) => void
  preview: boolean
  setPreview: (open: boolean) => void
  insert: (before: string, after?: string, placeholder?: string) => void
  insertCommand: (command: string) => void
  changeName: () => void
  openEmoji: () => void
  openFiles: () => void
  openGif: () => void
  gamesOpen: boolean
  setGamesOpen: (open: boolean) => void
  startGame: (kind: GameKind) => void
  gameBusy: boolean
  gameError: string
}

function StuffLabel({ label, command }: { label: string; command: string }) {
  return <span className="chat-stuff-label" aria-hidden="true"><span className="chat-stuff-name">{label}</span><span className="chat-stuff-command">{command}</span></span>
}

export default function ChatComposerTools({ formattingOpen, setFormattingOpen, stuffOpen, setStuffOpen, preview, setPreview, insert, insertCommand, changeName, openEmoji, openFiles, openGif, gamesOpen, setGamesOpen, startGame, gameBusy, gameError }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const styleButton = useRef<HTMLButtonElement>(null)
  const stuffButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!formattingOpen && !stuffOpen) return
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setFormattingOpen(false)
        setStuffOpen(false)
      }
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [formattingOpen, stuffOpen, setFormattingOpen, setStuffOpen])

  useEffect(() => {
    if (stuffOpen) {
      root.current?.querySelector<HTMLButtonElement>('.chat-stuff-item')?.focus()
    }
  }, [stuffOpen])

  function choose(action: () => void) {
    setStuffOpen(false)
    action()
  }

  return <div ref={root} className="chat-composer-tools" onKeyDown={(event) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    if (stuffOpen) stuffButton.current?.focus()
    else if (formattingOpen) styleButton.current?.focus()
    setStuffOpen(false)
    setFormattingOpen(false)
  }}>
    <div className="chat-composer-buttons">
      <button ref={styleButton} type="button" aria-label="Text style" aria-expanded={formattingOpen} aria-controls="chat-formatting" onClick={() => { setFormattingOpen(!formattingOpen); setStuffOpen(false) }}>Aa</button>
      <button ref={stuffButton} type="button" aria-expanded={stuffOpen} aria-controls="chat-stuff-menu" onClick={() => { setStuffOpen(!stuffOpen); setFormattingOpen(false); setGamesOpen(false) }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setStuffOpen(true); setFormattingOpen(false); setGamesOpen(false) } }}>stuff menu™</button>
      <button type="button" aria-label="Choose emoji" onClick={openEmoji}>☺</button>
      <button type="button" className="chat-preview-toggle" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
    </div>
    {formattingOpen && <section id="chat-formatting" className="chat-tool-panel chat-formatting-panel" aria-label="Text style controls">
      <div className="chat-formatting-row">
        <button type="button" title="Bold" aria-label="Bold" onClick={() => insert('**', '**', 'bold')}><b>B</b></button>
        <button type="button" title="Italic" aria-label="Italic" onClick={() => insert('*', '*', 'italic')}><i>I</i></button>
        <button type="button" title="Strikethrough" aria-label="Strikethrough" onClick={() => insert('~~', '~~', 'strike')}><s>S</s></button>
        <button type="button" title="Inline code" aria-label="Inline code" onClick={() => insert('`', '`', 'code')}>{'< >'}</button>
        <select aria-label="Heading style" value="" onChange={(event) => insert(`\n${event.target.value} `, '\n', 'Heading')}><option value="" disabled>Heading</option><option value="#">Heading 1</option><option value="##">Heading 2</option><option value="###">Heading 3</option></select>
        <select aria-label="Font for selected text" value="" onChange={(event) => insert(':font[', `]{family=${event.target.value}}`, 'your text')}><option value="" disabled>Font</option><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Monospace</option><option value="handwritten">Handwritten</option><option value="display">Display</option></select>
      </div>
      <div className="chat-formatting-row">
        <button type="button" onClick={() => insert('\n- ', '\n', 'list item')}>List</button>
        <button type="button" onClick={() => insert('\n> ', '\n', 'quote')}>Quote</button>
        <button type="button" onClick={() => insert('[', '](https://example.com)', 'link text')}>Link</button>
        <button type="button" aria-label="Code block" onClick={() => insert('\n```\n', '\n```\n', 'code')}>Code block</button>
      </div>
    </section>}
    {stuffOpen && <ChatGamePicker gamesOpen={gamesOpen} setGamesOpen={setGamesOpen} onStart={startGame} busy={gameBusy} error={gameError}>{openGames => <div onKeyDown={(event) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.chat-stuff-item')]
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      buttons[next]?.focus()
    }}>
      <button type="button" className="chat-stuff-item" aria-label="Change username (/nick)" onClick={() => choose(changeName)}><StuffLabel label="Change username" command="/nick" /></button>
      <button type="button" className="chat-stuff-item" aria-label="Send an action (/me)" onClick={() => choose(() => insertCommand('/me '))}><StuffLabel label="Send an action" command="/me" /></button>
      <button type="button" className="chat-stuff-item" aria-label="Choose emoji (/emoji)" onClick={() => choose(openEmoji)}><StuffLabel label="Choose emoji" command="/emoji" /></button>
      <button type="button" className="chat-stuff-item" aria-label="Text style (/format)" onClick={() => choose(() => setFormattingOpen(true))}><StuffLabel label="Text style" command="/format" /></button>
      <div className="chat-stuff-divider" />
      <button type="button" className="chat-stuff-item" aria-label="Upload files (/upload)" onClick={() => choose(openFiles)}><StuffLabel label="Upload files" command="/upload" /></button>
      <button type="button" className="chat-stuff-item" aria-label="Ask AI (/ai)" onClick={() => choose(() => insertCommand('/ai '))}><StuffLabel label="Ask AI" command="/ai" /></button>
      <button type="button" className="chat-stuff-item" aria-label="Clear for you (/clear)" onClick={() => choose(() => insertCommand('/clear'))}><StuffLabel label="Clear for you" command="/clear" /></button>
      <button type="button" className="chat-stuff-item" aria-label="Clear for everyone (/bigahhclear)" onClick={() => choose(() => insertCommand('/bigahhclear'))}><StuffLabel label="Clear for everyone" command="/bigahhclear" /></button>
      <button type="button" data-game-start className="chat-stuff-item" aria-label="Start a game (/game)" onClick={openGames}><StuffLabel label="Start a game" command="/game" /></button>
      <button type="button" className="chat-stuff-item" aria-label="Find a GIF (/gif)" onClick={() => choose(openGif)}><StuffLabel label="Find a GIF" command="/gif" /></button>
    </div>}</ChatGamePicker>}
  </div>
}
