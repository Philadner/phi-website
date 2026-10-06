import { useChatPresence } from '../lib/chat'

export function ProgressCircle({ progress }: { progress: number }) {
  const value = Math.min(100, Math.max(0, progress))
  const angle = value / 100 * Math.PI * 2
  const x = 12 + 9 * Math.sin(angle)
  const y = 12 - 9 * Math.cos(angle)
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".4" />{value >= 100 ? <circle cx="12" cy="12" r="9" fill="currentColor" /> : value > 0 ? <path d={`M12 12 L12 3 A9 9 0 ${value > 50 ? 1 : 0} 1 ${x} ${y} Z`} fill="currentColor" /> : null}</svg>
}

export default function ChatUploadProgress() {
  const { uploads } = useChatPresence()
  if (!uploads.length) return null
  return <div className="chat-upload-progress"><span role="status">Uploading…</span><div className="chat-upload-circles">{uploads.map((file) => <span key={file.id} data-upload-circle={file.id} title={`${file.name} · ${Math.round(file.progress)}%`} role="progressbar" aria-label={`Uploading ${file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(file.progress)}><ProgressCircle progress={file.progress} /></span>)}</div></div>
}
