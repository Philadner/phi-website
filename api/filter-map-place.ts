import type { VercelRequest, VercelResponse } from "@vercel/node"

type Candidate = {
  index: number
  name: string
  text: string
  type: string
  longitude: number
  latitude: number
  distanceKm: number
}

type OpenAIResponsePayload = {
  output_text?: unknown
  output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>
  error?: { code?: unknown }
}

const windowMs = 60_000
const maxRequestsPerWindow = 30
const requestLog = new Map<string, number[]>()

function isRateLimited(req: VercelRequest) {
  const forwarded = req.headers["x-forwarded-for"]
  const clientId = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim() || "unknown"
  const now = Date.now()
  const recent = (requestLog.get(clientId) || []).filter((time) => now - time < windowMs)
  recent.push(now)
  requestLog.set(clientId, recent)
  return recent.length > maxRequestsPerWindow
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function extractOutputText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === "string") return payload.output_text
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text
    }
  }
  return ""
}

function cleanCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 10).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return []
    const item = candidate as Record<string, unknown>
    const longitude = finiteNumber(item.longitude, Number.NaN)
    const latitude = finiteNumber(item.latitude, Number.NaN)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return []
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return []
    return [{
      index,
      name: cleanText(item.name, 180),
      text: cleanText(item.text, 100),
      type: cleanText(item.type, 80),
      longitude,
      latitude,
      distanceKm: Math.max(0, finiteNumber(item.distanceKm)),
    }]
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store")
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
  if (isRateLimited(req)) return res.status(429).json({ error: "Place resolver saturated." })

  const query = cleanText(req.body?.query, 180)
  const candidates = cleanCandidates(req.body?.candidates)
  if (!query || !candidates.length) return res.status(400).json({ error: "No place candidates received." })

  const context = req.body?.context && typeof req.body.context === "object"
    ? req.body.context as Record<string, unknown>
    : {}
  const mapContext = {
    area: cleanText(context.area, 180),
    longitude: finiteNumber(context.longitude),
    latitude: finiteNumber(context.latitude),
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(503).json({ error: "Neural link unavailable." })

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning: { effort: "low" },
        store: false,
        max_output_tokens: 180,
        instructions: `Choose the single geocoding candidate that best matches the user's intended place. Correct obvious misspellings and aliases. Prefer an internationally famous exact landmark, venue, city, or country match over a weak nearby name match. Use the current map area only to resolve genuinely ambiguous local names; distance is a tie-breaker, never a reason to reject an unmistakable famous place. Candidate indexes are authoritative. Return only a valid candidate index and a very short reason.`,
        input: JSON.stringify({ query, mapContext, candidates }),
        text: {
          format: {
            type: "json_schema",
            name: "place_candidate_selection",
            strict: true,
            schema: {
              type: "object",
              properties: {
                selectedIndex: { type: "number" },
                reason: { type: "string" },
              },
              required: ["selectedIndex", "reason"],
              additionalProperties: false,
            },
          },
        },
      }),
    })

    const payload = await response.json() as OpenAIResponsePayload
    if (!response.ok) {
      console.error("OpenAI place resolution failed", response.status, payload.error?.code)
      return res.status(502).json({ error: "Place resolver returned static." })
    }

    const selection = JSON.parse(extractOutputText(payload)) as { selectedIndex?: unknown; reason?: unknown }
    const selectedIndex = Math.round(finiteNumber(selection.selectedIndex, 0))
    const selected = candidates.find((candidate) => candidate.index === selectedIndex) || candidates[0]
    return res.status(200).json({ selectedIndex: selected.index, reason: cleanText(selection.reason, 100) })
  } catch (error) {
    console.error("Place resolution failed", error)
    return res.status(500).json({ error: "Place resolver disappeared." })
  }
}
