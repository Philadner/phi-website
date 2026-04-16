import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getMusicSearchResponse } from "./_lib/musicSearch"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const page = Number(typeof req.query.page === "string" ? req.query.page : "1")

  if (!query) {
    return res.status(400).json({ error: "Query required" })
  }

  try {
    const payload = await getMusicSearchResponse(query, page)
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300")
    return res.status(200).json(payload)
  } catch (error: unknown) {
    return res.status(500).json({
      error: "Hybrid music search failed",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
