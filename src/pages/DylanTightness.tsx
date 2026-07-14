import { useCallback, useEffect, useMemo, useState } from 'react'
import '../stylesheets/DylanTightness.css'

type ActivityId = 'elden' | 'apex' | 'game' | 'online'

type DylanApiSample = {
  at: string
  tightness: number
  projectedTightness: number
  online: boolean
  game: boolean
  apex: boolean
  elden: boolean
  gameName: string | null
}

type DylanApiPayload = {
  ok: boolean
  configured: boolean
  now: string
  source: 'steam' | 'demo'
  error?: string
  setup?: string
  current?: {
    online: boolean
    game: boolean
    apex: boolean
    elden: boolean
    gameName: string | null
    tightness: number
    projectedTightness: number
    statusLabel: string
  }
  lastSeen: {
    online: string | null
    game: string | null
    apex: string | null
    elden: string | null
  }
  history: DylanApiSample[]
}

type LiveTracker = {
  id: ActivityId
  label: string
  shortLabel: string
  active: boolean
  lastSeenAt: Date | null
}

type GraphPoint = {
  at: Date
  value: number
}

const minute = 60 * 1000
const activityCopy: Record<ActivityId, { label: string; shortLabel: string }> = {
  elden: {
    label: 'Time since last elden ring',
    shortLabel: 'Elden Ring',
  },
  apex: {
    label: 'Time since last apex',
    shortLabel: 'Apex',
  },
  game: {
    label: 'Time since last game',
    shortLabel: 'Game',
  },
  online: {
    label: 'Time since last online',
    shortLabel: 'Online',
  },
}

const parseApiDate = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

