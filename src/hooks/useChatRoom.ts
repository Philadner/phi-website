import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiRequest, ChatRoomState, ClearVote } from '../lib/chatFeatures'
import type { ChatMessage, ChatSession } from '../lib/chat'

type RoomResult = { room: ChatRoomState; clearedThrough: number; vote: ClearVote | null; requests: AiRequest[] }
class UsernameTakenError extends Error {}

async function request<T>(path: string, body?: Record<string, unknown>) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
  const data = await response.json().catch(() => null)
  if (response.status === 409 && data?.code === 'username_taken') throw new UsernameTakenError(data.error)
  if (!response.ok || !data) throw new Error(data?.error || 'Could not reach chat.')
  return data as T
}

export default function useChatRoom(session: ChatSession | null, receive: (messages: ChatMessage[]) => void, nameTaken: () => void) {
  const [room, setRoom] = useState<ChatRoomState>({ cleared_through: 0, clear_revision: 0, ai_name: 'AI' })
  const [floor, setFloor] = useState(0)
  const [vote, setVote] = useState<ClearVote | null>(null)
  const [requests, setRequests] = useState<AiRequest[]>([])
  const [running, setRunning] = useState<number[]>([])
  const [error, setError] = useState('')
  const active = useRef(true)
  const processing = useRef(new Set<number>())
  const attempted = useRef(new Set<number>())
  const pollBusy = useRef(false)

  const apply = useCallback((data: RoomResult) => {
    setRoom(data.room)
    setFloor((old) => Math.max(old, data.room.cleared_through, data.clearedThrough))
    setVote(data.vote)
    setRequests(data.requests)
  }, [])

  const refresh = useCallback(async () => {
    if (pollBusy.current) return
    pollBusy.current = true
    try {
      const data = await request<RoomResult>('/api/chat-room')
      if (active.current) apply(data)
    } catch (reason) { if (active.current && reason instanceof UsernameTakenError) nameTaken() }
    finally { pollBusy.current = false }
  }, [apply, nameTaken])

  useEffect(() => {
    active.current = true
    void refresh()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 10000)
    const focus = () => void refresh()
    const visibility = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visibility)
    return () => { active.current = false; window.clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility) }
  }, [session?.id, refresh])

  const runAi = useCallback(async (id: number, grant?: { contextCount?: 5 | 20; withImages?: boolean; decline?: boolean }) => {
    if (processing.current.has(id)) return
    processing.current.add(id)
    attempted.current.add(id)
    setRunning([...processing.current])
    setError('')
    try {
      const data = await request<{ messages?: ChatMessage[] }>('/api/chat-ai', { messageId: id, ...grant })
      if (active.current && data.messages?.length) receive(data.messages)
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : 'AI could not reply.') }
    finally {
      processing.current.delete(id)
      if (active.current) { setRunning([...processing.current]); void refresh() }
    }
  }, [receive, refresh])

  useEffect(() => {
    for (const job of requests) if (job.status === 'queued' && !attempted.current.has(job.trigger_id)) void runAi(job.trigger_id)
  }, [requests, runAi])

  async function action(action: 'clear' | 'start_vote' | 'force' | 'vote', details?: Record<string, unknown>) {
    const data = await request<RoomResult>('/api/chat-room', { action, ...details })
    if (active.current) apply(data)
  }

  return { room, floor, vote, requests, running, error, setError, refresh, runAi, action }
}
