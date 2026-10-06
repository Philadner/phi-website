import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChatPresenceContext } from '../lib/chat'
import type { ChatPresence } from '../lib/chat'
import type { UploadProgress } from '../lib/chatAttachments'

export default function ChatPresenceProvider({ children }: { children: ReactNode }) {
  const [presence, setPresence] = useState<ChatPresence>({ count: 0, live: false })
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const value = useMemo(() => ({ presence, setPresence, peopleOpen, setPeopleOpen, uploads, setUploads }), [presence, peopleOpen, uploads])
  return <ChatPresenceContext.Provider value={value}>{children}</ChatPresenceContext.Provider>
}
