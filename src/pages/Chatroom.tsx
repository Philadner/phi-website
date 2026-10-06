import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Theme } from 'emoji-picker-react'
import ChatMarkdown from '../components/ChatMarkdown'
import ChatActiveUsers from '../components/ChatActiveUsers'
import ChatComposerTools from '../components/ChatComposerTools'
import ChatAttachments, { DraftAttachments } from '../components/ChatAttachments'
import ChatSelectionToolbar from '../components/ChatSelectionToolbar'
import useChatUploads from '../hooks/useChatUploads'
import useChatRoom from '../hooks/useChatRoom'
import ChatAiContext from '../components/ChatAiContext'
import ChatClearVote from '../components/ChatClearVote'
import ChatMentions from '../components/ChatMentions'
import ChatGameCard from '../components/ChatGameCard'
import ChatGif from '../components/ChatGif'
import ChatGifPicker from '../components/ChatGifPicker'
import type { ChatGifRef } from '../lib/chatGifs'
import { gameKind, gameRequest } from '../lib/chatGames'
import type { GameKind } from '../lib/chatGames'
import { parseChatCommand } from '../lib/chatFeatures'
import { droppedFiles } from '../lib/chatDrop'
import { chatRequest, useChatPresence } from '../lib/chat'
import type { ChatMessage, ChatSession } from '../lib/chat'
import '../stylesheets/Chatroom.css'

