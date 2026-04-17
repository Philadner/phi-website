import type { VercelRequest, VercelResponse } from "@vercel/node"
import type { TrackResolveRequest } from "../src/lib/musicTypes"
import { resolveTrackPlayback } from "./_lib/playbackCache.js"

function isTrackResolveRequest(value: unknown): value is TrackResolveRequest {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.trackId === "string" &&
    typeof record.archiveItemId === "string" &&
    typeof record.archiveFileName === "string"
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  let body: unknown = req.body
  if (typeof body === "string") {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" })
    }
  }
  if (!isTrackResolveRequest(body)) {
    return res.status(400).json({ error: "Invalid track payload" })
  }

  try {
    const payload = await resolveTrackPlayback(body)
    if (payload.status === "error") {
      return res.status(500).json(payload)
    }

    return res.status(200).json(payload)
  } catch (error: unknown) {
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Track resolve failed",
    })
  }
}
