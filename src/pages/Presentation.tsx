import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { createClient } from "@supabase/supabase-js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faQrcode } from "@fortawesome/free-solid-svg-icons"
import "../stylesheets/PresentationRemote.css"

type RoomState = {
  room: string
  createdAt: string
  pairedAt: string | null
  lastRemoteSeenAt: string | null
  slideIndex: number
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

type DeckStep = number

const aiIntroText = "You've all probably used ai before."
const aiHelpItems = [
  "Look things up",
  "Do your sparx",
  "Make pictures",
]
const dadSiteImageUrl = "https://cdn.phi.me.uk/pictures/DadSite.png"
const claudeLogoUrl = "https://cdn.worldvectorlogo.com/logos/anthropic-1.svg"

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
  const slideIndex = row.command_id?.startsWith("slide:")
    ? Number(row.command_id.split(":")[1])
    : 0

  return {
    room: row.room,
    createdAt: row.created_at,
    pairedAt: row.paired_at,
    lastRemoteSeenAt: row.last_remote_seen_at,
    slideIndex: Number.isFinite(slideIndex) ? slideIndex : 0,
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

function AnimatedLetters({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`presentation-letter-line ${className}`} aria-label={text}>
      {Array.from(text).map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className="presentation-letter"
          style={{ "--letter-index": index } as CSSProperties}
          aria-hidden="true"
        >
          {letter === " " ? " " : letter}
        </span>
      ))}
    </span>
  )
}

