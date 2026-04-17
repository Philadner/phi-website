import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createSearchTrace, streamMusicSearchResponse } from "./_lib/musicSearch.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const page = Number(typeof req.query.page === "string" ? req.query.page : "1")
  const harder =
    typeof req.query.harder === "string" &&
    ["1", "true", "yes", "on"].includes(req.query.harder.toLowerCase())

  if (!query) {
    return res.status(400).json({ error: "Query required" })
  }

  const trace = createSearchTrace(query, page)

  try {
    trace.log("request:start")
    res.setHeader("x-music-search-request-id", trace.requestId)
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300")
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8")
    res.setHeader("Transfer-Encoding", "chunked")

    await streamMusicSearchResponse(
      query,
      page,
      async (chunk) => {
        res.write(`${JSON.stringify(chunk)}\n`)
      },
      trace,
      harder
    )

    return res.end()
  } catch (error: unknown) {
    trace.flush("error", {
      message: error instanceof Error ? error.message : "Unknown error",
    })
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Hybrid music search failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }

    res.write(
      `${JSON.stringify({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      })}\n`
    )
    return res.end()
  }
}
