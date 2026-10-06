import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'

type Selection = { start: number; end: number; x: number; y: number }
const WIDTH = 240
const HEIGHT = 40

// A textarea has no DOM Range. Mirror its text metrics to locate every selected
// line, then put the toolbar outside their bounds (including when scrolled).
function selectionBounds(input: HTMLTextAreaElement, start: number, end: number) {
  const style = getComputedStyle(input)
  const mirror = document.createElement('div')
  for (const key of ['font', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'padding', 'border', 'boxSizing', 'textIndent', 'tabSize', 'wordSpacing'] as const) mirror.style[key] = style[key]
  Object.assign(mirror.style, { position: 'fixed', left: '-10000px', top: '0', width: `${input.clientWidth}px`, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', visibility: 'hidden' })
  mirror.append(document.createTextNode(input.value.slice(0, start)))
  const selected = document.createElement('span')
  selected.textContent = input.value.slice(start, end)
  mirror.append(selected, document.createTextNode(input.value.slice(end) || ' '))
  document.body.append(mirror)
  const origin = mirror.getBoundingClientRect()
  const rects = [...selected.getClientRects()]
  const box = input.getBoundingClientRect()
  const visible = rects.map((rect) => ({ top: box.top + rect.top - origin.top - input.scrollTop, bottom: box.top + rect.bottom - origin.top - input.scrollTop })).filter((rect) => rect.bottom > box.top && rect.top < box.bottom)
  mirror.remove()
  if (!visible.length) return null
  return { top: Math.max(box.top, Math.min(...visible.map((rect) => rect.top))), bottom: Math.min(box.bottom, Math.max(...visible.map((rect) => rect.bottom))), box }
}

export default function ChatSelectionToolbar({ input, value, insert, hidden }: { input: RefObject<HTMLTextAreaElement | null>; value: string; insert: (before: string, after?: string, placeholder?: string) => void; hidden: boolean }) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const selecting = useRef(false)

  useEffect(() => {
    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const element = input.current
        if (toolbar.current?.contains(document.activeElement)) return
        if (!element || hidden || document.activeElement !== element || selecting.current || element.selectionStart === element.selectionEnd) { setSelection(null); return }
        const bounds = selectionBounds(element, element.selectionStart, element.selectionEnd)
        if (!bounds) { setSelection(null); return }
        const x = Math.max(8, Math.min(window.innerWidth - WIDTH - 8, (pointer.current?.x || bounds.box.left + 20) - WIDTH / 2))
        let y = bounds.bottom + 9
        if (y + HEIGHT > window.innerHeight - 8) y = bounds.top - HEIGHT - 9
        // If selected text fills the textarea, use the empty space above it.
        if (y < 8) y = bounds.box.top - HEIGHT - 9
        if (y < 8 || (y < bounds.bottom && y + HEIGHT > bounds.top)) { setSelection(null); return }
        setSelection({ start: element.selectionStart, end: element.selectionEnd, x, y })
      })
    }
    const down = (event: PointerEvent) => {
      if (toolbar.current?.contains(event.target as Node)) return
      selecting.current = event.target === input.current
      if (selecting.current) pointer.current = { x: event.clientX, y: event.clientY }
      setSelection(null)
    }
    const up = (event: PointerEvent) => {
      if (selecting.current) pointer.current = { x: event.clientX, y: event.clientY }
      selecting.current = false
      check()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelection(null); return }
      if (event.target === input.current) { pointer.current = null; check() }
    }
    document.addEventListener('selectionchange', check)
    document.addEventListener('pointerdown', down)
    document.addEventListener('pointerup', up)
    document.addEventListener('keyup', key)
    document.addEventListener('scroll', check, true)
    window.addEventListener('resize', check)
    check()
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('selectionchange', check)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('keyup', key)
      document.removeEventListener('scroll', check, true)
      window.removeEventListener('resize', check)
    }
  }, [input, value, hidden])

  function format(before: string, after: string) {
    if (!selection) return
    input.current?.setSelectionRange(selection.start, selection.end)
    insert(before, after)
    setSelection(null)
  }
  if (!selection || hidden) return null
  return createPortal(<div ref={toolbar} className="chat-selection-toolbar" role="toolbar" aria-label="Format selected text" style={{ left: selection.x, top: selection.y }} onPointerDown={(event) => { if ((event.target as HTMLElement).closest('button')) event.preventDefault() }}>
    <button type="button" aria-label="Bold selected text" title="Bold" onClick={() => format('**', '**')}><b>B</b></button>
    <button type="button" aria-label="Italic selected text" title="Italic" onClick={() => format('*', '*')}><i>I</i></button>
    <button type="button" aria-label="Strike selected text" title="Strikethrough" onClick={() => format('~~', '~~')}><s>S</s></button>
    <button type="button" aria-label="Code selected text" title="Inline code" onClick={() => format('`', '`')}>{'< >'}</button>
    <select aria-label="Selected text font" value="" onChange={(event) => format(':font[', `]{family=${event.target.value}}`)}><option disabled value="">Font</option><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option><option value="handwritten">Handwritten</option><option value="display">Display</option></select>
  </div>, document.body)
}
