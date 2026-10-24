import { useCallback, useEffect, useRef, useState } from 'react'
import type { Category } from '../lib/homeNavigation'
import type { WordRow } from '../lib/homeWheel'

export type OutgoingLayer = { id: number; category: Category; rows: WordRow[] }

const LAYER_LIFETIME_MS = 440

// Snapshots of the previous category's rows that ripple out after a change.
export function useOutgoingLayers() {
  const [layers, setLayers] = useState<OutgoingLayer[]>([])
  const layersRef = useRef<OutgoingLayer[]>([])
  const sequence = useRef(0)
  const timers = useRef(new Set<number>())

  useEffect(() => {
    const activeTimers = timers.current
    return () => activeTimers.forEach(clearTimeout)
  }, [])

  const replace = useCallback((next: OutgoingLayer[]) => {
    layersRef.current = next
    setLayers(next)
  }, [])

  const push = useCallback((category: Category, rows: WordRow[]) => {
    const layer = { id: ++sequence.current, category, rows }
    // Keep only the newest outgoing waves; older waves are already transparent.
    replace([...layersRef.current.slice(-2), layer])
    const timer = window.setTimeout(() => {
      replace(layersRef.current.filter(old => old.id !== layer.id))
      timers.current.delete(timer)
    }, LAYER_LIFETIME_MS)
    timers.current.add(timer)
  }, [replace])

  const clear = useCallback(() => replace([]), [replace])

  return { layers, push, clear }
}
