import type { VercelRequest, VercelResponse } from "@vercel/node"
import {
  createCommand,
  createSlideSyncCommand,
  readRoomState,
  writeRoomState,
  type RemoteCommandType,
} from "./_lib/presentationRemote.js"

const PASSWORD = "a"

function isValidRoom(room: unknown) {
  return typeof room === "string" && /^[a-z0-9-]{4,64}$/i.test(room)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store")

  const room = String(req.query.room || "")
  if (!isValidRoom(room)) {
    return res.status(400).json({ error: "Invalid room" })
  }

  if (req.method === "GET") {
    const state = await readRoomState(room)
    return res.status(200).json(state)
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const body = (req.body || {}) as {
    action?: string
    password?: string
    command?: RemoteCommandType
    slideIndex?: number
  }

  const state = await readRoomState(room)
  const now = new Date().toISOString()

  if (body.action === "slide") {
    if (typeof body.slideIndex !== "number" || !Number.isFinite(body.slideIndex)) {
      return res.status(400).json({ error: "Invalid slide index" })
    }

    state.command = createSlideSyncCommand(body.slideIndex)
    return res.status(200).json(await writeRoomState(state))
  }

  if (body.password !== PASSWORD) {
    return res.status(401).json({ error: "Wrong password" })
  }

  if (body.action === "pair") {
    state.pairedAt = state.pairedAt || now
    state.lastRemoteSeenAt = now
    return res.status(200).json(await writeRoomState(state))
  }

  if (body.action === "command") {
    if (body.command !== "next" && body.command !== "previous" && body.command !== "ping") {
      return res.status(400).json({ error: "Invalid command" })
    }

    state.pairedAt = state.pairedAt || now
    state.lastRemoteSeenAt = now
    state.command = createCommand(body.command as RemoteCommandType)
    return res.status(200).json(await writeRoomState(state))
  }

  return res.status(400).json({ error: "Invalid action" })
}
