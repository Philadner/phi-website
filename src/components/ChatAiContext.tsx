import { useState } from 'react'
import type { ChatMessage } from '../lib/chat'

export default function ChatAiContext({ message, owner, busy, choose }: { message: ChatMessage; owner: boolean; busy: boolean; choose: (grant: { contextCount?: 5 | 20; withImages?: boolean; decline?: boolean }) => void }) {
  const [images, setImages] = useState(false)
  if (!message.is_ai || !message.modifiers?.request_context || !message.reply_to) return null
  if (message.modifiers.context_status) return <div className="chat-context-result">{message.modifiers.context_status === 'declined' ? 'Context declined' : `${message.modifiers.context_count} messages shared${message.modifiers.with_images ? ' · with images' : ''}`}</div>
  return <div className="chat-ai-context" aria-label="AI context request">
    <span>How many messages can AI access this time?</span>
    <div><button type="button" disabled={!owner || busy} onClick={() => choose({ contextCount: 5, withImages: images })}>Last 5 messages</button><button type="button" disabled={!owner || busy} onClick={() => choose({ contextCount: 20, withImages: images })}>Last 20 messages</button><button type="button" disabled={!owner || busy} onClick={() => choose({ decline: true })}>No thanks</button><label><input type="checkbox" checked={images} disabled={!owner || busy} onChange={(event) => setImages(event.target.checked)} /> With images</label></div>
  </div>
}
