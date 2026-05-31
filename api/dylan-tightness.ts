import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createDylanTightnessPayload } from "./_lib/dylanTightness.js"

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const payload = await createDylanTightnessPayload()
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120")
    return res.status(200).json(payload)
  } catch (error) {
    return res.status(200).json({
      ok: false,
      configured: false,
      source: "demo",
      now: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Dylan tightness lookup failed",
      lastSeen: { online: null, game: null, apex: null, elden: null },
      history: [],
    })
  }
}
