import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const commonUrl = dataUrl(compile(await readFile(new URL('../src/lib/chatGames.ts', import.meta.url), 'utf8')))
const engineSource = compile(await readFile(new URL('../api/_lib/chatGames.ts', import.meta.url), 'utf8')).replace("'chess.js'", JSON.stringify(import.meta.resolve('chess.js'))).replace("'../../src/lib/chatGames.js'", JSON.stringify(commonUrl))
const { createGame, applyMove, gameView, playerView, scoreGuess } = await import(dataUrl(engineSource))
const a = { id: 'a', name: 'Codex' }, b = { id: 'b', name: 'ChatGPT' }, c = { id: 'c', name: 'Spectator' }
const active = kind => applyMove(createGame(kind, a), b, { action: 'join' })
const move = (s, p, fields) => applyMove(s, p, { action: 'move', ...fields })
let tic = active('tictactoe')
assert.throws(() => move(tic, b, { cell: 0 }), /turn/)
assert.throws(() => move(tic, c, { cell: 0 }), /Join/)
for (const [p, cell] of [[a, 0], [b, 3], [a, 1], [b, 4], [a, 2]]) tic = move(tic, p, { cell })
assert.equal(tic.winner, 'a'); assert.equal(tic.status, 'done'); assert.throws(() => move(tic, b, { cell: 5 }), /finished/)
let draw = active('tictactoe')
for (const [i, cell] of [0, 1, 2, 4, 3, 5, 7, 6, 8].entries()) draw = move(draw, i % 2 ? b : a, { cell })
assert.equal(draw.reason, 'Draw')
let connect = active('connect4')
for (let i = 0; i < 3; i++) { connect = move(connect, a, { cell: 0 }); connect = move(connect, b, { cell: 1 }) }
connect = move(connect, a, { cell: 0 }); assert.equal(connect.winner, 'a')
let chess = active('chess')
assert.throws(() => move(chess, a, { from: 'e2', to: 'e5' }), /legal/)
for (const [p, from, to] of [[a, 'f2', 'f3'], [b, 'e7', 'e5'], [a, 'g2', 'g4'], [b, 'd8', 'h4']]) chess = move(chess, p, { from, to })
assert.equal(chess.reason, 'Checkmate'); assert.equal(chess.winner, 'b')
let word = active('wordle'); word = applyMove(word, a, { action: 'start' }); word.answer = 'apple'
assert.deepEqual(scoreGuess('allee', 'apple'), [2, 1, 0, 0, 2])
assert.throws(() => move(word, b, { word: 'zzzzz' }), /dictionary/)
word = move(word, b, { word: 'crane' })
assert.deepEqual(gameView(word).wordMarks.b, [word.guesses.b[0].marks])
assert.equal(JSON.stringify(gameView(word)).includes('crane'), false)
assert.equal(JSON.stringify(playerView(word, 'a')).includes('apple'), false)
assert.equal(playerView(word, 'c').guesses.length, 0)
word = move(word, a, { word: 'apple' }); assert.equal(word.winner, 'a'); assert.equal(gameView(word).solution, 'apple')
let ships = active('battleships')
const fleet = [[0, 1, 2, 3, 4], [10, 11, 12, 13], [20, 21, 22], [30, 31, 32], [40, 41]]
assert.throws(() => applyMove(ships, a, { action: 'place', ships: [[8, 9, 10, 11, 12], ...fleet.slice(1)] }), /straight/)
ships = applyMove(ships, a, { action: 'place', ships: fleet }); ships = applyMove(ships, b, { action: 'place', ships: fleet })
assert.equal(ships.status, 'active'); assert.equal(playerView(ships, 'c').fleet.length, 0); assert.equal('ships' in gameView(ships), false)
for (const [index, cell] of fleet.flat().entries()) { ships = move(ships, a, { cell }); if (ships.status !== 'done') ships = move(ships, b, { cell: 50 + index }) }
assert.equal(ships.winner, 'a')
let uno = active('uno'); uno = applyMove(uno, a, { action: 'start' })
assert.equal(uno.hands.a.length, 7); assert.equal(uno.deck.length + uno.discard.length + Object.values(uno.hands).flat().length, 108)
assert.equal('hands' in gameView(uno), false); assert.equal(playerView(uno, 'c').hand.length, 0)
uno.hands.a = [{ id: 'r7', color: 'red', value: '7' }, { id: 'wild4', color: 'wild', value: '+4' }]; uno.color = 'red'
assert.throws(() => move(uno, a, { cardId: 'wild4', color: 'blue' }), /only legal/)
uno = move(uno, a, { cardId: 'r7', callUno: false }); assert.equal(uno.hands.a.length, 3)
uno.turn = 'a'; uno.drawn = null; uno.hands.a = [{ id: 'last', color: 'wild', value: 'wild' }]
uno = move(uno, a, { cardId: 'last', color: 'blue' }); assert.equal(uno.winner, 'a')
console.log('Game checks passed: turns, spectators, win/draw, chess checkmate, duplicate-letter scoring, public guess colours, hidden words/fleets/hands, ship placement and Uno rules.')
