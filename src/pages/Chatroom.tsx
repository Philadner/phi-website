import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Theme } from 'emoji-picker-react'
import ChatMarkdown from '../components/ChatMarkdown'
import { chatRequest, useChatPresence } from '../lib/chat'
import type { ChatMessage, ChatSession } from '../lib/chat'
import '../stylesheets/Chatroom.css'

const EmojiPicker = lazy(() => import('emoji-picker-react'))
type History = { messages: ChatMessage[]; hasMore: boolean }
type Person = { id: string; username: string }

function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map(previous.map((message) => [message.id, message]))
  for (const message of incoming) merged.set(message.id, message)
  return [...merged.values()].sort((a, b) => a.id - b.id)
}

export default function Chatroom() {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [booting, setBooting] = useState(true)
  const [username, setUsername] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [sending, setSending] = useState(false)
  const [joining, setJoining] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [preview, setPreview] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [newMessages, setNewMessages] = useState(false)
  const { presence, setPresence } = useChatPresence()
  const textarea = useRef<HTMLTextAreaElement>(null)
  const feed = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const latestId = useRef(0)
  const historyCursor = useRef<number | null>(null)
  const requestIdentity = useRef<{ content: string; clientId: string } | null>(null)
  const olderScroll = useRef<{ height: number; top: number } | null>(null)

  const receive = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return
    const hasNew = incoming.some((message) => message.id > latestId.current)
    latestId.current = Math.max(latestId.current, ...incoming.map((message) => message.id))
    setMessages((previous) => mergeMessages(previous, incoming))
    if (hasNew && !nearBottom.current) setNewMessages(true)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    chatRequest<{ session: ChatSession | null }>('?action=session', undefined, controller.signal)
      .then((data) => { if (active) { setSession(data.session); setUsername(data.session?.username || '') } })
      .catch((reason) => { if (active) setError(reason.message) })
      .finally(() => { if (active) setBooting(false) })
    return () => { active = false; controller.abort() }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let syncing = false
    const url = import.meta.env.VITE_SUPABASE_URL?.trim()
    const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)?.trim()
    const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null

    async function sync() {
      if (syncing || !active) return
      syncing = true
      try {
        let more = true
        let first = historyCursor.current === null
        while (more && active) {
          const data = await chatRequest<History>(first ? '' : `?after=${historyCursor.current}`, undefined, controller.signal)
          if (!active) return
          receive(data.messages)
          historyCursor.current = Math.max(historyCursor.current || 0, ...data.messages.map((message) => message.id))
          if (first) setHasMore(data.hasMore)
          more = !first && data.hasMore && data.messages.length > 0
          first = false
        }
        setHistoryError('')
      } catch (reason) {
        if (active) setHistoryError(reason instanceof Error ? reason.message : 'History could not load.')
      } finally { syncing = false }
    }

    // Subscribe before reading history; message IDs deduplicate arrivals during fetch.
    const channel = client?.channel('phi-chat-v2:lobby', {
      config: { presence: { key: session?.id || crypto.randomUUID() } },
    })
    channel?.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (event) => {
      if (active) receive([event.new as ChatMessage])
    }).on('presence', { event: 'sync' }, () => {
      if (!active || !channel) return
      const unique = new Map<string, Person>()
      Object.values(channel.presenceState<Person>()).flat().forEach((person) => {
        if (typeof person.id === 'string' && typeof person.username === 'string') unique.set(person.id, { id: person.id, username: person.username.slice(0, 24) })
      })
      setPeople([...unique.values()].sort((a, b) => a.username.localeCompare(b.username)))
      setPresence({ count: unique.size, live: true })
    }).subscribe(async (status) => {
      if (!active) return
      if (status === 'SUBSCRIBED') {
        setPresence({ count: 0, live: true })
        if (session) await channel?.track({ id: session.id, username: session.username })
        if (active) void sync()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setPresence({ count: 0, live: false })
        setPeople([])
      }
    })
    void sync()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void sync() }, 15000)
    const onFocus = () => void sync()
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      if (client && channel) void client.removeChannel(channel)
      setPresence({ count: 0, live: false })
    }
  }, [session, receive, setPresence])

  useEffect(() => {
    const element = feed.current
    if (!element) return
    if (olderScroll.current) {
      element.scrollTop = olderScroll.current.top + element.scrollHeight - olderScroll.current.height
      olderScroll.current = null
    } else if (nearBottom.current) element.scrollTop = element.scrollHeight
  }, [messages])

  async function join(name: string) {
    setJoining(true)
    setError('')
    try {
      const data = await chatRequest<{ session: ChatSession }>('', { action: 'join', username: name })
      setSession(data.session)
      setUsername(data.session.username)
      setEditingName(false)
      textarea.current?.focus()
      return true
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not join.'); return false }
    finally { setJoining(false) }
  }

  function insert(before: string, after = '', placeholder = '') {
    const input = textarea.current
    const start = input?.selectionStart ?? draft.length
    const end = input?.selectionEnd ?? start
    const selected = draft.slice(start, end) || placeholder
    setDraft(`${draft.slice(0, start)}${before}${selected}${after}${draft.slice(end)}`)
    setPreview(false)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  async function send(event?: FormEvent) {
    event?.preventDefault()
    if (sending || !session || !draft.trim()) return
    const text = draft.trim()
    setError('')
    if (text === '/help') { setHelpOpen(true); setDraft(''); return }
    if (text === '/nick' || text.startsWith('/nick ')) {
      const name = text.slice(5).trim()
      if (!name) { setEditingName(true); return }
      if (await join(name)) setDraft('')
      return
    }
    if (/^\/(ai|games?|gif|upload)(\s|$)/i.test(text)) {
      setError('That command is coming later. Try /help for what works now.')
      return
    }
    const action = text.startsWith('/me ')
    if (text.startsWith('/') && !text.startsWith('//') && !action) { setError('Unknown command. Use /help, or start with // to send a slash.'); return }
    const content = action ? text.slice(4).trim() : text.startsWith('//') ? text.slice(1) : text
    if (!content) return
    if (requestIdentity.current?.content !== text) requestIdentity.current = { content: text, clientId: crypto.randomUUID() }
    setSending(true)
    try {
      const data = await chatRequest<{ message: ChatMessage }>('', { action: 'send', content, kind: action ? 'action' : 'message', clientId: requestIdentity.current.clientId })
      nearBottom.current = true
      receive([data.message])
      setNewMessages(false)
      setDraft((current) => current === draft ? '' : current)
      setPreview(false)
      setEmojiOpen(false)
      requestIdentity.current = null
      textarea.current?.focus()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Message could not send. Your draft is still here.') }
    finally { setSending(false) }
  }

  async function loadOlder() {
    if (loadingOlder || !messages.length) return
    setLoadingOlder(true)
    try {
      const data = await chatRequest<History>(`?before=${messages[0].id}`)
      if (feed.current) olderScroll.current = { height: feed.current.scrollHeight, top: feed.current.scrollTop }
      receive(data.messages)
      setHasMore(data.hasMore)
    } catch (reason) { setHistoryError(reason instanceof Error ? reason.message : 'Could not load older messages.') }
    finally { setLoadingOlder(false) }
  }

  return <main className="chat-shell">
    <section className="chat-room" aria-label="Chat lobby">
      <div className="chat-room-heading">
        <div><p className="chat-kicker">A LITTLE CORNER OF THE INTERNET</p><h1>The lobby<span>.</span></h1></div>
        <button type="button" className="chat-help-button" onClick={() => setHelpOpen(!helpOpen)} aria-expanded={helpOpen}>/ commands</button>
      </div>

      <div className="chat-feed" ref={feed} role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions" onScroll={() => {
        const element = feed.current
        if (!element) return
        nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100
        if (nearBottom.current) setNewMessages(false)
      }}>
        {hasMore && <button type="button" className="chat-older" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}
        <div className="chat-welcome"><span aria-hidden="true">✳</span><h2>Welcome to phi(chat)</h2><p>Say something. Make it weird. Markdown welcome.</p><small>This is a public room. Anyone can read the messages.</small></div>
        {historyError && <p className="chat-error" role="alert">{historyError}</p>}
        {messages.map((message) => <article className={`chat-message ${message.author_id === session?.id ? 'chat-message--self' : ''} ${message.kind === 'action' ? 'chat-message--action' : ''}`} key={message.id}>
          <div className="chat-avatar" aria-hidden="true">{message.username.slice(0, 2).toUpperCase()}</div>
          <div className="chat-message-content"><header><strong>{message.username}</strong>{message.author_id === session?.id && <span className="chat-you">you</span>}<time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{message.kind === 'action' && <span className="chat-you">/me</span>}</header><ChatMarkdown content={message.content} /></div>
        </article>)}
      </div>
      {newMessages && <button className="chat-new-messages" onClick={() => { nearBottom.current = true; feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: 'smooth' }); setNewMessages(false) }}>New messages ↓</button>}

      {helpOpen && <section className="chat-help" aria-label="Commands and formatting"><div><h2>Your cheat sheet</h2><button aria-label="Close commands" onClick={() => setHelpOpen(false)}>×</button></div><p><code>/nick name</code> change username · <code>/me does a thing</code> send an action · <code>/help</code> this panel</p><p><code>**bold**</code> · <code>*italic*</code> · <code>~~strike~~</code> · <code># Heading</code> · <code>## Subheading</code> · fenced code blocks, lists, links, quotes and tables.</p><p>Select text and pick a font, or write <code>:font[hello]&#123;family=serif&#125;</code>. Fonts: sans, serif, mono, handwritten, display.</p><small>Next up: uploads → /ai → games → GIFs.</small></section>}

      {booting ? <div className="chat-join"><p>Opening the lobby…</p></div> : !session || editingName ? <form className="chat-join" onSubmit={(event) => { event.preventDefault(); void join(username) }}>
        <div><label htmlFor="chat-username">{session ? 'A new name, same you.' : 'What should we call you?'}</label><p>Your name stays reserved in this browser for 30 days.</p></div>
        <div className="chat-join-controls"><input id="chat-username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={24} pattern="[A-Za-z0-9_ \-]{2,24}" placeholder="Your username" autoComplete="nickname" required /><button disabled={joining}>{joining ? 'Joining…' : session ? 'Save name' : 'Join the chat →'}</button>{session && <button type="button" onClick={() => { setUsername(session.username); setEditingName(false) }}>Cancel</button>}</div>
        {error && <p className="chat-error" role="alert">{error}</p>}
      </form> : <form className="chat-composer" onSubmit={send}>
        <div className="chat-toolbar" aria-label="Message formatting">
          <button type="button" title="Bold" aria-label="Bold" onClick={() => insert('**', '**', 'bold')}><b>B</b></button>
          <button type="button" title="Italic" aria-label="Italic" onClick={() => insert('*', '*', 'italic')}><i>I</i></button>
          <button type="button" title="Strikethrough" aria-label="Strikethrough" onClick={() => insert('~~', '~~', 'strike')}><s>S</s></button>
          <button type="button" title="Heading" aria-label="Heading" onClick={() => insert('\n# ', '\n', 'Heading')}>H1</button>
          <button type="button" title="Subheading" aria-label="Subheading" onClick={() => insert('\n## ', '\n', 'Subheading')}>H2</button>
          <button type="button" title="Code block" aria-label="Code block" onClick={() => insert('\n```\n', '\n```\n', 'code')}>{'{ }'}</button>
          <select aria-label="Font for selected text" value="" onChange={(event) => insert(':font[', `]{family=${event.target.value}}`, 'your text')}><option value="" disabled>Font ↗</option><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Monospace</option><option value="handwritten">Handwritten</option><option value="display">Display</option></select>
          <button type="button" aria-label="Choose emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)}>☺</button>
          <button type="button" className="chat-preview-toggle" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
        </div>
        {emojiOpen && <div className="chat-emoji-panel"><button type="button" className="chat-emoji-close" onClick={() => setEmojiOpen(false)}>Close emoji picker ×</button><Suspense fallback={<p>Loading emoji…</p>}><EmojiPicker theme={'dark' as Theme} lazyLoadEmojis width="100%" height={350} searchPlaceholder="Search emoji…" onEmojiClick={(emoji) => { insert(emoji.emoji); setEmojiOpen(false) }} /></Suspense></div>}
        {preview && <div className="chat-draft-preview"><p className="chat-kicker">MESSAGE PREVIEW</p><ChatMarkdown content={draft || '*Nothing here yet.*'} /></div>}
        <textarea ref={textarea} className={preview ? 'chat-textarea--hidden' : ''} aria-label="Message" placeholder="Send something to the lobby… or try /help" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={8000} rows={3} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } if (event.key === 'Escape') setEmojiOpen(false) }} />
        {error && <p className="chat-error" role="alert">{error}</p>}
        <div className="chat-composer-footer"><span>Chatting as <button type="button" onClick={() => setEditingName(true)}>{session.username}</button><small>Enter to send · Shift + Enter for a new line</small></span><span className="chat-character-count">{draft.length.toLocaleString()} / 8,000</span><button className="chat-send" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send ↑'}</button></div>
      </form>}
    </section>
    <aside className="chat-people" aria-label="Online users"><p className="chat-kicker">GOOD COMPANY</p><h2>In the room <span>{presence.live ? people.length : '—'}</span></h2><p className="chat-presence-note">{presence.live ? 'Here, right now.' : 'Reconnecting. Messages still work.'}</p><ul>{people.map((person) => <li key={person.id}><i aria-hidden="true" /><span>{person.username}</span>{person.id === session?.id && <small>you</small>}</li>)}</ul>{!people.length && <p className="chat-presence-note">{session ? 'Waiting for company…' : 'Pick a name and make yourself at home.'}</p>}<div className="chat-room-note"><span>✦</span><p>Small room.<br />Big main character energy.</p></div></aside>
  </main>
}
