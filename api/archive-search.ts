import type { VercelRequest, VercelResponse } from "@vercel/node"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const page = typeof req.query.page === "string" ? req.query.page : "1"
  const rows = typeof req.query.rows === "string" ? req.query.rows : "20"

  if (!query) {
    return res.status(400).json({ error: "Query required" })
  }

  try {
    const url = new URL("https://archive.org/advancedsearch.php")
    url.searchParams.set(
      "q",
      `(title:("${query}") OR creator:("${query}")) AND mediatype:(audio)`
    )
    url.searchParams.set("fl[]", "identifier")
    url.searchParams.append("fl[]", "title")
    url.searchParams.append("fl[]", "creator")
    url.searchParams.append("fl[]", "downloads")
    url.searchParams.append("fl[]", "publicdate")
    url.searchParams.append("sort[]", "downloads desc")
    url.searchParams.set("rows", rows)
    url.searchParams.set("page", page)
    url.searchParams.set("output", "json")

    const archiveRes = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "phi-music-player",
      },
    })

    const body = await archiveRes.text()
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300")

    if (!archiveRes.ok) {
      return res.status(archiveRes.status).json({
        error: "Archive search failed",
        details: body.slice(0, 300),
      })
    }

    res.setHeader("Content-Type", "application/json")
    return res.status(200).send(body)
  } catch (error: unknown) {
    return res.status(500).json({
      error: "Unhandled archive search error",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
