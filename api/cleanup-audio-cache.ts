import type { VercelRequest, VercelResponse } from "@vercel/node"
import { cleanupExpiredTracks } from "./_lib/playbackCache.js"

function isAuthorised(req: VercelRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization
  const bearer = typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "") : ""

  if (cronSecret) {
    return bearer === cronSecret
  }

  return Boolean(req.headers["x-vercel-cron"])
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  if (!isAuthorised(req)) {
    return res.status(401).json({ error: "Unauthorised" })
  }

  try {
    const removed = await cleanupExpiredTracks()
    return res.status(200).json({
      removedCount: removed.length,
      removed,
    })
  } catch (error: unknown) {
    return res.status(500).json({
      error: "Audio cleanup failed",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