export default function Presentation() {
  const [room] = useState(getRoomId)
  const [state, setState] = useState<RoomState | null>(null)
  const [connectionMode, setConnectionMode] = useState("Connecting")
  const [qrPanelOpen, setQrPanelOpen] = useState(false)
  const [deckStep, setDeckStep] = useState<DeckStep>(0)
  const [slideOneExiting, setSlideOneExiting] = useState(false)
  const lastCommandIdRef = useRef<string | null>(null)
  const deckStepRef = useRef<DeckStep>(0)
  const slideOneExitingRef = useRef(false)
  const slideOneExitTimerRef = useRef<number | null>(null)

  const remoteUrl = useMemo(() => {
    return `${window.location.origin}/remote?room=${encodeURIComponent(room)}`
  }, [room])

  const qrUrl = useMemo(() => {
    const encoded = encodeURIComponent(remoteUrl)
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encoded}`
  }, [remoteUrl])

  function advanceDeck() {
    if (slideOneExitingRef.current) return

    if (deckStepRef.current === 0) {
      slideOneExitingRef.current = true
      setSlideOneExiting(true)
      slideOneExitTimerRef.current = window.setTimeout(() => {
        deckStepRef.current = 1
        setDeckStep(1)
        slideOneExitingRef.current = false
        setSlideOneExiting(false)
      }, 680)
      return
    }

    if (deckStepRef.current < 27) {
      const nextStep = (deckStepRef.current + 1) as DeckStep
      deckStepRef.current = nextStep
      setDeckStep(nextStep)
    }
  }

  function retreatDeck() {
    if (slideOneExitTimerRef.current !== null) {
      window.clearTimeout(slideOneExitTimerRef.current)
      slideOneExitTimerRef.current = null
    }

    slideOneExitingRef.current = false
    setSlideOneExiting(false)

    if (deckStepRef.current > 0) {
      const previousStep = (deckStepRef.current - 1) as DeckStep
      deckStepRef.current = previousStep
      setDeckStep(previousStep)
    }
  }

  function handleRemoteCommand(command: RoomState["command"]) {
    if (!command || command.type === "ping") return
    if (command.type === "next") advanceDeck()
    if (command.type === "previous") retreatDeck()
  }

  function applyState(nextState: RoomState) {
    setState(nextState)
    if (!nextState.command || nextState.command.id === lastCommandIdRef.current) return

    if (lastCommandIdRef.current === null) {
      lastCommandIdRef.current = nextState.command.id
      return
    }

    lastCommandIdRef.current = nextState.command.id
    handleRemoteCommand(nextState.command)
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
        // Keep the realtime listener as the main path; polling is only a quiet fallback.
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

  useEffect(() => {
    return () => {
      if (slideOneExitTimerRef.current !== null) {
        window.clearTimeout(slideOneExitTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    void fetch(`/api/presentation-remote?room=${encodeURIComponent(room)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "slide", slideIndex: deckStep }),
    }).catch(() => {
      // Slide sync is for the remote notes only; presentation controls still work without it.
    })
  }, [deckStep, room])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault()
        advanceDeck()
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        retreatDeck()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const isPaired = Boolean(state?.pairedAt)
  const isRealtimeLive = connectionMode === "Realtime live"
  const remoteStatus = isPaired && isRealtimeLive ? "live" : isPaired ? "fallback" : "offline"
  const remoteStatusLabel =
    remoteStatus === "live"
      ? "Remote paired and realtime live"
      : remoteStatus === "fallback"
        ? "Remote paired on polling fallback"
        : "No remote connected"

  return (
    <main className="pairing-screen pairing-screen--presentation">
      <header className="presentation-topbar">
        <div className="presentation-brand" aria-label="phi">
          <svg className="presentation-phi-mark" viewBox="-10 -10 104 116" aria-hidden="true">
            <path d="M47.4691 94.8742V67.8693L47.9534 67.8537C52.3122 67.7166 56.6259 66.839 60.8958 65.2189V65.2199C64.8929 63.6903 68.4645 61.5771 71.6146 58.882L72.2396 58.3351L72.2454 58.3302C75.575 55.4373 78.2558 51.7818 80.2845 47.3546V47.3537C82.3061 42.928 83.3226 37.9032 83.3226 32.2697C83.3226 26.9517 82.5356 22.4635 80.9818 18.7882L80.6615 18.0636L80.6605 18.0627C79.0043 14.4679 76.8897 11.4427 74.3197 8.97964L73.7991 8.49429L73.7943 8.48941C71.3117 6.17323 68.5439 4.39348 65.4896 3.14664L64.8743 2.90445L64.8724 2.90347C61.5635 1.6319 58.291 0.999176 55.0521 0.999176C53.2704 0.999176 51.3345 1.22294 49.2425 1.67398L48.3363 1.88101L48.3333 1.88199L47.8841 1.99234C45.8085 2.52369 44.0577 3.2689 42.6224 4.22086L42.3197 4.42886H42.3187C40.5189 5.69142 39.0689 7.28919 37.9661 9.22574H37.9652C36.8915 11.1217 36.3441 13.4147 36.3441 16.1242V63.8459L35.8304 63.8322C29.1364 63.6535 23.7544 61.0487 19.7269 56.0246L19.3411 55.5314V55.5304C15.2859 50.1848 13.2816 43.2011 13.2816 34.6242C13.2816 26.5123 14.5431 20.091 17.1136 15.4044C19.6172 10.8398 23.2947 7.648 28.1283 5.84195L27.3236 1.50894C18.4518 3.72283 11.836 7.6445 7.42415 13.2462H7.42317C2.93466 18.9632 0.677078 26.0783 0.677078 34.6242C0.677079 44.2236 3.85313 52.0186 10.1888 58.0539C16.5273 64.0918 25.0701 67.3717 35.8665 67.8537L36.3441 67.8752V94.8742H47.4691ZM47.4691 13.1447C47.4691 10.8408 48.1377 8.9429 49.5091 7.50113L49.7923 7.2189C51.3473 5.75275 53.2424 5.01976 55.4476 5.01968C59.9233 5.01968 63.5868 7.49382 66.4398 12.2628L66.4388 12.2638C69.3084 17.0377 70.7191 23.5482 70.7191 31.7492C70.7191 40.5992 68.9526 47.9197 65.3841 53.6779L65.0335 54.2306C61.218 60.0959 55.5202 63.2933 48.0042 63.8312L47.4691 63.8693V13.1447Z" />
          </svg>
        </div>

        <div className="presentation-controls">
          <span
            className={`presentation-status-dot presentation-status-dot--${remoteStatus}`}
            aria-label={remoteStatusLabel}
            title={remoteStatusLabel}
          />
          <button
            className={`presentation-icon-button ${qrPanelOpen ? "presentation-icon-button--active" : ""}`}
            type="button"
            aria-label={qrPanelOpen ? "Hide phone pairing QR code" : "Show phone pairing QR code"}
            aria-pressed={qrPanelOpen}
            onClick={() => setQrPanelOpen((open) => !open)}
            title={qrPanelOpen ? "Hide QR code" : "Show QR code"}
          >
            <FontAwesomeIcon icon={faQrcode} />
          </button>
        </div>
      </header>

      <section className="presentation-slide-stage" aria-live="polite">
        {deckStep === 0 && (
          <section className={`presentation-slide presentation-slide--hello ${slideOneExiting ? "presentation-slide--hello-exit" : ""}`} aria-label="Hello">
            <h1>Hello</h1>
          </section>
        )}

        {(deckStep === 1 || deckStep === 2) && (
          <section className="presentation-slide presentation-slide--ai" aria-label="AI introduction">
            <h1>
              <AnimatedLetters text={aiIntroText} />
            </h1>

            {deckStep >= 2 && (
              <div className="presentation-ai-help">
                <h2>Ai helps you:</h2>
                <ul>
                  {aiHelpItems.map((item, itemIndex) => (
                    <li key={item} style={{ "--item-index": itemIndex } as CSSProperties}>
                      <AnimatedLetters text={item} className="presentation-ai-help__text" />
                      <span className="presentation-ai-check" aria-hidden="true">✓</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {deckStep === 3 && (
          <section className="presentation-slide presentation-slide--programming" aria-label="AI changed programming">
            <h1>
              <span>But it's also completely</span>
              <span className="presentation-programming-emphasis">changed programming.</span>
            </h1>
          </section>
        )}

        {deckStep === 4 && (
          <section className="presentation-slide presentation-slide--dad-site" aria-label="My dad built a website">
            <h1>My DAD built a website.</h1>
            <img src={dadSiteImageUrl} alt="Screenshot of Dad's website" />
            <p>This would usually take a small team of devs</p>
          </section>
        )}

        {(deckStep === 5 || deckStep === 6 || deckStep === 7) && (
          <section className="presentation-slide presentation-slide--developers" aria-label="Is AI bad for developers">
            <h1>
              <span>Is this bad for developers?</span>
              {deckStep >= 6 && <span className="presentation-gold presentation-inline-reveal">Not really.</span>}
            </h1>

            {deckStep >= 7 && (
              <p>
                Devs have been able to work <span className="presentation-gold">55%</span> faster.
              </p>
            )}
          </section>
        )}

        {deckStep === 8 && (
          <section className="presentation-slide presentation-slide--question" aria-label="Is it all sunshine and rainbows">
            <h1>So is it all sunshine and rainbows?</h1>
          </section>
        )}

        {(deckStep === 9 || deckStep === 10) && (
          <section className="presentation-slide presentation-slide--no" aria-label="No">
            <h1>No :(</h1>
            {deckStep >= 10 && <p>There's quite a few problems.</p>}
          </section>
        )}

        {(deckStep === 11 || deckStep === 12) && (
          <section className="presentation-slide presentation-slide--dad-security" aria-label="Back to my dad">
            <p className="presentation-corner-title">Back to my dad:</p>
            <h1>His website looked great and it worked</h1>
            {deckStep >= 12 && (
              <h2>
                But was it <span className="presentation-gold">secure?</span>
              </h2>
            )}
          </section>
        )}

        {deckStep === 13 && (
          <section className="presentation-slide presentation-slide--plain-no" aria-label="No">
            <h1>No.</h1>
          </section>
        )}

        {deckStep === 14 && (
          <section className="presentation-slide presentation-slide--claude" aria-label="My dad built it with Claude">
            <h1>My dad built it all with an ai called Claude.</h1>
            <img src={claudeLogoUrl} alt="Claude logo" />
          </section>
        )}

        {deckStep === 15 && (
          <section className="presentation-slide presentation-slide--claude-mistakes" aria-label="Claude made major mistakes">
            <h1>
              Now Claude had made <span>2</span> <span className="presentation-red">major</span> mistakes
            </h1>
          </section>
        )}

        {deckStep === 16 && (
          <section className="presentation-slide presentation-slide--mistake" aria-label="Users could mark jobs as paid">
            <h1>
              Users could mark their own jobs as paid for <span className="presentation-red">without paying</span>
            </h1>
          </section>
        )}

        {(deckStep === 17 || deckStep === 18) && (
          <section className="presentation-slide presentation-slide--mistake presentation-slide--mistake-long" aria-label="No password attempt limit">
            <h1>
              And there was no limit to how many passwords you can try,
            </h1>

            {deckStep >= 18 && (
              <p>
                So you could brute force to <span className="presentation-red">get into accounts</span>
              </p>
            )}
          </section>
        )}

        {(deckStep === 19 || deckStep === 20 || deckStep === 21) && (
          <section className="presentation-slide presentation-slide--issue-two" aria-label="Issue two">
            <p className="presentation-corner-title">Issue #2:</p>
            {deckStep >= 20 && <h1>Programmers don't know what their code does anymore.</h1>}
            {deckStep >= 21 && <h2>They don't even bother to read it</h2>}
          </section>
        )}

        {(deckStep === 22 || deckStep === 23) && (
          <section className="presentation-slide presentation-slide--trust-stat" aria-label="Developers do not fully trust AI code">
            <h1>96% of developers don't fully trust ai code</h1>
            {deckStep >= 23 && (
              <p>
                but <span className="presentation-underlined">only 48%</span> check the code before using it
              </p>
            )}
          </section>
        )}

        {(deckStep === 24 || deckStep === 25 || deckStep === 26) && (
          <section className="presentation-slide presentation-slide--confession" aria-label="This presentation was programmed with Codex">
            <h1>And yes, i'm guilty of this too.</h1>
            {deckStep >= 25 && (
              <p>
                This presentation was programmed with chatgpt codex <span>(don't worry i still wrote all the text)</span>
              </p>
            )}
            {deckStep >= 26 && <h2>I have no idea how it works</h2>}
          </section>
        )}

        {deckStep >= 27 && (
          <section className="presentation-slide presentation-slide--the-end" aria-label="The End">
            <h1>The End</h1>
          </section>
        )}
      </section>

      <aside className={`presentation-qr-drawer ${qrPanelOpen ? "presentation-qr-drawer--open" : ""}`} aria-hidden={!qrPanelOpen}>
        <div className="presentation-qr-panel">
          <p className="pairing-kicker">Phone pairing</p>
          <img src={qrUrl} alt="QR code for phone remote" />
          <p>{remoteUrl}</p>
          <span>Room {room}</span>
        </div>
      </aside>
    </main>
  )
}
