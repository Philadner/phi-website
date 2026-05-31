import type { VercelRequest, VercelResponse } from "@vercel/node"
import { markDylanPageSeen } from "./_lib/dylanTightness"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  }

  try {
    return res.status(200).json(await markDylanPageSeen())
  } catch (error) {
    return res.status(200).json({
      ok: false,
      error: error instanceof Error ? error.message : "Dylan presence update failed",
    })
  }
}
