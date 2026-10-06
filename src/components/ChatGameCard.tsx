import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { CARD_COLORS, CHAT_GAMES, gameRequest } from '../lib/chatGames'
import type { CardColor, GameResponse, GameView } from '../lib/chatGames'
import type { ChatSession } from '../lib/chat'
import GameArtwork from './ChatGameArtwork'
import '../stylesheets/ChatGames.css'

const Chessboard = lazy(() => import('react-chessboard').then(module => ({ default: module.Chessboard })))
type Play = (move: Record<string, unknown>) => void

function ChessGame({ game, me, disabled, play }: { game: GameView; me?: string; disabled: boolean; play: Play }) {
  const [from, setFrom] = useState<string | null>(null)
  const [promotion, setPromotion] = useState('q')
  const black = game.players[1]?.id === me
  return <><div className="chat-game-chess"><Suspense fallback={<p>Loading board…</p>}><Chessboard options={{ id: `chess-${game.id}`, position: game.fen, boardOrientation: black ? 'black' : 'white', allowDragging: !disabled, allowDrawingArrows: true, canDragPiece: ({ piece }) => !disabled && piece.pieceType.startsWith(black ? 'b' : 'w'), darkSquareStyle: { backgroundColor: '#5e5b4e' }, lightSquareStyle: { backgroundColor: '#c1bda7' }, boardStyle: { borderRadius: 0 }, squareStyles: from ? { [from]: { backgroundColor: '#bb9e39' } } : {}, onPieceDrop: ({ sourceSquare, targetSquare }) => { if (!disabled && targetSquare) { play({ action: 'move', from: sourceSquare, to: targetSquare, promotion }); setFrom(null) }; return false }, onSquareClick: ({ square, piece }) => { if (disabled) return; if (!from || piece?.pieceType.startsWith(black ? 'b' : 'w')) setFrom(square); else { play({ action: 'move', from, to: square, promotion }); setFrom(null) } } }} /></Suspense></div>
    <label className="chat-game-control">Promotion <select value={promotion} onChange={e => setPromotion(e.target.value)}><option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option></select></label>
    {game.moves.length > 0 && <p className="chat-game-moves">{game.moves.slice(-12).join(' · ')}</p>}</>
}

function WordleGame({ data, me, disabled, play }: { data: GameResponse; me?: string; disabled: boolean; play: Play }) {
  const [word, setWord] = useState('')
  return <><div className="chat-wordle-grid" aria-label="Your guesses">{Array.from({ length: 6 }, (_, row) => <div key={row}>{Array.from({ length: 5 }, (_, col) => <span key={col} data-mark={data.guesses[row]?.marks[col] ?? -1} aria-label={data.guesses[row] ? `${data.guesses[row].word[col]}: ${['absent', 'present', 'correct'][data.guesses[row].marks[col]]}` : 'Empty'}>{data.guesses[row]?.word[col] || ''}</span>)}</div>)}</div>
    <form className="chat-wordle-input" onSubmit={e => { e.preventDefault(); if (word.length === 5) { play({ action: 'move', word }); setWord('') } }}><input aria-label="Wordle guess" placeholder="Five-letter word" value={word} maxLength={5} onChange={e => setWord(e.target.value.replace(/[^a-z]/gi, '').toLowerCase())} disabled={disabled || data.guesses.length >= 6} autoComplete="off" /><button disabled={disabled || word.length !== 5 || data.guesses.length >= 6}>Guess</button></form>
    <div className="chat-wordle-opponents">{data.game.players.filter(p => p.id !== me).map(p => <div key={p.id}><strong>{p.name}</strong>{(data.game.wordMarks[p.id] || []).length ? data.game.wordMarks[p.id].map((marks, row) => <div key={row} aria-label={`${p.name}, guess ${row + 1}`} className="chat-wordle-colours">{marks.map((mark, col) => <span key={col} data-mark={mark} aria-label={['absent', 'present', 'correct'][mark]} />)}</div>) : <span className="chat-game-muted">0 / 6</span>}</div>)}</div>
    {data.game.solution && <p>Word: <strong>{data.game.solution.toUpperCase()}</strong></p>}</>
}

