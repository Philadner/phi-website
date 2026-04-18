import type { VercelRequest, VercelResponse } from "@vercel/node"
import type { TrackResolveRequest, TrackResolveResponse } from "../src/lib/musicTypes"
import {
  acquireLock,
  getCachedJson,
  releaseLock,
  setCachedJson,
} from "./_lib/serverCache.js"

type CachedPlayback = {
  videoId: string
  playbackUrl: string
  mimeType: string
  cachedAt: string
  pathname?: string
}

const LOCK_TTL_SECONDS = 5 * 60
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60

function isTrackResolveRequest(value: unknown): value is TrackResolveRequest {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return typeof record.trackId === "string" && typeof record.videoId === "string"
}

function cacheKey(videoId: string) {
  return `music:ytdl:video:${encodeURIComponent(videoId)}`
}

function lockKey(videoId: string) {
  return `music:ytdl:video:lock:${encodeURIComponent(videoId)}`
}

function getBaseUrl(req: VercelRequest) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL
  const protocol =
    (req.headers["x-forwarded-proto"] as string | undefined) ||
    (process.env.NODE_ENV === "development" ? "http" : "https")

  if (!host || typeof host !== "string") {
    throw new Error("Unable to determine request host")
  }

  return `${protocol}://${host}`
}

async function resolveViaRust(req: VercelRequest, videoId: string): Promise<CachedPlayback> {
  const ytdlSecret = process.env.YTDL_SECRET?.trim()
  if (!ytdlSecret) {
    throw new Error("YTDL_SECRET missing")
  }

  const url = new URL("/api/ytdl", getBaseUrl(req))
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`)
  url.searchParams.set("secret", ytdlSecret)

  const response = await fetch(url.toString())
  const payload = (await response.json()) as {
    blob?: {
      url?: string
      pathname?: string
      contentType?: string
    }
    error?: string
    message?: string
  }

  if (!response.ok || !payload.blob?.url) {
    throw new Error(payload.message || payload.error || `YTDL failed: ${response.status}`)
  }

  return {
    videoId,
    playbackUrl: payload.blob.url,
    pathname: payload.blob.pathname,
    mimeType: payload.blob.contentType || "audio/mpeg",
    cachedAt: new Date().toISOString(),
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
    const cached = await getCachedJson<CachedPlayback>(cacheKey(videoId))
    if (cached?.playbackUrl) {
      return res.status(200).json({
        status: "ready",
        playbackUrl: cached.playbackUrl,
        mimeType: cached.mimeType,
        cachedAt: cached.cachedAt,
      } satisfies TrackResolveResponse)
    }

    const lock = await acquireLock(lockKey(videoId), LOCK_TTL_SECONDS)
    if (!lock) {
      return res.status(200).json({
        status: "preparing",
        mode: "loading",
      } satisfies TrackResolveResponse)
    }

    try {
      const doubleChecked = await getCachedJson<CachedPlayback>(cacheKey(videoId))
      if (doubleChecked?.playbackUrl) {
        return res.status(200).json({
          status: "ready",
          playbackUrl: doubleChecked.playbackUrl,
          mimeType: doubleChecked.mimeType,
          cachedAt: doubleChecked.cachedAt,
        } satisfies TrackResolveResponse)
      }

      const resolved = await resolveViaRust(req, videoId)
      await setCachedJson(cacheKey(videoId), resolved, CACHE_TTL_SECONDS)

      return res.status(200).json({
        status: "ready",
        playbackUrl: resolved.playbackUrl,
        mimeType: resolved.mimeType,
        cachedAt: resolved.cachedAt,
      } satisfies TrackResolveResponse)
    } finally {
      await releaseLock(lockKey(videoId))
    }
  } catch (error: unknown) {
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Track resolve failed",
    } satisfies TrackResolveResponse)
  }
}
