import { useEffect, useRef } from 'react'
import { useChatPresence } from '../lib/chat'

type Person = { id: string; username: string }

export default function ChatActiveUsers({ people, sessionId }: { people: Person[]; sessionId?: string }) {
  const { presence, peopleOpen, setPeopleOpen } = useChatPresence()
  const panel = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = panel.current
    if (!dialog) return
    if (peopleOpen && !dialog.open) dialog.showModal()
    if (!peopleOpen && dialog.open) dialog.close()
  }, [peopleOpen])

  useEffect(() => () => { setPeopleOpen(false) }, [setPeopleOpen])

  return <dialog
    id="chat-active-users"
    ref={panel}
    className="chat-people"
    aria-labelledby="chat-users-title"
    onCancel={() => setPeopleOpen(false)}
    onClose={() => setPeopleOpen(false)}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setPeopleOpen(false)
    }}
  >
    <header><h2 id="chat-users-title">Active users <span>{presence.live ? people.length : '—'}</span></h2><button type="button" aria-label="Close active users" onClick={() => setPeopleOpen(false)}>×</button></header>
    {!presence.live && <p>Reconnecting…</p>}
    {presence.live && !people.length && <p>No users online.</p>}
    <ul>{people.map((person) => <li key={person.id}><i aria-hidden="true" /><span>{person.username}</span>{person.id === sessionId && <small>you</small>}</li>)}</ul>
  </dialog>
}
