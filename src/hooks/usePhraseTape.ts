import { useCallback, useEffect, useRef, useState } from 'react'
import { RADIUS, shuffle } from '../lib/homeWheel'

// Phrases drawn beyond the visible rows so scrolling never reveals a blank.
const BUFFER = RADIUS + 4
// Bound the infinite tape while retaining ample scroll history.
const HISTORY = 100

// Maps wheel indices to phrases drawn from a shuffled deck. A new deck never
// starts with the phrase the previous deck ended on.
export function usePhraseTape(phrases: string[], active: boolean, centre: number) {
  const deck = useRef<string[]>([])
  const lastPhrase = useRef('')
  const tape = useRef(new Map<number, string>())
  const [phraseTape, setPhraseTape] = useState(new Map<number, string>())

  const draw = useCallback(() => {
    if (!deck.current.length) {
      deck.current = shuffle(phrases)
      const end = deck.current.length - 1
      if (end > 0 && deck.current[end] === lastPhrase.current) {
        ;[deck.current[0], deck.current[end]] = [deck.current[end], deck.current[0]]
      }
    }
    const phrase = deck.current.pop() ?? 'phi'
    lastPhrase.current = phrase
    return phrase
  }, [phrases])

  // New phrases: start a fresh tape around the origin.
  useEffect(() => {
    deck.current = []
    lastPhrase.current = ''
    const next = new Map<number, string>()
    for (let index = -BUFFER; index <= BUFFER; index++) next.set(index, draw())
    tape.current = next
    setPhraseTape(next)
  }, [draw])

  // Extend the tape around the centre as the wheel moves.
  useEffect(() => {
    if (!active) return
    const next = new Map(tape.current)
    let changed = false
    for (let index = centre - BUFFER; index <= centre + BUFFER; index++) {
      if (!next.has(index)) { next.set(index, draw()); changed = true }
    }
    for (const index of next.keys()) if (Math.abs(index - centre) > HISTORY) next.delete(index)
    if (changed) { tape.current = next; setPhraseTape(next) }
  }, [active, centre, draw])

  return phraseTape
}
