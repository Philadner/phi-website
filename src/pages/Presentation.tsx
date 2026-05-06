import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import "../stylesheets/PresentationRemote.css"

type RoomState = {
  room: string
  createdAt: string
  pairedAt: string | null
  lastRemoteSeenAt: string | null
  command: {
    id: string
    type: "next" | "previous" | "ping"
    at: string
  } | null
}

type PresentationRoomRow = {
  room: string
  created_at: string
  paired_at: string | null
  last_remote_seen_at: string | null
  command_id: string | null
  command_type: "next" | "previous" | "ping" | null
  command_at: string | null
}

function createRoomId() {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function getRoomId() {
  const params = new URLSearchParams(window.location.search)
  const existing = params.get("room")
  if (existing) return existing

  const room = createRoomId()
  params.set("room", room)
  window.history.replaceState(null, "", `${window.location.pathname}?${params}`)
  return room
}

function cleanEnv(value: string | undefined) {
  const cleaned = value?.trim()
  if (!cleaned || cleaned === "\"\"" || cleaned === "''") return null
  return cleaned
}

function stateFromRow(row: PresentationRoomRow): RoomState {
  return {
    room: row.room,
    createdAt: row.created_at,
    pairedAt: row.paired_at,
    lastRemoteSeenAt: row.last_remote_seen_at,
    command:
      row.command_id && row.command_type && row.command_at
        ? {
            id: row.command_id,
            type: row.command_type,
            at: row.command_at,
          }
        : null,
  }
}

export default function Presentation() {
  const [room] = useState(getRoomId)
  const [state, setState] = useState<RoomState | null>(null)
  const [signalCount, setSignalCount] = useState(0)
  const [lastSignal, setLastSignal] = useState("Waiting for remote")
  const [connectionMode, setConnectionMode] = useState("Connecting")
  const lastCommandIdRef = useRef<string | null>(null)

  const remoteUrl = useMemo(() => {
    return `${window.location.origin}/remote?room=${encodeURIComponent(room)}`
  }, [room])

  const qrUrl = useMemo(() => {
    const encoded = encodeURIComponent(remoteUrl)
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encoded}`
  }, [remoteUrl])

  function applyState(nextState: RoomState) {
    setState(nextState)
    if (nextState.command && nextState.command.id !== lastCommandIdRef.current) {
      lastCommandIdRef.current = nextState.command.id
      setSignalCount((count) => count + 1)
      setLastSignal(nextState.command.type)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const response = await fetch(`/api/presentation-remote?room=${encodeURIComponent(room)}`, {
          cache: "no-store",
        })
        if (!response.ok) return

        const nextState = (await response.json()) as RoomState
        if (cancelled) return

        applyState(nextState)
      } catch {
        if (!cancelled) {
          setLastSignal("Connection check failed")
        }
      }
    }

    poll()
    const timer = window.setInterval(poll, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [room])

  useEffect(() => {
    const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL as string | undefined)
    const supabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
    if (!supabaseUrl || !supabaseAnonKey) {
      setConnectionMode("Realtime missing env")
      return
    }

    setConnectionMode("Realtime connecting")
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const channel = supabase
      .channel(`presentation-room-${room}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presentation_rooms",
          filter: `room=eq.${room}`,
        },
        (payload) => {
          const row = payload.new as PresentationRoomRow
          if (row?.room === room) {
            applyState(stateFromRow(row))
          }
        }
      )
      .subscribe((status) => {
        setConnectionMode(status === "SUBSCRIBED" ? "Realtime live" : "Realtime connecting")
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [room])

  const isPaired = Boolean(state?.pairedAt)

  return (
    <main className="pairing-screen pairing-screen--presentation">
      <section className="pairing-stage" aria-labelledby="presentation-demo-title">
        <div className="pairing-stage__copy">
          <p className="pairing-kicker">Phone remote demo</p>
          <h1 id="presentation-demo-title">Presentation link test</h1>
          <p className="pairing-lede">
            Scan the code, enter the super secret password, then press a control on your phone.
          </p>

          <div className="pairing-status-row" aria-live="polite">
            <span className={isPaired ? "pairing-dot pairing-dot--live" : "pairing-dot"} />
            <span>{isPaired ? "Remote paired" : "Waiting for phone"}</span>
          </div>

          <div className="pairing-status-row pairing-status-row--subtle" aria-live="polite">
            <span className={connectionMode === "Realtime live" ? "pairing-dot pairing-dot--live" : "pairing-dot"} />
            <span>{connectionMode}</span>
          </div>

          <div className="pairing-signal">
            <span>Last signal</span>
            <strong>{lastSignal}</strong>
          </div>

          <div className="pairing-counter" aria-label="Signals received">
            {signalCount}
          </div>
        </div>

        <div className="pairing-qr-panel">
          <img src={qrUrl} alt="QR code for phone remote" />
          <p>{remoteUrl}</p>
          <span>Room {room}</span>
        </div>
      </section>
    </main>
  )
}
