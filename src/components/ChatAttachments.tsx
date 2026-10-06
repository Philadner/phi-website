import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { DraftFile } from '../hooks/useChatUploads'
import type { ChatAttachment } from '../lib/chatAttachments'
import { fileSize, IMAGE_TYPES } from '../lib/chatAttachments'
import { ProgressCircle } from './ChatUploadProgress'

function FileFace({ name, image, size }: { name: string; image?: string; size: number }) {
  return image ? <img src={image} alt={name} loading="lazy" /> : <span className="chat-document"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M14 3H5v18h14V8l-5-5Z M14 3v5h5 M8 13h8 M8 16h8" /></svg><strong>{name}</strong><small>{fileSize(size)}</small></span>
}

function DraftTile({ item, remove, retry, locked }: { item: DraftFile; remove: () => void; retry: () => void; locked: boolean }) {
  const tile = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null)
  const [landed, setLanded] = useState(!item.origin || Boolean(reduced))
  const landscape = (item.attachment?.width || 0) > (item.attachment?.height || 0)

  useLayoutEffect(() => {
    if (!item.origin || reduced) return
    const element = tile.current
    if (!element) return
    // The composer grows upwards. Project the destination to the tray's full height
    // so the circle lands in place even while the height spring is still moving.
    const frame = requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect()
      const tray = element.closest('.chat-attachment-tray')
      const remaining = tray ? tray.scrollHeight - tray.getBoundingClientRect().height : 0
      setFlight({ x: rect.left + rect.width / 2 - 12, y: rect.top - Math.max(0, remaining) + rect.height / 2 - 12 })
    })
    return () => cancelAnimationFrame(frame)
  }, [item.origin, reduced])

  return <div ref={tile} className={`chat-attachment ${landscape ? 'chat-attachment--landscape' : ''}`} title={item.relativePath || item.file.name}>
    <motion.div className="chat-attachment-face" initial={false} animate={{ opacity: landed ? 1 : 0, scale: landed ? 1 : .94 }} transition={{ duration: reduced ? 0 : .18 }}><FileFace name={item.file.name} image={item.previewUrl} size={item.file.size} /></motion.div>
    {item.state === 'error' && <div className="chat-attachment-error"><span>{item.error}</span><button type="button" onClick={retry} disabled={locked}>Retry</button></div>}
    <button type="button" className="chat-attachment-remove" aria-label={`Remove ${item.file.name}`} onClick={remove} disabled={locked}>×</button>
    {flight && !landed && item.origin && createPortal(<motion.div className="chat-upload-flight" initial={{ x: item.origin.x, y: item.origin.y, scale: 1 }} animate={{ x: flight.x, y: flight.y, scale: 1.4 }} transition={{ type: 'spring', stiffness: 150, damping: 15, mass: .8 }} onAnimationComplete={() => setLanded(true)}><ProgressCircle progress={100} /></motion.div>, document.body)}
  </div>
}

export function DraftAttachments({ files, remove, retry, locked }: { files: DraftFile[]; remove: (id: string) => void; retry: (id: string) => void; locked: boolean }) {
  const reduced = useReducedMotion()
  const visible = files.filter((file) => file.state === 'ready' || file.state === 'error')
  return <AnimatePresence initial={false}>{visible.length > 0 && <motion.div key="tray" className="chat-attachment-tray" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : .22, ease: 'easeOut' }}><div className="chat-attachment-grid" aria-label="Attached files">{visible.map((item) => <DraftTile key={item.id} item={item} remove={() => remove(item.id)} retry={() => retry(item.id)} locked={locked} />)}</div></motion.div>}</AnimatePresence>
}

export default function ChatAttachments({ attachments = [] }: { attachments?: ChatAttachment[] }) {
  if (!attachments.length) return null
  return <div className="chat-message-attachments">{attachments.map((file) => {
    const image = IMAGE_TYPES.includes(file.contentType)
    return <a key={file.id} className={`chat-attachment ${(file.width || 0) > (file.height || 0) ? 'chat-attachment--landscape' : ''}`} href={image ? file.url : file.downloadUrl} target="_blank" rel="noopener noreferrer" title={`${file.relativePath || file.name} · ${fileSize(file.size)}`} aria-label={`${image ? 'Open' : 'Download'} ${file.name}`}><FileFace name={file.name} image={image ? file.url : undefined} size={file.size} /></a>
  })}</div>
}
