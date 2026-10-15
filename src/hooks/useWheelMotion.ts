import { useCallback, useEffect, useRef, useState } from 'react'
import { tick } from '../lib/homeNavigation'

// The original phrase wheel's spring and momentum, with a single manual-selection
// tick and explicit automatic/manual provenance. Snapping never repeats a tick.
export function useWheelMotion({ resetKey, min = -Infinity, max = Infinity, initial = 0, auto = false, reduced = false }: {
  resetKey: string; min?: number; max?: number; initial?: number; auto?: boolean; reduced?: boolean
}) {
  const [position, setPosition] = useState(initial)
  const positionRef = useRef(initial)
  // Applying a theme changes its next-entry index, never the live selection.
  const initialRef = useRef(initial)
  initialRef.current = initial
  const target = useRef<number | null>(null)
  const velocity = useRef(0)
  const selected = useRef(Math.round(initial))
  const manual = useRef(false)
  const dragging = useRef(false)
  const lastInput = useRef(performance.now())
  const bounds = useRef({ min, max, reduced })
  bounds.current = { min, max, reduced }

  const move = useCallback((value: number, fromUser: boolean) => {
    const next = Math.max(bounds.current.min, Math.min(bounds.current.max, value))
    const index = Math.round(next)
    if (index !== selected.current && fromUser) tick(8)
    selected.current = index
    positionRef.current = next
    setPosition(next)
  }, [])

  const step = useCallback((direction: number) => {
    lastInput.current = performance.now()
    manual.current = true
    const next = Math.max(bounds.current.min, Math.min(bounds.current.max, Math.round(target.current ?? positionRef.current) + direction))
    if (bounds.current.reduced) { move(next, true); target.current = null; velocity.current = 0 }
    else target.current = next
  }, [move])

  const begin = useCallback(() => {
    dragging.current = true
    manual.current = true
    target.current = null
    velocity.current = 0
    lastInput.current = performance.now()
  }, [])
  const drag = useCallback((delta: number, seconds: number) => {
    if (!dragging.current) return
    velocity.current = velocity.current * .52 + delta / Math.max(.008, seconds) * .48
    move(positionRef.current + delta, true)
    lastInput.current = performance.now()
  }, [move])
  const end = useCallback((cancel = false) => {
    dragging.current = false
    velocity.current = cancel || bounds.current.reduced ? 0 : Math.max(-12, Math.min(12, velocity.current))
    target.current = Math.abs(velocity.current) < .28 ? Math.round(positionRef.current) : null
    lastInput.current = performance.now()
  }, [])
  const settle = useCallback(() => {
    velocity.current = 0
    dragging.current = false
    target.current = Math.round(positionRef.current)
    lastInput.current = performance.now()
  }, [])

  useEffect(() => {
    const startingPosition = initialRef.current
    positionRef.current = startingPosition
    selected.current = Math.round(startingPosition)
    target.current = null
    velocity.current = 0
    manual.current = false
    dragging.current = false
    lastInput.current = performance.now()
    setPosition(startingPosition)
    let frame = 0
    let previous = performance.now()
    let stopped = false
    const animate = (now: number) => {
      if (stopped) return
      const seconds = Math.min(.032, Math.max(.001, (now - previous) / 1000))
      previous = now
      if (auto && !dragging.current && target.current === null && now - lastInput.current >= 2500) {
        manual.current = false
        const next = Math.round(positionRef.current) - 1
        if (reduced) move(next, false)
        else target.current = next
        lastInput.current = now
      }
      if (!dragging.current) {
        if (target.current !== null) {
          const displacement = target.current - positionRef.current
          velocity.current += displacement * 600 * seconds
          velocity.current *= Math.exp(-50 * seconds)
          velocity.current = Math.max(-24, Math.min(24, velocity.current))
          const next = positionRef.current + velocity.current * seconds
          if ((Math.abs(displacement) < .0015 && Math.abs(velocity.current) < .025) || Math.sign(target.current - next) !== Math.sign(displacement)) {
            move(target.current, manual.current)
            target.current = null
            velocity.current = 0
          } else move(next, manual.current)
        } else if (Math.abs(velocity.current) > .02) {
          move(positionRef.current + velocity.current * seconds, manual.current)
          velocity.current *= Math.exp(-4.6 * seconds)
          if (Math.abs(velocity.current) < .24 || positionRef.current <= min || positionRef.current >= max) target.current = Math.round(positionRef.current)
        } else if (Math.abs(Math.round(positionRef.current) - positionRef.current) > .001) target.current = Math.round(positionRef.current)
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => { stopped = true; cancelAnimationFrame(frame) }
  }, [resetKey, min, max, auto, reduced, move])

  return { position, positionRef, step, begin, drag, end, settle }
}
