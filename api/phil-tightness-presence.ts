import type { VercelRequest, VercelResponse } from "@vercel/node"
import { markPhilPageSeen } from "./_lib/philTightness.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  }

  try {
    return res.status(200).json(await markPhilPageSeen())
  } catch (error) {
    return res.status(200).json({
      ok: false,
      error: error instanceof Error ? error.message : "Phil presence update failed",
    })
  }
}
