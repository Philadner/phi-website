import { createHmac } from "node:crypto"
import type { VercelRequest, VercelResponse } from "@vercel/node"
import type { TrackResolveRequest, TrackResolveResponse } from "../src/lib/musicTypes.js"
import { getCachedJson } from "./_lib/serverCache.js"

const DEFAULT_YTDL_SERVICE_URL = "https://yt.phi.me.uk/api/ytdl"
const STARTER_URL_TTL_SECONDS = 2 * 60

type CachedPlayback = {
  video_id: string
  playback_url: string
  pathname?: string | null
  mime_type: string
  cached_at: string
}

function isTrackResolveRequest(value: unknown): value is TrackResolveRequest {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return typeof record.trackId === "string" && typeof record.videoId === "string"
}

function getServiceUrl() {
  const configured = process.env.YTDL_SERVICE_URL?.trim() || DEFAULT_YTDL_SERVICE_URL
  if (configured.endsWith("/api/ytdl")) {
    return new URL(configured)
  }
  return new URL(`${configured.replace(/\/+$/, "")}/api/ytdl`)
}

function getServiceSecret() {
  const serviceSecret = process.env.YTDL_SERVICE_SECRET?.trim() || process.env.YTDL_SECRET?.trim()
  if (!serviceSecret) throw new Error("YTDL service secret missing")
  return serviceSecret
}

function createStarterUrl(videoId: string) {
  const serviceSecret = getServiceSecret()
  const expiresAt = Math.floor(Date.now() / 1000) + STARTER_URL_TTL_SECONDS
  const signature = createHmac("sha256", serviceSecret)
    .update(`${videoId}:${expiresAt}`)
    .digest("hex")
  const url = getServiceUrl()
  url.pathname = url.pathname.replace(/\/api\/ytdl\/?$/, "/api/ytdl-stream")
  url.search = ""
  url.searchParams.set("videoId", videoId)
  url.searchParams.set("expires", String(expiresAt))
  url.searchParams.set("signature", signature)

  return {
    playbackUrl: url.toString(),
    expiresAt,
  }
}

async function resolveViaService(videoId: string) {
  const serviceSecret = getServiceSecret()

  const url = getServiceUrl()
  url.searchParams.set("videoId", videoId)
  url.searchParams.set("secret", serviceSecret)

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  })
  const payload = (await response.json()) as {
    status?: string
    blob?: {
      url?: string
      pathname?: string
      contentType?: string
    }
    cachedAt?: string
    error?: string
    message?: string
  }

  if (response.status === 202 || payload.status === "preparing") {
    return null
  }

  if (!response.ok || !payload.blob?.url) {
    throw new Error(payload.message || payload.error || `YTDL failed: ${response.status}`)
  }

  return {
    videoId,
    playbackUrl: payload.blob.url,
    mimeType: payload.blob.contentType || "audio/mpeg",
    cachedAt: payload.cachedAt || new Date().toISOString(),
  }
}

async function resolveFromCache(videoId: string) {
  const cached = await getCachedJson<CachedPlayback>(`music:ytdl:video:${videoId}`)
  if (!cached?.playback_url || !cached.mime_type || !cached.cached_at) return null

  return {
    videoId,
    playbackUrl: cached.playback_url,
    mimeType: cached.mime_type,
    cachedAt: cached.cached_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  let body: unknown = req.body
  if (typeof body === "string") {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" })
    }
  }
  if (!isTrackResolveRequest(body)) {
    return res.status(400).json({ error: "Invalid track payload" })
  }

  const videoId = body.videoId.trim()
  if (!videoId) {
    return res.status(400).json({ error: "Video id required" })
  }

  try {
    const cached = await resolveFromCache(videoId)
    if (cached) {
      return res.status(200).json({
        status: "ready",
        playbackUrl: cached.playbackUrl,
        mimeType: cached.mimeType,
        cachedAt: cached.cachedAt,
      } satisfies TrackResolveResponse)
    }

    if (body.intent === "play") {
      const starter = createStarterUrl(videoId)
      return res.status(200).json({
        status: "starter",
        playbackUrl: starter.playbackUrl,
        expiresAt: starter.expiresAt,
      } satisfies TrackResolveResponse)
    }

    const resolved = await resolveViaService(videoId)
    if (!resolved) {
      return res.status(200).json({
        status: "preparing",
        mode: "loading",
      } satisfies TrackResolveResponse)
    }

    return res.status(200).json({
      status: "ready",
      playbackUrl: resolved.playbackUrl,
      mimeType: resolved.mimeType,
      cachedAt: resolved.cachedAt,
    } satisfies TrackResolveResponse)
  } catch (error: unknown) {
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Track resolve failed",
    } satisfies TrackResolveResponse)
  }
}
