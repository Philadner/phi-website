import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import "../stylesheets/PresentationRemote.css"

type RemoteState = "locked" | "pairing" | "paired" | "error"

export default function Remote() {
  const room = useMemo(() => new URLSearchParams(window.location.search).get("room") || "", [])
  const [password, setPassword] = useState("")
  const [remoteState, setRemoteState] = useState<RemoteState>("locked")
  const [message, setMessage] = useState("Enter the super secret password.")
  const [lastCommand, setLastCommand] = useState("None yet")

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
    return data
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
      await postRemote("pair")
      setRemoteState("paired")
      setMessage("Connected to the presentation.")
    } catch (error) {
      setRemoteState("error")
      setMessage(error instanceof Error ? error.message : "Pairing failed")
    }
  }

  async function sendCommand(command: "next" | "previous" | "ping") {
    setLastCommand(`Sending ${command}...`)
    try {
      await postRemote("command", command)
      setRemoteState("paired")
      setMessage("Signal sent.")
      setLastCommand(command)
    } catch (error) {
      setRemoteState("error")
      setMessage(error instanceof Error ? error.message : "Signal failed")
      setLastCommand("Failed")
    }
  }

  const isPaired = remoteState === "paired"

  return (
    <main className="pairing-screen pairing-screen--remote">
      <section className="remote-shell" aria-labelledby="remote-title">
        <p className="pairing-kicker">Room {room || "missing"}</p>
        <h1 id="remote-title">Phone remote</h1>

        {!isPaired ? (
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
        ) : (
          <div className="remote-controls">
            <button type="button" onClick={() => sendCommand("previous")}>
              Back
            </button>
            <button type="button" className="remote-controls__primary" onClick={() => sendCommand("ping")}>
              Test link
            </button>
            <button type="button" onClick={() => sendCommand("next")}>
              Next
            </button>
          </div>
        )}

        <div className="remote-readout" aria-live="polite">
          <span>{message}</span>
          <strong>Last command: {lastCommand}</strong>
        </div>
      </section>
    </main>
  )
}
