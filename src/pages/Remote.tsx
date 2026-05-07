import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons"
import ReactMarkdown from "react-markdown"
import notesMarkdown from "../content/presentationNotes.md?raw"
import "../stylesheets/PresentationRemote.css"

type RemoteState = "locked" | "pairing" | "paired" | "error"
type SendState = "idle" | "sending" | "sent" | "error"
type RoomState = {
  slideIndex?: number
  command?: {
    id: string
  } | null
}
type PresentationNote = {
  title: string
  body: string
}

function parsePresentationNotes(markdown: string) {
  const notes: PresentationNote[] = []
  let current: PresentationNote | null = null

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#\s+(.+)$/)
    if (heading) {
      if (current) notes.push(current)
      current = {
        title: heading[1].trim(),
        body: "",
      }
      continue
    }

    if (current) {
      current.body += `${line}\n`
    }
  }

  if (current) notes.push(current)
  return notes.length ? notes : [{ title: "Notes", body: "No notes yet." }]
}

const presentationNotes = parsePresentationNotes(notesMarkdown)

function slideIndexFromState(state: RoomState) {
  const commandId = state.command?.id
  if (commandId?.startsWith("slide:")) {
    const parsed = Number(commandId.split(":")[1])
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

export default function Remote() {
  const room = useMemo(() => new URLSearchParams(window.location.search).get("room") || "", [])
  const [password, setPassword] = useState("")
  const [remoteState, setRemoteState] = useState<RemoteState>("locked")
  const [message, setMessage] = useState("Enter the super secret password.")
  const [sendState, setSendState] = useState<SendState>("idle")
  const [currentSlide, setCurrentSlide] = useState(0)

  function syncSlideFromState(state: RoomState) {
    const slideIndex = slideIndexFromState(state)
    if (slideIndex === null) return
    setCurrentSlide(Math.max(0, Math.min(slideIndex, presentationNotes.length - 1)))
  }

  async function getRoomState() {
    const response = await fetch(`/api/presentation-remote?room=${encodeURIComponent(room)}`, {
      cache: "no-store",
    })
    if (!response.ok) throw new Error("Could not sync presentation")
    return (await response.json()) as RoomState
  }

  async function postRemote(action: "pair" | "command", command?: "next" | "previous" | "ping") {
    const response = await fetch(`/api/presentation-remote?room=${encodeURIComponent(room)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, command, password }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.error || "Remote request failed")
    }
    return data as RoomState
  }

  async function pair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!room) {
      setRemoteState("error")
      setMessage("Missing room code. Scan the QR code again.")
      return
    }

    setRemoteState("pairing")
    setMessage("Pairing...")

    try {
      const state = await postRemote("pair")
      syncSlideFromState(state)
      setRemoteState("paired")
      setMessage("Connected to the presentation.")
      setSendState("sent")
      window.setTimeout(() => setSendState("idle"), 1000)
    } catch (error) {
      setRemoteState("error")
      setMessage(error instanceof Error ? error.message : "Pairing failed")
      setSendState("error")
      window.setTimeout(() => setSendState("idle"), 1400)
    }
  }

  async function sendCommand(command: "next" | "previous") {
    setSendState("sending")
    setCurrentSlide((slide) => {
      if (command === "next") return Math.min(slide + 1, presentationNotes.length - 1)
      return Math.max(slide - 1, 0)
    })

    try {
      await postRemote("command", command)
      setRemoteState("paired")
      setSendState("sent")
      window.setTimeout(() => setSendState("idle"), 1000)
    } catch (error) {
      setRemoteState("error")
      setMessage(error instanceof Error ? error.message : "Signal failed")
      setSendState("error")
      window.setTimeout(() => setSendState("idle"), 1400)
    }
  }

  const isPaired = remoteState === "paired"
  const note = presentationNotes[currentSlide] || presentationNotes[0]

  useEffect(() => {
    if (!isPaired || !room) return

    let cancelled = false

    async function sync() {
      try {
        const state = await getRoomState()
        if (!cancelled) syncSlideFromState(state)
      } catch {
        // The send bar handles command errors; note sync should stay quiet.
      }
    }

    sync()
    const timer = window.setInterval(sync, 800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isPaired, room])

  return (
    <main className="pairing-screen pairing-screen--remote">
      <div className={`remote-send-bar remote-send-bar--${sendState}`} aria-hidden="true" />

      <section className={`remote-shell ${isPaired ? "remote-shell--paired" : ""}`} aria-labelledby="remote-title">
        {!isPaired ? (
          <>
            <p className="pairing-kicker">Room {room || "missing"}</p>
            <h1 id="remote-title">Phone remote</h1>
            <form className="remote-form" onSubmit={pair}>
              <label htmlFor="remote-password">Super secret password</label>
              <input
                id="remote-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
                autoFocus
              />
              <button type="submit" disabled={remoteState === "pairing"}>
                Pair phone
              </button>
            </form>
            <p className="remote-pair-message" aria-live="polite">{message}</p>
          </>
        ) : (
          <>
            <div className="remote-notes-meta">
              <span>Slide {currentSlide + 1} / {presentationNotes.length}</span>
              <strong>{note.title}</strong>
            </div>
            <article className="remote-notes">
              <ReactMarkdown>{note.body}</ReactMarkdown>
            </article>
            <nav className="remote-bottom-controls" aria-label="Presentation controls">
              <button type="button" onClick={() => sendCommand("previous")} aria-label="Previous slide">
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
              <button type="button" onClick={() => sendCommand("next")} aria-label="Next slide">
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </nav>
          </>
        )}
      </section>
    </main>
  )
}
