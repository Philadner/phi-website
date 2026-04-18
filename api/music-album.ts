import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getMusicAlbumPayload } from "./_lib/musicSearch.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id.trim() : ""

  if (!id) {
    return res.status(400).json({ error: "Album id required" })
  }

  try {
    const payload = await getMusicAlbumPayload(id)
    if (!payload) {
      return res.status(404).json({ error: "Album not found" })
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800")
    return res.status(200).json(payload)
  } catch (error: unknown) {
    return res.status(500).json({
      error: "Album lookup failed",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
