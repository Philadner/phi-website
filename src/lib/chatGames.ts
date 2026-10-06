export const UNO_DISCLAIMER = 'Uno is currently really shit. It’ll be fixed with the Gartic Phone update.'

export const CHAT_GAMES = [
  { id: 'chess', title: 'Chess', description: 'Challenge someone in the room. Take turns, plan your next move, and put their king in checkmate.' },
  { id: 'connect4', title: 'Connect 4', description: 'Drop a disc into the grid. Connect four in a row before your opponent does.' },
  { id: 'tictactoe', title: 'Tic tac toe', description: 'Pick a square and take your turn. Three in a row wins. Try to avoid another draw.' },
  { id: 'wordle', title: 'Wordle race', description: 'Same word, same six guesses. Race the room to solve it first without giving away your answer.' },
  { id: 'battleships', title: 'Battleships', description: 'Hide your fleet, call your shots, and sink their ships. Your opponent only sees what you hit.' },
  { id: 'uno', title: 'Uno', description: UNO_DISCLAIMER },
  { id: 'gartic', title: 'Gartic Phone', description: 'Write a prompt, draw what you get, then guess the next drawing. Pass it around and see how far it goes.', soon: true },
] as const
export type GameKind = Exclude<typeof CHAT_GAMES[number]['id'], 'gartic'>
export type Player = { id: string; name: string }
export type CardColor = 'red' | 'yellow' | 'green' | 'blue'
export const CARD_COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue']
export type UnoCard = { id: string; color: CardColor | 'wild'; value: string }
export type WordGuess = { word: string; marks: number[] }
export type GameView = {
  id: string; kind: GameKind; host: string; players: Player[]; status: 'waiting' | 'setup' | 'active' | 'done'; version: number
  turn: string; winner: string | null; reason: string; board: number[]; fen: string; moves: string[]
  ready: string[]; shots: Record<string, { cell: number; hit: boolean }[]>; counts: Record<string, number>
  top: UnoCard | null; color: CardColor; direction: number; drawn: string | null; uno: string[]; solution?: string; wordMarks: Record<string, number[][]>
}
export type GameResponse = { game: GameView; hand: UnoCard[]; fleet: number[]; guesses: WordGuess[] }
export function gameKind(value: string): GameKind | null {
  const normalized = value.toLowerCase().replace(/[\s_-]/g, '')
  const aliases: Record<string, GameKind> = { chess: 'chess', connect4: 'connect4', connectfour: 'connect4', tictactoe: 'tictactoe', ttt: 'tictactoe', wordle: 'wordle', wordlerace: 'wordle', battleships: 'battleships', battleship: 'battleships', uno: 'uno' }
  return aliases[normalized] || null
}

export async function gameRequest(body: Record<string, unknown> | string): Promise<GameResponse & { message?: import('./chat.js').ChatMessage }> {
  const response = await fetch(typeof body === 'string' ? `/api/chat-game?id=${encodeURIComponent(body)}` : '/api/chat-game', {
    method: typeof body === 'string' ? 'GET' : 'POST', cache: 'no-store',
    headers: typeof body === 'string' ? undefined : { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || 'Game could not load. Try again.')
  return data
}
