import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Category, WheelItem } from '../lib/homeNavigation'
import type { WordMetrics } from '../lib/homeWheel'

// Measure at FULL size. Navigation wraps once at that width, then the entire
// block scales; its line breaks cannot jump as it moves towards the centre.
// Community phrases retain the original single-line width filtering.
export function useWordMetrics({ category, items, sourcePhrases, wheelRef }: {
  category: Category; items: WheelItem[]; sourcePhrases: string[]; wheelRef: RefObject<HTMLElement | null>
}) {
  const measurementRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const [metrics, setMetrics] = useState<WordMetrics>({ font: 52, heights: [] })
  const [phrases, setPhrases] = useState(sourcePhrases)

  useLayoutEffect(() => {
    const measure = () => {
      const measurement = measurementRef.current
      const probe = probeRef.current
      if (!measurement || !probe) return
      const font = parseFloat(getComputedStyle(probe).fontSize)
      const nodes = [...measurement.children] as HTMLElement[]
      setMetrics(previous => {
        const heights = nodes.map(node => node.offsetHeight)
        return previous.font === font && previous.heights.join() === heights.join() ? previous : { font, heights }
      })
      if (category === 'phi') {
        const fitting = sourcePhrases.filter((_, index) => nodes[index]?.scrollWidth <= measurement.clientWidth)
        const next = fitting.length ? fitting : ['phi']
        setPhrases(previous => previous.join('\0') === next.join('\0') ? previous : next)
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (wheelRef.current) observer.observe(wheelRef.current)
    if (probeRef.current) observer.observe(probeRef.current)
    return () => observer.disconnect()
  }, [category, items, sourcePhrases, wheelRef])

  return { metrics, phrases, measurementRef, probeRef }
}
