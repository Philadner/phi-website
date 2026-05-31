import type { VercelRequest, VercelResponse } from "@vercel/node"
import { recordPhilTightnessSample } from "./_lib/philTightness.js"

function isAuthorized(req: VercelRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return true
  return req.headers.authorization === `Bearer ${secret}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" })
  }

  try {
    return res.status(200).json(await recordPhilTightnessSample())
  } catch (error) {
    return res.status(200).json({
      ok: false,
      error: error instanceof Error ? error.message : "Phil cron failed",
    })
  }
}
