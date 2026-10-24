import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { HomeWheelSurface } from '../lib/homeNavigation'

// Accumulated delta (in pixels) needed for one step along each axis.
const THRESHOLD = { x: 70, y: 80 }
// A pause this long discards a partially accumulated step.
const IDLE_RESET_MS = 220

// Turns mouse-wheel and trackpad scrolling into discrete wheel steps. The item
// wheel scrolls vertically (or horizontally with Shift); the category and
// subtab wheels always move across.
export function useWheelScroll({ itemsRef, mainRef, subtabsRef, rebindKey, onMoveAcross, onStep }: {
  itemsRef: RefObject<HTMLElement | null>
  mainRef: RefObject<HTMLElement | null>
  subtabsRef: RefObject<HTMLElement | null>
  // Change this when any of the target elements may have mounted or unmounted.
  rebindKey: unknown
  onMoveAcross: (direction: number, surface: HomeWheelSurface) => void
  onStep: (direction: number) => void
}) {
  const handlers = useRef({ onMoveAcross, onStep })
  handlers.current = { onMoveAcross, onStep }
  const accumulator = useRef({ x: 0, y: 0, time: 0, surface: 'items' as HomeWheelSurface })

  useEffect(() => {
    const items = itemsRef.current
    const main = mainRef.current
    if (!items || !main) return
    const subtabs = subtabsRef.current

    const scroll = (event: WheelEvent, surface: HomeWheelSurface) => {
      event.preventDefault()
      const state = accumulator.current
      const now = performance.now()
      if (now - state.time > IDLE_RESET_MS || state.surface !== surface) { state.x = 0; state.y = 0 }
      state.surface = surface
      state.time = now

      const multiplier = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 400 : 1
      const horizontal = surface !== 'items' || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
      const axis = horizontal ? 'x' : 'y'
      state[axis] += (horizontal ? event.deltaX || event.deltaY : event.deltaY) * multiplier
      if (Math.abs(state[axis]) < THRESHOLD[axis]) return

      const direction = Math.sign(state[axis])
      state[axis] = 0
      if (horizontal) handlers.current.onMoveAcross(direction, surface)
      else handlers.current.onStep(direction)
    }

    const onItems = (event: WheelEvent) => scroll(event, 'items')
    const onMain = (event: WheelEvent) => scroll(event, 'main')
    const onSubtabs = (event: WheelEvent) => scroll(event, 'subtabs')
    items.addEventListener('wheel', onItems, { passive: false })
    main.addEventListener('wheel', onMain, { passive: false })
    subtabs?.addEventListener('wheel', onSubtabs, { passive: false })
    return () => {
      items.removeEventListener('wheel', onItems)
      main.removeEventListener('wheel', onMain)
      subtabs?.removeEventListener('wheel', onSubtabs)
    }
  }, [itemsRef, mainRef, subtabsRef, rebindKey])
}
