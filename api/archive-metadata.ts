import type { VercelRequest, VercelResponse } from "@vercel/node"
import { archiveFetch } from "./_lib/archiveFetch.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === "string" ? req.query.id.trim() : ""

  if (!id) {
    return res.status(400).json({ error: "Album id required" })
  }

  try {
    const archiveRes = await archiveFetch(
      `https://archive.org/metadata/${encodeURIComponent(id)}`
    )

    const body = await archiveRes.text()
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800")

    if (!archiveRes.ok) {
      return res.status(archiveRes.status).json({
        error: "Archive metadata failed",
        details: body.slice(0, 300),
      })
    }

    res.setHeader("Content-Type", "application/json")
    return res.status(200).send(body)
  } catch (error: unknown) {
    return res.status(500).json({
      error: "Unhandled archive metadata error",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
