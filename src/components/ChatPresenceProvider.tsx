import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChatPresenceContext } from '../lib/chat'
import type { ChatPresence } from '../lib/chat'

export default function ChatPresenceProvider({ children }: { children: ReactNode }) {
  const [presence, setPresence] = useState<ChatPresence>({ count: 0, live: false })
  const value = useMemo(() => ({ presence, setPresence }), [presence])
  return <ChatPresenceContext.Provider value={value}>{children}</ChatPresenceContext.Provider>
}