function BattleshipsGame({ data, me, busy, play }: { data: GameResponse; me?: string; busy: boolean; play: Play }) {
  const [ships, setShips] = useState<number[][]>([])
  const [vertical, setVertical] = useState(false)
  const [error, setError] = useState('')
  const g = data.game
  const ready = !!me && g.ready.includes(me)
  const fleet = ready ? data.fleet : ships.flat()
  const incoming = g.shots[g.players.find(p => p.id !== me)?.id || ''] || []
  const outgoing = g.shots[me || ''] || []
  const participant = g.players.some(p => p.id === me)
  function place(square: number) {
    if (ships.length === 5 || ready || busy || !participant) return
    const length = [5, 4, 3, 3, 2][ships.length]
    const ship = Array.from({ length }, (_, i) => square + i * (vertical ? 10 : 1))
    if (ship.some(n => n >= 100 || !vertical && Math.floor(n / 10) !== Math.floor(square / 10) || fleet.includes(n))) { setError('That ship overlaps or goes off the board.'); return }
    setShips([...ships, ship]); setError('')
  }
  return <>
    {g.status === 'setup' && participant && !ready && <div className="chat-game-controls"><span>Place ship {Math.min(ships.length + 1, 5)} / 5{ships.length < 5 ? ` (${[5, 4, 3, 3, 2][ships.length]} squares)` : ''}</span><button type="button" onClick={() => setVertical(!vertical)}>{vertical ? 'Vertical ↕' : 'Horizontal ↔'}</button><button type="button" disabled={busy || !ships.length} onClick={() => setShips(ships.slice(0, -1))}>Undo</button><button type="button" disabled={busy || ships.length !== 5} onClick={() => play({ action: 'place', ships })}>Ready</button></div>}
    {ready && g.status === 'setup' && <p className="chat-game-muted">Waiting for the other fleet.</p>}
    <div className="chat-battleship-boards">
      {participant && <div><h4>Your fleet</h4><div className="chat-battleship-grid">{Array.from({ length: 100 }, (_, n) => { const hit = incoming.find(shot => shot.cell === n); return <button type="button" key={n} aria-label={`Place ship at ${String.fromCharCode(65 + n % 10)}${Math.floor(n / 10) + 1}`} data-ship={fleet.includes(n)} data-hit={hit?.hit} disabled={g.status !== 'setup' || ready || busy} onClick={() => place(n)}>{hit ? hit.hit ? '×' : '·' : ''}</button> })}</div></div>}
      <div><h4>{participant ? 'Their waters' : 'Shots fired'}</h4><div className="chat-battleship-grid">{Array.from({ length: 100 }, (_, n) => { const shot = outgoing.find(shot => shot.cell === n) || (!participant ? Object.values(g.shots).flat().find(shot => shot.cell === n) : undefined); return <button type="button" key={n} aria-label={`Fire at ${String.fromCharCode(65 + n % 10)}${Math.floor(n / 10) + 1}`} data-hit={shot?.hit} disabled={busy || !participant || g.status !== 'active' || g.turn !== me || !!shot} onClick={() => play({ action: 'move', cell: n })}>{shot ? shot.hit ? '×' : '·' : ''}</button> })}</div></div>
    </div>{error && <p className="chat-error" role="alert">{error}</p>}
  </>
}

function UnoGame({ data, disabled, play }: { data: GameResponse; disabled: boolean; play: Play }) {
  const [color, setColor] = useState<CardColor>('red')
  const [callUno, setCallUno] = useState(false)
  const g = data.game
  return <><div className="chat-uno-top"><span className="chat-uno-card" data-color={g.top?.color}>{g.top?.value}</span><span>Current colour: <strong data-color={g.color}>{g.color}</strong><br /><small>{g.direction === 1 ? 'Clockwise →' : '← Anticlockwise'}</small></span></div>
    <div className="chat-game-controls"><label>Wild colour <select aria-label="Wild card colour" value={color} onChange={e => setColor(e.target.value as CardColor)}>{CARD_COLORS.map(color => <option key={color}>{color}</option>)}</select></label>{data.hand.length === 2 && <label><input type="checkbox" checked={callUno} onChange={e => setCallUno(e.target.checked)} />Call Uno</label>}<button type="button" disabled={disabled || !!g.drawn} onClick={() => play({ action: 'move', draw: true })}>Draw</button><button type="button" disabled={disabled || !g.drawn} onClick={() => play({ action: 'move', pass: true })}>Pass</button></div>
    <div className="chat-uno-hand" aria-label="Your hand">{data.hand.map(card => <button type="button" className="chat-uno-card" key={card.id} data-color={card.color} aria-label={`Play ${card.color} ${card.value}`} disabled={disabled || !!g.drawn && card.id !== data.hand[data.hand.length - 1]?.id || card.color !== 'wild' && card.color !== g.color && card.value !== g.top?.value} onClick={() => { play({ action: 'move', cardId: card.id, color, callUno }); setCallUno(false) }}>{card.value}</button>)}</div>
    <p className="chat-game-muted">No stacking. Miss calling Uno: draw two. Wild +4 requires no card of the current colour.</p></>
}

