import { useEffect, useState } from 'react'
import type { ClearVote } from '../lib/chatFeatures'

export default function ChatClearVote({ vote, sessionId, cast }: { vote: ClearVote | null; sessionId?: string; cast: (yes: boolean) => Promise<void> }) {
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (vote?.status !== 'active') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [vote?.status])
  if (!vote || vote.status !== 'active') return null
  const remaining = Math.max(0, Math.ceil((Date.parse(vote.expires_at) - now) / 1000))
  if (!remaining) return null
  const eligible = Boolean(sessionId && vote.electorate.includes(sessionId))
  async function choose(yes: boolean) {
    setBusy(true)
    setError('')
    try { await cast(yes) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Vote could not save.') }
    finally { setBusy(false) }
  }
  return <section className="chat-clear-vote" aria-label="Clear chat vote"><span>Clear for everyone? <small>{remaining}s · {Math.floor(vote.electorate.length / 2) + 1} votes needed</small></span><div><button type="button" disabled={!eligible || busy} aria-pressed={Boolean(sessionId && vote.yes.includes(sessionId))} onClick={() => void choose(true)}>Yes · {vote.yes.length}</button><button type="button" disabled={!eligible || busy} aria-pressed={Boolean(sessionId && vote.no.includes(sessionId))} onClick={() => void choose(false)}>No · {vote.no.length}</button></div>{error && <p role="alert">{error}</p>}</section>
}