const formatRelativeDuration = (from: Date | null, to: Date) => {
  if (!from) return '--'

  const diff = Math.max(0, to.getTime() - from.getTime())
  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m ago`
  if (minutes > 0) return `${minutes}m ${seconds.toString().padStart(2, '0')}s ago`
  return `${seconds}s ago`
}

const formatTrackerDuration = (from: Date | null, to: Date) => {
  if (!from) return '--'
  return formatRelativeDuration(from, to).replace(/ ago$/, '')
}

const buildGraphPoints = (samples: DylanApiSample[], current: DylanApiPayload['current'], updatedAt: Date | null) => {
  const sortedSamples = [...samples]
    .map((sample) => ({
      at: parseApiDate(sample.at),
      value: sample.tightness,
    }))
    .filter((sample): sample is GraphPoint => Boolean(sample.at) && Number.isFinite(sample.value))
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  if (current && updatedAt) {
    sortedSamples.push({
      at: updatedAt,
      value: current.tightness,
    })
  }

  if (!sortedSamples.length) {
    return [
      { at: new Date(Date.now() - minute), value: 0 },
      { at: new Date(), value: 0 },
    ]
  }

  return sortedSamples
}

function DylanTightness() {
  const [now, setNow] = useState(() => new Date())
  const [apiPayload, setApiPayload] = useState<DylanApiPayload | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const markPresence = useCallback(async () => {
    try {
      await fetch('/api/dylan-tightness-presence', { method: 'POST' })
    } catch {
      // Presence is only used to let cron back off while someone has the tracker open.
    }
  }, [])

  const loadStatus = useCallback(async () => {
    const requestedAt = new Date()
    setNow(requestedAt)
    setRefreshing(true)
    try {
      const response = await fetch(`/api/dylan-tightness?refresh=${requestedAt.getTime()}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as DylanApiPayload
      setApiPayload(payload)
      const updatedAt = parseApiDate(payload.now) || new Date()
      setLastUpdatedAt(updatedAt)
      setNow(new Date())
    } catch {
      setApiPayload(null)
      const failedAt = new Date()
      setLastUpdatedAt(failedAt)
      setNow(failedAt)
    } finally {
      setRefreshing(false)
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    await markPresence()
    await loadStatus()
  }, [loadStatus, markPresence])

  useEffect(() => {
    void markPresence()
    void refreshStatus()

    const presenceTimer = window.setInterval(() => void markPresence(), 60_000)
    const statusTimer = window.setInterval(() => void refreshStatus(), 60_000)

    return () => {
      window.clearInterval(presenceTimer)
      window.clearInterval(statusTimer)
    }
  }, [markPresence, refreshStatus])

  const trackers = useMemo<LiveTracker[]>(
    () =>
      (['elden', 'apex', 'game', 'online'] as ActivityId[]).map((id) => ({
        id,
        ...activityCopy[id],
        active: Boolean(apiPayload?.current?.[id]),
        lastSeenAt: parseApiDate(apiPayload?.lastSeen[id]),
      })),
    [apiPayload]
  )

  const graphPoints = useMemo(
    () => buildGraphPoints(apiPayload?.history ?? [], apiPayload?.current, lastUpdatedAt),
    [apiPayload, lastUpdatedAt]
  )
  const currentPoint = graphPoints[graphPoints.length - 1]
  const currentValue = apiPayload?.current?.tightness ?? currentPoint?.value ?? 0
  const currentLabel = apiPayload?.current?.statusLabel ?? (apiPayload?.setup ? 'waiting for setup' : 'waiting for steam')
  const denominator = Math.max(1, graphPoints.length - 1)
  const path = graphPoints
    .map((point, index) => {
      const x = (index / denominator) * 1000
      const y = Math.max(25, Math.min(260, 260 - point.value * 2.35))
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  const areaPath = `${path} L 1000 280 L 0 280 Z`

  return (
    <main className="dylan-tightness-page">
      <section className="dylan-hero" aria-labelledby="dylan-title">
        <h1 id="dylan-title">
          <span className="dylan-warning">◆</span>
          Dylan Tightness Tracker
        </h1>
      </section>

      <section className="dylan-readout" aria-label="Current tightness level">
        <div>
          <p className="dylan-readout__label">Current Condition</p>
          <strong>{Math.round(currentValue)} / 100</strong>
          <span>{currentLabel.toUpperCase()}</span>
        </div>
      </section>

      <section className="dylan-tracker-grid" aria-label="Live trackers">
        {trackers.map((tracker) => (
          <article className={`dylan-tracker-card ${tracker.active ? 'is-active' : ''}`} key={tracker.id}>
            <div className="dylan-tracker-card__header">
              <span className="dylan-tracker-card__icon">◈</span>
              <h2>{tracker.label}</h2>
              {tracker.active && (
                <span className="dylan-now">
                  <span className="dylan-red-dot" />
                  NOW
                </span>
              )}
            </div>
            <strong>{tracker.active ? 'NOW' : formatTrackerDuration(tracker.lastSeenAt, now)}</strong>
            <p>
              {tracker.active
                ? `${tracker.shortLabel} is happening right now`
                : tracker.lastSeenAt
                  ? `Last ${tracker.shortLabel.toLowerCase()} signal seen ${formatRelativeDuration(tracker.lastSeenAt, now)}`
                  : 'Waiting for stored Steam history'}
            </p>
          </article>
        ))}
      </section>

      <section className="dylan-graph-panel" aria-labelledby="dylan-graph-title">
        <div className="dylan-panel-head">
          <div>
            <p>Timeline View</p>
            <h2 id="dylan-graph-title">Tightness</h2>
          </div>
          <div className="dylan-panel-actions">
            <span className="dylan-updated">Updated {formatRelativeDuration(lastUpdatedAt, now)}</span>
            <button className="dylan-refresh" disabled={refreshing} onClick={() => void refreshStatus()} type="button">
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
            <span className="dylan-live-pill">
              <span className={apiPayload?.ok ? 'dylan-green-dot' : 'dylan-red-dot'} />
              {apiPayload?.ok ? 'LIVE' : 'WAITING'}
            </span>
          </div>
        </div>

        <div className="dylan-chart-wrap">
          <svg className="dylan-chart" viewBox="0 0 1000 320" role="img" aria-label="Dylan tightness graph over the last 24 hours">
            <defs>
              <linearGradient id="dylan-tightness-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
                <stop offset="55%" stopColor="#ffffff" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#020713" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g className="dylan-chart-zones">
              <rect className="dylan-zone dylan-zone--elden" x="0" y="25" width="1000" height="47" />
              <rect className="dylan-zone dylan-zone--apex" x="0" y="72" width="1000" height="47" />
              <rect className="dylan-zone dylan-zone--game" x="0" y="119" width="1000" height="47" />
              <rect className="dylan-zone dylan-zone--online" x="0" y="166" width="1000" height="47" />
              <rect className="dylan-zone dylan-zone--loose" x="0" y="213" width="1000" height="47" />
            </g>

            <g className="dylan-chart-grid">
              {[0, 1, 2, 3, 4].map((line) => (
                <line key={line} x1="0" x2="1000" y1={40 + line * 55} y2={40 + line * 55} />
              ))}
            </g>

            <path d={areaPath} fill="url(#dylan-tightness-area)" />
            <path d={path} fill="none" stroke="#f6fbff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" />
            <line className="dylan-now-line" x1="1000" x2="1000" y1="24" y2="284" />
            <circle cx="1000" cy={(260 - currentValue * 2.35).toFixed(1)} r="10" fill="#ffffff" />
          </svg>
        </div>

        <div className="dylan-legend">
          <span><i className="dylan-legend__loose" /> Hella loose</span>
          <span><i className="dylan-legend__online" /> Online</span>
          <span><i className="dylan-legend__game" /> Any game</span>
          <span><i className="dylan-legend__apex" /> Apex</span>
          <span><i className="dylan-legend__elden" /> Elden Ring</span>
        </div>
      </section>
    </main>
  )
}

export default DylanTightness