export default function ChatGameCard({ id, session }: { id: string; session: ChatSession | null }) {
  const [data, setData] = useState<GameResponse | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const requestSequence = useRef(0)
  const mutating = useRef(false)
  const refresh = useCallback(async () => {
    if (mutating.current) return
    const sequence = ++requestSequence.current
    try { const result = await gameRequest(id); if (sequence === requestSequence.current) { setData(result); setError('') } }
    catch (reason) { if (sequence === requestSequence.current) setError(reason instanceof Error ? reason.message : 'Game could not load.') }
  }, [id])
  useEffect(() => {
    const sequenceRef = requestSequence
    void refresh()
    const changed = (event: Event) => { if ((event as CustomEvent<string>).detail === id) void refresh() }
    window.addEventListener('chat-game-update', changed)
    window.addEventListener('focus', refresh)
    return () => { sequenceRef.current++; window.removeEventListener('chat-game-update', changed); window.removeEventListener('focus', refresh) }
  }, [id, session?.id, refresh])
  useEffect(() => {
    if (data?.game.status === 'done') return
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 15000)
    return () => window.clearInterval(timer)
  }, [data?.game.status, refresh])
  async function play(move: Record<string, unknown>) {
    if (mutating.current || !data || !session) return
    mutating.current = true; requestSequence.current++; setBusy(true); setError('')
    try { setData(await gameRequest({ action: 'play', id, version: data.game.version, move })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Move could not finish.'); void gameRequest(id).then(setData).catch(() => {}) }
    finally { mutating.current = false; setBusy(false) }
  }
  if (!data) return <section className="chat-game-card"><p>{error || 'Loading game…'}</p></section>
  const g = data.game
  const me = session?.id
  const member = g.players.some(p => p.id === me)
  const title = CHAT_GAMES.find(game => game.id === g.kind)!.title
  const disabled = busy || !member || g.status !== 'active' || g.kind !== 'wordle' && g.turn !== me
  const winner = g.players.find(p => p.id === g.winner)?.name
  return <section className="chat-game-card" aria-label={`${title} game`}>
    <header><h3>{title}</h3><span>{g.status === 'done' ? winner ? `${winner} wins` : g.reason : g.status === 'waiting' ? 'Waiting for players' : g.status === 'setup' ? 'Place your fleet' : g.kind === 'wordle' ? 'Race on' : `${g.players.find(p => p.id === g.turn)?.name}'s turn`}</span></header>
    <div className="chat-game-players">{g.players.map((p, i) => <span key={p.id} className={g.turn === p.id && g.status === 'active' && g.kind !== 'wordle' ? 'chat-game-current' : ''}>{g.kind === 'chess' ? i === 0 ? '♙ ' : '♟ ' : g.kind === 'tictactoe' ? i === 0 ? '× ' : '○ ' : ''}{p.name}{g.kind === 'uno' && g.status !== 'waiting' ? ` · ${g.counts[p.id]} cards${g.uno.includes(p.id) ? ' · UNO!' : ''}` : ''}</span>)}</div>
    {g.status === 'waiting' ? <><GameArtwork game={g.kind} title={title} /><div className="chat-game-controls">{session && !member && <button type="button" disabled={busy} onClick={() => void play({ action: 'join' })}>Join game</button>}{me === g.host && (g.kind === 'uno' || g.kind === 'wordle') && <button type="button" disabled={busy || g.players.length < 2} onClick={() => void play({ action: 'start' })}>Start round</button>}{member && <button type="button" disabled={busy} onClick={() => void play({ action: 'leave' })}>{me === g.host ? 'Cancel game' : 'Leave lobby'}</button>}{!session && <span>Choose a username to join.</span>}</div></> : <div className="chat-game-body">
      {g.kind === 'chess' && <ChessGame game={g} me={me} disabled={disabled} play={move => void play(move)} />}
      {(g.kind === 'tictactoe' || g.kind === 'connect4') && <div className={`chat-simple-board chat-simple-board--${g.kind}`}>{g.kind === 'connect4' && Array.from({ length: 7 }, (_, col) => <button className="chat-connect-drop" type="button" key={`drop-${col}`} aria-label={`Drop in column ${col + 1}`} disabled={disabled || !!g.board[col]} onClick={() => void play({ action: 'move', cell: col })}>↓</button>)}{g.board.map((value, n) => g.kind === 'tictactoe' ? <button type="button" key={n} aria-label={`Square ${n + 1}${value ? value === 1 ? ', X' : ', O' : ''}`} data-player={value} disabled={disabled || !!value} onClick={() => void play({ action: 'move', cell: n })}>{value === 1 ? '×' : value === 2 ? '○' : ''}</button> : <span key={n} className="chat-connect-disc" data-player={value} />)}</div>}
      {g.kind === 'wordle' && <WordleGame data={data} me={me} disabled={disabled} play={move => void play(move)} />}
      {g.kind === 'battleships' && <BattleshipsGame data={data} me={me} busy={busy} play={move => void play(move)} />}
      {g.kind === 'uno' && <UnoGame data={data} disabled={disabled} play={move => void play(move)} />}
      {g.status === 'done' && g.reason && <p className="chat-game-muted">{g.reason}</p>}
      {g.status !== 'done' && member && <button type="button" className="chat-game-resign" disabled={busy} onClick={() => void play({ action: 'leave' })}>Resign</button>}
    </div>}
    {error && <p className="chat-error" role="alert">{error}</p>}
  </section>
}