const EmojiPicker = lazy(() => import('emoji-picker-react'))
type History = { messages: ChatMessage[]; hasMore: boolean; clearedThrough: number }
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
  const [formattingOpen, setFormattingOpen] = useState(false)
  const [stuffOpen, setStuffOpen] = useState(false)
  const [gamesOpen, setGamesOpen] = useState(false)
  const [gameBusy, setGameBusy] = useState(false)
  const [gameError, setGameError] = useState('')
  const [gifOpen, setGifOpen] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [draftGif, setDraftGif] = useState<ChatGifRef | null>(null)
  const gameCreation = useRef<{ kind: GameKind; clientId: string } | null>(null)
  const [newMessages, setNewMessages] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [replying, setReplying] = useState<ChatMessage | null>(null)
  const [historyFloor, setHistoryFloor] = useState(0)
  const [jumpedTo, setJumpedTo] = useState<number | null>(null)
  const uploads = useChatUploads(session)
  const fileInput = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const { setPresence } = useChatPresence()
  const textarea = useRef<HTMLTextAreaElement>(null)
  const feed = useRef<HTMLDivElement>(null)
  const feedContents = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLFormElement>(null)
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
  const nameTaken = useCallback(() => {
    setSession(null)
    setError('That username is currently in use. Choose another.')
  }, [])
  const room = useChatRoom(session, receive, nameTaken)
  const refreshRoom = room.refresh
  const floor = Math.max(room.floor, historyFloor)

  useEffect(() => {
    setMessages((current) => current.filter((message) => message.id > floor))
    latestId.current = Math.max(latestId.current, floor)
    if (historyCursor.current !== null) historyCursor.current = Math.max(historyCursor.current, floor)
    setHasMore(false)
    setReplying((current) => current && current.id <= floor ? null : current)
  }, [floor])

  useEffect(() => {
    if (jumpedTo === null) return
    const timer = window.setTimeout(() => setJumpedTo(null), 1800)
    return () => window.clearTimeout(timer)
  }, [jumpedTo])

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
          setHistoryFloor((old) => Math.max(old, data.clearedThrough || 0))
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
    }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (event) => {
      if (active) receive([event.new as ChatMessage])
    }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_room_state' }, () => {
      if (active) void refreshRoom()
    }).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_clear_votes' }, () => {
      if (active) void refreshRoom()
    }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_games' }, event => {
      if (active) window.dispatchEvent(new CustomEvent('chat-game-update', { detail: event.new.id }))
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
  }, [session, receive, setPresence, refreshRoom])

  useEffect(() => {
    const element = feed.current
    if (!element) return
    if (olderScroll.current) {
      element.scrollTop = olderScroll.current.top + element.scrollHeight - olderScroll.current.height
      olderScroll.current = null
    } else if (nearBottom.current) element.scrollTop = element.scrollHeight
  }, [messages])

  useEffect(() => {
    const element = feed.current
    const contents = feedContents.current
    if (!element || !contents) return
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) element.scrollTop = element.scrollHeight
    })
    observer.observe(contents)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = composer.current
    if (!element) return
    const measure = () => {
      const headerBottom = document.querySelector('.site-header--chat')?.getBoundingClientRect().bottom || 80
      element.style.setProperty('--chat-menu-max-height', `${Math.max(80, element.getBoundingClientRect().top - headerBottom - 20)}px`)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    measure()
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [booting, session?.id, editingName])

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

  function insertCommand(command: string) {
    setDraft((current) => `${command}${current.replace(/^\/\w+\s*/, '')}`)
    setPreview(false)
    requestAnimationFrame(() => textarea.current?.focus())
  }

  function openEmoji() {
    setGifOpen(false)
    setEmojiOpen(true)
    setFormattingOpen(false)
    setStuffOpen(false)
  }

  function openFiles() {
    setGifOpen(false)
    setStuffOpen(false)
    setFormattingOpen(false)
    fileInput.current?.click()
  }

  async function send(event?: FormEvent) {
    event?.preventDefault()
    if (sending || !session || (!draft.trim() && !uploads.files.length && !draftGif)) return
    const text = draft.trim()
    const command = parseChatCommand(text)
    setError('')
    if (command.kind === 'gif') { setGifQuery(command.content); setGifOpen(true); setStuffOpen(false); setFormattingOpen(false); setEmojiOpen(false); setDraft(''); return }
    if (command.kind === 'game') {
      if (!command.content) { setGamesOpen(true); setStuffOpen(true); setFormattingOpen(false); setDraft(''); return }
      const kind = gameKind(command.content)
      if (!kind) { setError('Choose chess, connect4, tictactoe, wordle, battleships or uno. Gartic Phone is coming soon.'); return }
      await startGame(kind)
      return
    }
    if (text === '/help') { setStuffOpen(true); setFormattingOpen(false); setDraft(''); return }
    if (text === '/format') { setFormattingOpen(true); setStuffOpen(false); setDraft(''); return }
    if (text === '/emoji') { openEmoji(); setDraft(''); return }
    if (text === '/upload') { openFiles(); setDraft(''); return }
    if (command.kind === 'clear' || command.kind === 'vote' || command.kind === 'force') {
      setSending(true)
      try {
        await room.action(command.kind === 'clear' ? 'clear' : command.kind === 'vote' ? 'start_vote' : 'force', command.kind === 'force' ? { command: text } : undefined)
        setDraft((current) => current === draft ? '' : current)
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Clear could not finish.') }
      finally { setSending(false) }
      return
    }
    if (text === '/nick' || text.startsWith('/nick ')) {
      const name = text.slice(5).trim()
      if (!name) { setEditingName(true); return }
      if (await join(name)) setDraft('')
      return
    }
    if (uploads.busy || uploads.files.some((file) => file.state === 'error')) { setError('Wait for your uploads, or remove the failed files.'); return }
    const action = command.kind === 'action'
    if (command.kind === 'invalid' || command.kind === 'local') { setError('Invalid command. Use /help, or start with // to send a slash.'); return }
    const content = command.content
    const attachmentIds = uploads.files.filter((file) => file.state === 'ready').map((file) => file.id)
    if (!content && !attachmentIds.length && !draftGif) return
    if (command.kind === 'ai' && !content && !attachmentIds.length) { setError('Add a message or image after /ai.'); return }
    const identity = JSON.stringify([text, attachmentIds, replying?.id, draftGif])
    if (requestIdentity.current?.content !== identity) requestIdentity.current = { content: identity, clientId: crypto.randomUUID() }
    setSending(true)
    try {
      const data = await chatRequest<{ message: ChatMessage }>('', { action: 'send', text, content, kind: action ? 'action' : 'message', clientId: requestIdentity.current.clientId, attachmentIds, replyTo: replying?.id ?? null, gif: draftGif })
      nearBottom.current = true
      receive([data.message])
      setNewMessages(false)
      setDraft((current) => current === draft ? '' : current)
      uploads.release(attachmentIds)
      setDraftGif(current => current?.id === draftGif?.id ? null : current)
      setReplying((current) => current?.id === replying?.id ? null : current)
      if (data.message.invokes_ai) void room.runAi(data.message.id)
      setPreview(false)
      setEmojiOpen(false)
      requestIdentity.current = null
      textarea.current?.focus()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Message could not send. Your draft is still here.') }
    finally { setSending(false) }
  }

  async function startGame(kind: GameKind) {
    if (gameBusy || !session) return
    if (gameCreation.current?.kind !== kind) gameCreation.current = { kind, clientId: crypto.randomUUID() }
    setGameBusy(true); setGameError(''); setError('')
    try {
      const result = await gameRequest({ action: 'create', kind, clientId: gameCreation.current.clientId })
      nearBottom.current = true
      if (result.message) receive([result.message])
      setStuffOpen(false); setGamesOpen(false)
      if (parseChatCommand(draft).kind === 'game') setDraft('')
      gameCreation.current = null
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not start game.'
      setGameError(message); setError(message)
    } finally { setGameBusy(false) }
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

  async function jumpTo(id: number) {
    if (id <= floor) { setError('That message has been cleared.'); return }
    nearBottom.current = false
    if (!messages.some((message) => message.id === id)) {
      try {
        const { message } = await chatRequest<{ message: ChatMessage | null }>(`?messageId=${id}`)
        if (!message) { setError('That message is no longer available.'); return }
        receive([message])
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load that message.'); return }
    }
    setJumpedTo(id)
    requestAnimationFrame(() => document.getElementById(`chat-message-${id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }))
  }

  return <main className={`chat-shell ${dragging ? 'chat-shell--dragging' : ''}`} onDragEnter={(event) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }} onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = session ? 'copy' : 'none' } }} onDragLeave={(event) => {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (!dragDepth.current) setDragging(false)
  }} onDrop={(event) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    void droppedFiles(event.dataTransfer).then(({ files, truncated }) => uploads.add(files, truncated)).catch(() => uploads.setError('Could not read that folder. Try selecting the files instead.'))
  }}>
    <section className="chat-room" aria-label="Chat lobby">
      <ChatClearVote vote={room.vote} sessionId={session?.id} cast={(yes) => room.action('vote', { voteId: room.vote?.id, yes })} />
      <div className="chat-feed" ref={feed} role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions" onScroll={() => {
        const element = feed.current
        if (!element) return
        nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100
        if (nearBottom.current) setNewMessages(false)
      }}>
        <div ref={feedContents}>
        {hasMore && <button type="button" className="chat-older" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}
        {historyError && <p className="chat-error" role="alert">{historyError}</p>}
        {messages.filter((message) => message.id > floor).map((message) => <article id={`chat-message-${message.id}`} className={`chat-message ${message.author_id === session?.id && !message.is_ai ? 'chat-message--self' : ''} ${message.kind === 'action' ? 'chat-message--action' : ''} ${session && (message.mentioned_ids?.includes(session.id) || message.reply_preview?.authorId === session.id) ? 'chat-message--mentioned' : ''} ${jumpedTo === message.id ? 'chat-message--jumped' : ''}`} key={message.id}>
          <div className="chat-avatar" aria-hidden="true">{message.username.slice(0, 2).toUpperCase()}</div>
          <div className="chat-message-content">
            {message.reply_preview && <button type="button" className="chat-reply-preview" onClick={() => void jumpTo(message.reply_preview!.id)}><strong>{message.reply_preview.username}</strong>{message.reply_preview.isAi && <span className="chat-ai-badge">AI</span>}<span>{message.reply_preview.content}</span></button>}
            <header><strong>{message.username}</strong>{message.is_ai && <span className="chat-ai-badge">AI</span>}{message.author_id === session?.id && !message.is_ai && <span className="chat-you">you</span>}<time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{message.kind === 'action' && <span className="chat-you">/me</span>}{session && <button type="button" className="chat-reply-button" aria-label={`Reply to ${message.username}'s message`} onClick={() => { setReplying(message); textarea.current?.focus() }}>↩ Reply</button>}</header>{!message.modifiers?.game_id && !(message.modifiers?.gif && message.content === 'GIF') && <ChatMarkdown content={message.content} />}<ChatAttachments attachments={message.attachments} />{message.modifiers?.gif && <ChatGif gif={message.modifiers.gif} />}
            <ChatAiContext message={message} owner={Boolean(session && message.reply_preview?.authorId === session.id)} busy={room.running.includes(message.reply_to || 0) || room.requests.some((job) => job.trigger_id === message.reply_to && job.status === 'processing')} choose={(grant) => void room.runAi(message.reply_to!, grant)} />
            {message.modifiers?.game_id && <ChatGameCard id={message.modifiers.game_id} session={session} />}
          </div>
        </article>)}
        </div>
      </div>
      {room.running.length > 0 && <div className="chat-ai-status" role="status">AI replying…</div>}
      {room.requests.filter((job) => job.status === 'error').map((job) => <div className="chat-ai-status" key={job.id}><span>{job.error || 'AI could not reply.'}</span><button type="button" disabled={room.running.includes(job.trigger_id)} onClick={() => void room.runAi(job.trigger_id)}>Retry AI</button></div>)}
      {room.error && <p className="chat-error" role="alert">{room.error}</p>}
      {newMessages && <button className="chat-new-messages" onClick={() => { nearBottom.current = true; feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: 'smooth' }); setNewMessages(false) }}>New messages ↓</button>}

      {booting ? <div className="chat-join"><p>Opening the lobby…</p></div> : !session || editingName ? <form className="chat-join" onSubmit={(event) => { event.preventDefault(); void join(username) }}>
        <label htmlFor="chat-username">Username</label>
        <div className="chat-join-controls"><input id="chat-username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={24} pattern="[A-Za-z0-9_ \-]{2,24}" placeholder="Your username" autoComplete="nickname" required /><button disabled={joining}>{joining ? 'Joining…' : session ? 'Save name' : 'Join the chat →'}</button>{session && <button type="button" onClick={() => { setUsername(session.username); setEditingName(false) }}>Cancel</button>}</div>
        {error && <p className="chat-error" role="alert">{error}</p>}
      </form> : <form ref={composer} className="chat-composer" onSubmit={send} onPaste={(event) => {
        const files = [...event.clipboardData.items].filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter((file): file is File => Boolean(file))
        if (files.length) { event.preventDefault(); uploads.add(files.map((file) => ({ file }))) }
      }}>
        <input ref={fileInput} type="file" multiple hidden aria-label="Upload files" onChange={(event) => { uploads.add([...event.target.files || []].map((file) => ({ file }))); event.target.value = '' }} />
        <ChatComposerTools formattingOpen={formattingOpen} setFormattingOpen={setFormattingOpen} stuffOpen={stuffOpen} setStuffOpen={setStuffOpen} preview={preview} setPreview={setPreview} insert={insert} insertCommand={insertCommand} changeName={() => setEditingName(true)} openEmoji={openEmoji} openFiles={openFiles} openGif={() => { setGifQuery(''); setGifOpen(true); setEmojiOpen(false) }} gamesOpen={gamesOpen} setGamesOpen={setGamesOpen} startGame={kind => void startGame(kind)} gameBusy={gameBusy} gameError={gameError} />
        <DraftAttachments files={uploads.files} remove={(id) => uploads.release([id], true)} retry={uploads.retry} locked={sending} />
        {replying && <div className="chat-replying"><span>Replying to <strong>{replying.username}</strong></span><button type="button" aria-label="Cancel reply" onClick={() => setReplying(null)}>×</button></div>}
        {uploads.busy && <div className="chat-upload-queue">{uploads.files.filter((file) => file.state === 'queued' || file.state === 'uploading').map((file) => <button type="button" key={file.id} aria-label={`Cancel upload of ${file.file.name}`} onClick={() => uploads.release([file.id], true)}>{file.file.name} ×</button>)}</div>}
        {emojiOpen && <div className="chat-emoji-panel"><button type="button" className="chat-emoji-close" onClick={() => setEmojiOpen(false)}>Close emoji picker ×</button><Suspense fallback={<p>Loading emoji…</p>}><EmojiPicker theme={'dark' as Theme} lazyLoadEmojis width="100%" height={350} searchPlaceholder="Search emoji…" onEmojiClick={(emoji) => { insert(emoji.emoji); setEmojiOpen(false) }} /></Suspense></div>}
        {gifOpen && <ChatGifPicker initialQuery={gifQuery} close={() => setGifOpen(false)} choose={gif => { setDraftGif(gif); setGifOpen(false); textarea.current?.focus() }} />}
        {draftGif && <div className="chat-gif-draft"><ChatGif gif={draftGif} /><button type="button" aria-label="Remove GIF" onClick={() => setDraftGif(null)}>×</button></div>}
        {preview && <div className="chat-draft-preview"><ChatMarkdown content={draft} /></div>}
        {!preview && <ChatMentions input={textarea} people={people} aiName={room.room.ai_name} draft={draft} setDraft={setDraft} />}
        <textarea ref={textarea} className={preview ? 'chat-textarea--hidden' : ''} aria-label="Message" placeholder="Message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={8000} rows={3} onKeyDown={(event) => { if (event.key === 'ArrowDown' && document.querySelector('.chat-mention-picker')) { event.preventDefault(); document.querySelector<HTMLButtonElement>('.chat-mention-picker button')?.focus(); return } if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } if (event.key === 'Escape') { setEmojiOpen(false); setFormattingOpen(false); setStuffOpen(false); setGifOpen(false); setReplying(null) } }} />
        {error && <p className="chat-error" role="alert">{error}</p>}
        {uploads.error && <p className="chat-error" role="alert">{uploads.error}</p>}
        <ChatSelectionToolbar input={textarea} value={draft} insert={insert} hidden={preview || formattingOpen || stuffOpen || emojiOpen || gifOpen} />
        <div className="chat-composer-footer"><span>Chatting as <button type="button" onClick={() => setEditingName(true)}>{session.username}</button><small>Enter to send · Shift + Enter for a new line</small></span><span className="chat-character-count">{draft.length.toLocaleString()} / 8,000</span><button className="chat-send" disabled={sending || uploads.busy || uploads.files.some((file) => file.state === 'error') || (!draft.trim() && !uploads.files.length && !draftGif)}>{sending ? 'Sending…' : 'Send ↑'}</button></div>
      </form>}
    </section>
    <ChatActiveUsers people={people} sessionId={session?.id} />
  </main>
}
