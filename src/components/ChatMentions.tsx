import { useState } from 'react'
import type { RefObject } from 'react'
import { mentionText } from '../lib/chatFeatures'

export default function ChatMentions({ input, people, aiName, draft, setDraft }: { input: RefObject<HTMLTextAreaElement | null>; people: { id: string; username: string }[]; aiName: string; draft: string; setDraft: (draft: string) => void }) {
  const [index, setIndex] = useState(0)
  const caret = input.current?.selectionStart ?? draft.length
  const match = draft.slice(0, caret).match(/(?:^|\s)@([A-Za-z0-9_-]*)$/)
  if (!match) return null
  const query = match[1].toLowerCase()
  const candidates = [{ id: 'ai', username: 'ai', isAi: true }, ...people.map((person) => ({ ...person, isAi: false }))].filter((person) => person.username.toLowerCase().startsWith(query)).slice(0, 6)
  if (!candidates.length) return null
  function choose(name: string) {
    const start = caret - match![1].length - 1
    const text = mentionText(name)
    setDraft(`${draft.slice(0, start)}${text}${draft.slice(caret)}`)
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + text.length, start + text.length) })
  }
  return <div className="chat-mention-picker" aria-label="Mention suggestions" onKeyDown={(event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length; setIndex(next); event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus() }
    if (event.key === 'Escape') input.current?.focus()
  }}>{candidates.map((person) => <button type="button" key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(person.username)}>{person.isAi ? aiName : person.username}{person.isAi && <span className="chat-ai-badge">AI</span>}</button>)}</div>
}
