import { createContext, useContext } from 'react'

export type ChatSession = { id: string; username: string }
export type ChatMessage = {
  id: number
  client_id: string
  author_id: string
  username: string
  content: string
  kind: 'message' | 'action'
  created_at: string
}
export type ChatPresence = { count: number; live: boolean }
export const ChatPresenceContext = createContext<{
  presence: ChatPresence
  setPresence: (value: ChatPresence) => void
  peopleOpen: boolean
  setPeopleOpen: (open: boolean) => void
}>({ presence: { count: 0, live: false }, setPresence: () => {}, peopleOpen: false, setPeopleOpen: () => {} })
export const useChatPresence = () => useContext(ChatPresenceContext)

export async function chatRequest<T>(query = '', body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/chat${query}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || 'Could not reach chat. Try again shortly.')
  return data as T
}
