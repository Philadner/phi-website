import { randomInt, randomUUID } from 'node:crypto'
import { Chess } from 'chess.js'
import { CARD_COLORS } from '../../src/lib/chatGames.js'
import type { CardColor, GameKind, GameResponse, GameView, Player, UnoCard, WordGuess } from '../../src/lib/chatGames.js'

export type GameState = Omit<GameView, 'shots'> & { shots: Record<string, number[]>; answer: string; guesses: Record<string, WordGuess[]>; ships: Record<string, number[]>; deck: UnoCard[]; hands: Record<string, UnoCard[]>; discard: UnoCard[]; startedAt: number }
type Move = Record<string, unknown>
const solutions = 'apple beach brain bread brick chair charm chest cloud crane dance dream drink earth flame flesh float flood floor focus fresh frost fruit ghost glass globe grace grain grape grass green happy heart horse house ideal image index inner juice knife lemon light magic mango maple match metal money month mouse mouth movie music night nurse ocean olive onion order other paint paper party peach pearl phase phone piano piece pilot place plain plane plant plate point pound power pride prime prize proof queen quiet quick radio rainy range reach react river roast robin robot rough round route royal sauce scale scene scope score sense serve seven shade shake shape share shark sheep shell shine shirt shock shore short sight skill sleep slice smile smoke snack snake solar solid sound space spare speak speed spice split sport spray squad stage stair stand start state steam steel stick stone store storm story stove sugar sunny sweet table taste teach thank thick thing think three tiger title toast today tooth touch tower track trade trail train treat trend trial tribe trick truck trust truth twice under uncle union unity until upper urban usual value video visit voice waste watch water whale wheat wheel where white whole woman world worry worth write wrong young zebra'.split(' ')
function ensure(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }
function shuffle<T>(items: T[]) { for (let i = items.length - 1; i > 0; i--) { const j = randomInt(i + 1); [items[i], items[j]] = [items[j], items[i]] } return items }
export function createGame(kind: GameKind, host: Player, id = randomUUID()): GameState {
  return { id, kind, host: host.id, players: [host], status: 'waiting', version: 0, turn: host.id, winner: null, reason: '', board: Array(kind === 'connect4' ? 42 : 9).fill(0), fen: new Chess().fen(), moves: [], ready: [], shots: {}, counts: {}, top: null, color: 'red', direction: 1, drawn: null, uno: [], wordMarks: {}, answer: '', guesses: {}, ships: {}, deck: [], hands: {}, discard: [], startedAt: 0 }
}
export function gameView(s: GameState): GameView {
  const { id, kind, host, players, status, version, turn, winner, reason, board, fen, moves, ready, color, direction, drawn, uno } = s
  const shots: GameView['shots'] = {}
  for (const player of players) shots[player.id] = (s.shots[player.id] || []).map(cell => ({ cell, hit: (s.ships[players.find(p => p.id !== player.id)?.id || ''] || []).includes(cell) }))
  return { id, kind, host, players, status, version, turn, winner, reason, board, fen, moves, ready, shots, color, direction, drawn: drawn ? turn : null, uno,
    counts: Object.fromEntries(players.map(p => [p.id, kind === 'uno' ? (s.hands[p.id] || []).length : kind === 'wordle' ? (s.guesses[p.id] || []).length : 0])),
    wordMarks: kind === 'wordle' ? Object.fromEntries(players.map(p => [p.id, (s.guesses[p.id] || []).map(g => g.marks)])) : {},
    top: s.discard.at(-1) || null, ...(kind === 'wordle' && status === 'done' ? { solution: s.answer } : {}),
  }
}
export function playerView(s: GameState, id?: string): GameResponse {
  const member = id && s.players.some(p => p.id === id) ? id : ''
  return { game: gameView(s), hand: s.hands[member] || [], fleet: s.ships[member] || [], guesses: s.guesses[member] || [] }
}
function finish(s: GameState, winner: string | null, reason: string) { s.status = 'done'; s.winner = winner; s.reason = reason }
function nextPlayer(s: GameState, steps = 1) { const index = s.players.findIndex(p => p.id === s.turn); s.turn = s.players[(index + steps * s.direction + s.players.length * 3) % s.players.length].id; s.drawn = null }
function draw(s: GameState, id: string, count: number) {
  for (let i = 0; i < count; i++) {
    if (!s.deck.length && s.discard.length > 1) { const top = s.discard.pop()!; s.deck = shuffle(s.discard); s.discard = [top] }
    const card = s.deck.pop()
    if (card) s.hands[id].push(card)
  }
  s.uno = s.uno.filter(p => p !== id)
}
function start(s: GameState) {
  s.startedAt = Date.now()
  s.status = s.kind === 'battleships' ? 'setup' : 'active'
  if (s.kind === 'wordle') s.answer = solutions[randomInt(solutions.length)]
  if (s.kind !== 'uno') return
  const deck: UnoCard[] = []
  for (const color of CARD_COLORS) {
    for (const value of ['0', ...Array.from({ length: 9 }, (_, i) => String(i + 1)).flatMap(v => [v, v]), ...['skip', 'reverse', '+2'].flatMap(v => [v, v])]) deck.push({ id: randomUUID(), color, value })
  }
  for (let i = 0; i < 4; i++) for (const value of ['wild', '+4']) deck.push({ id: randomUUID(), color: 'wild', value })
  s.deck = shuffle(deck)
  for (const p of s.players) { s.hands[p.id] = []; draw(s, p.id, 7) }
  // Begin with a number card; action cards remain in the draw pile.
  const topIndex = s.deck.findIndex(card => /^\d$/.test(card.value))
  s.discard = [s.deck.splice(topIndex, 1)[0]]
  s.color = s.discard[0].color as CardColor
}
export function scoreGuess(word: string, answer: string) {
  const marks = Array<number>(5).fill(0)
  const remaining = [...answer]
  for (let i = 0; i < 5; i++) if (word[i] === answer[i]) { marks[i] = 2; remaining[i] = '' }
  for (let i = 0; i < 5; i++) if (!marks[i]) { const at = remaining.indexOf(word[i]); if (at >= 0) { marks[i] = 1; remaining[at] = '' } }
  return marks
}
function cell(move: Move, max: number) { ensure(Number.isInteger(move.cell) && Number(move.cell) >= 0 && Number(move.cell) < max, 'Choose a square on the board.'); return Number(move.cell) }
function alignedWin(board: number[], width: number, height: number, length: number, mark: number) {
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
    if (Array.from({ length }, (_, k) => { const nx = x + dx * k; const ny = y + dy * k; return nx >= 0 && nx < width && ny >= 0 && ny < height && board[ny * width + nx] === mark }).every(Boolean)) return true
  }
  return false
}
export function applyMove(original: GameState, actor: Player, move: Move, validWord: (word: string) => boolean = word => solutions.includes(word)): GameState {
  const s = structuredClone(original)
  ensure(s.status !== 'done', 'This game has finished.')
  const member = s.players.some(p => p.id === actor.id)
  const multiplayer = s.kind === 'wordle' || s.kind === 'uno'
  if (move.action === 'join') {
    ensure(s.status === 'waiting', 'This game has already started.')
    ensure(!member, 'You are already in this game.')
    ensure(s.players.length < (multiplayer ? 8 : 2), 'This game is full.')
    s.players.push(actor)
    if (!multiplayer) start(s)
  } else {
    ensure(member, 'Join this game first.')
    if (move.action === 'leave') {
      if (s.status === 'waiting' && actor.id !== s.host) s.players = s.players.filter(p => p.id !== actor.id)
      else finish(s, s.players.length === 2 ? s.players.find(p => p.id !== actor.id)!.id : null, actor.id === s.host && s.status === 'waiting' ? 'Cancelled' : `${actor.name} left the game`)
    } else if (move.action === 'start') {
      ensure(actor.id === s.host && s.status === 'waiting' && multiplayer, 'Only the host can start this lobby.')
      ensure(s.players.length >= 2, 'Wait for at least one other player.')
      start(s)
    } else if (move.action === 'place' && s.kind === 'battleships') {
      ensure(s.status === 'setup' && !s.ready.includes(actor.id), 'Your fleet is already locked in.')
      ensure(Array.isArray(move.ships) && move.ships.length === 5, 'Place all five ships.')
      const occupied: number[] = []
      for (const [index, ship] of move.ships.entries()) {
        ensure(Array.isArray(ship) && ship.length === [5, 4, 3, 3, 2][index], 'Ship sizes must be 5, 4, 3, 3 and 2.')
        ensure(ship.every(n => Number.isInteger(n) && n >= 0 && n < 100), 'Keep your fleet inside the board.')
        const sorted = [...ship].sort((a, b) => a - b)
        ensure(sorted.every((n, i) => !i || n - sorted[i - 1] === 10) || sorted.every((n, i) => Math.floor(n / 10) === Math.floor(sorted[0] / 10) && (!i || n - sorted[i - 1] === 1)), 'Ships must be straight and contiguous.')
        occupied.push(...sorted)
      }
      ensure(new Set(occupied).size === 17, 'Ships cannot overlap.')
      s.ships[actor.id] = occupied
      s.ready.push(actor.id)
      if (s.ready.length === 2) s.status = 'active'
    } else {
      ensure(s.status === 'active', 'Wait for the game to start.')
      ensure(move.action === 'move', 'Invalid game action.')
      if (s.kind === 'wordle') {
        ensure(Date.now() - s.startedAt < 10 * 60 * 1000, 'This race has timed out.')
        ensure(typeof move.word === 'string' && /^[a-zA-Z]{5}$/.test(move.word), 'Enter a five-letter word.')
        const word = move.word.toLowerCase()
        ensure(validWord(word), 'That word is not in the dictionary.')
        const guesses = s.guesses[actor.id] ||= []
        ensure(guesses.length < 6, 'You have used all six guesses.')
        guesses.push({ word, marks: scoreGuess(word, s.answer) })
        if (word === s.answer) finish(s, actor.id, 'Solved first')
        else if (s.players.every(p => (s.guesses[p.id] || []).length === 6)) finish(s, null, 'No one solved it')
      } else {
        ensure(s.turn === actor.id, 'Wait for your turn.')
        const mark = s.players.findIndex(p => p.id === actor.id) + 1
        if (s.kind === 'chess') {
          ensure(typeof move.from === 'string' && typeof move.to === 'string' && /^[a-h][1-8]$/.test(move.from) && /^[a-h][1-8]$/.test(move.to), 'Choose valid chess squares.')
          ensure(move.promotion === undefined || ['q', 'r', 'b', 'n'].includes(String(move.promotion)), 'Invalid promotion piece.')
          const chess = new Chess()
          for (const san of s.moves) chess.move(san)
          try { const result = chess.move({ from: move.from, to: move.to, promotion: String(move.promotion || 'q') }); s.moves.push(result.san) } catch { throw new Error('That chess move is not legal.') }
          s.fen = chess.fen()
          if (chess.isCheckmate()) finish(s, actor.id, 'Checkmate')
          else if (chess.isGameOver()) finish(s, null, 'Draw')
          else s.reason = chess.isCheck() ? 'Check' : ''
          nextPlayer(s)
        } else if (s.kind === 'connect4' || s.kind === 'tictactoe') {
          let square = cell(move, s.kind === 'connect4' ? 7 : 9)
          if (s.kind === 'connect4') { const column = square; square = -1; for (let row = 5; row >= 0; row--) if (!s.board[row * 7 + column]) { square = row * 7 + column; break }; ensure(square >= 0, 'That column is full.') }
          ensure(!s.board[square], 'That square is already taken.')
          s.board[square] = mark
          if (alignedWin(s.board, s.kind === 'connect4' ? 7 : 3, s.kind === 'connect4' ? 6 : 3, s.kind === 'connect4' ? 4 : 3, mark)) finish(s, actor.id, 'Won')
          else if (s.board.every(Boolean)) finish(s, null, 'Draw')
          nextPlayer(s)
        } else if (s.kind === 'battleships') {
          const square = cell(move, 100)
          const shots = s.shots[actor.id] ||= []
          ensure(!shots.includes(square), 'You already fired at that square.')
          shots.push(square)
          const opponent = s.players.find(p => p.id !== actor.id)!
          if (s.ships[opponent.id].every(n => shots.includes(n))) finish(s, actor.id, 'Fleet sunk')
          nextPlayer(s)
        } else if (s.kind === 'uno') {
          const hand = s.hands[actor.id]
          if (move.draw === true) {
            ensure(!s.drawn, 'Play the drawn card or pass.')
            const before = hand.length
            draw(s, actor.id, 1)
            if (hand.length > before) s.drawn = hand.at(-1)!.id
            else nextPlayer(s)
          } else if (move.pass === true) {
            ensure(s.drawn, 'Draw a card before passing.')
            nextPlayer(s)
          } else {
            const at = hand.findIndex(card => card.id === move.cardId)
            ensure(at >= 0, 'Choose a card from your hand.')
            const card = hand[at]
            ensure(!s.drawn || s.drawn === card.id, 'Only the card you just drew may be played.')
            const top = s.discard.at(-1)!
            ensure(card.color === 'wild' || card.color === s.color || card.value === top.value, 'Match the colour or value, or play a wild card.')
            if (card.color === 'wild') {
              ensure(CARD_COLORS.includes(move.color as CardColor), 'Choose the next colour.')
              if (card.value === '+4') ensure(!hand.some(c => c.color === s.color), 'Wild +4 is only legal without a card matching the current colour.')
            }
            hand.splice(at, 1)
            s.discard.push(card)
            s.color = card.color === 'wild' ? move.color as CardColor : card.color
            s.uno = s.uno.filter(id => id !== actor.id)
            if (hand.length === 1) { if (move.callUno === true) s.uno.push(actor.id); else draw(s, actor.id, 2) }
            if (!hand.length) finish(s, actor.id, 'All cards played')
            if (card.value === 'reverse') s.direction *= -1
            const penalty = card.value === '+2' ? 2 : card.value === '+4' ? 4 : 0
            if (penalty) { nextPlayer(s); draw(s, s.turn, penalty); nextPlayer(s) }
            else nextPlayer(s, card.value === 'skip' || card.value === 'reverse' && s.players.length === 2 ? 2 : 1)
          }
        }
      }
    }
  }
  s.version++
  return s
}
