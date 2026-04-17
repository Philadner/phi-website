import { createWriteStream } from "node:fs"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import {
  buildArchiveDownloadUrl,
  type QueueTrack,
  type TrackResolveRequest,
  type TrackResolveResponse,
} from "../../src/lib/musicTypes.js"
import { archiveFetch } from "./archiveFetch.js"
import { deleteBlobUrl, isBlobConfigured, putAudioBlob } from "./blobStore.js"
import {
  acquireLock,
  addToSet,
  deleteCachedKeys,
  getCachedJson,
  getSetMembers,
  releaseLock,
  removeFromSet,
  setCachedJson,
} from "./serverCache.js"

type PlaybackRecord = {
  trackId: string
  archiveItemId: string
  archiveFileName: string
  blobUrl: string
  mimeType: string
  createdAt: string
  lastPlayed: string
  playCount: number
}

type PreparationMode = "loading" | "compressing"

const TRACK_INDEX_KEY = "music:track:index"
const LOCK_TTL_SECONDS = 15 * 60
const FAILURE_TTL_SECONDS = 60 * 60
const STALE_TRACK_MS = 30 * 24 * 60 * 60 * 1000

function trackKey(trackId: string) {
  return `music:track:${trackId}`
}

function trackLockKey(trackId: string) {
  return `music:track:lock:${trackId}`
}

function trackFailureKey(trackId: string) {
  return `music:track:failure:${trackId}`
}

function nowIso() {
  return new Date().toISOString()
}

function ensureTrackInput(track: TrackResolveRequest | QueueTrack): TrackResolveRequest {
  return {
    trackId: track.trackId,
    archiveItemId: track.archiveItemId,
    archiveFileName: track.archiveFileName,
    sourceSizeBytes: track.sourceSizeBytes,
  }
}

function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase()
}

function getAudioMimeType(fileName: string) {
  switch (getFileExtension(fileName)) {
    case ".mp3":
      return "audio/mpeg"
    case ".m4a":
    case ".aac":
      return "audio/aac"
    case ".ogg":
    case ".oga":
    case ".opus":
      return "audio/ogg"
    case ".wav":
      return "audio/wav"
    case ".aif":
    case ".aiff":
      return "audio/aiff"
    case ".flac":
      return "audio/flac"
    default:
      return "application/octet-stream"
  }
}

function getPreparationMode(track: TrackResolveRequest): PreparationMode {
  const extension = getFileExtension(track.archiveFileName)
  if ([".flac", ".wav", ".aif", ".aiff"].includes(extension)) {
    return "compressing"
  }

  if ((track.sourceSizeBytes || 0) > 25 * 1024 * 1024) {
    return "compressing"
  }

  return "loading"
}

async function streamArchiveSource(track: TrackResolveRequest, destination: string) {
  const response = await archiveFetch(
    buildArchiveDownloadUrl(track.archiveItemId, track.archiveFileName)
  )

  if (!response.ok || !response.body) {
    throw new Error(`Archive source failed: ${response.status}`)
  }

  const body = Readable.fromWeb(response.body as unknown as globalThis.ReadableStream)
  await pipeline(body, createWriteStream(destination))
}

async function transcodeToMp3(sourcePath: string, outputPath: string) {
  const binary = ffmpegInstaller.path || "ffmpeg"

  await new Promise<void>((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(binary, [
      "-y",
      "-i",
      sourcePath,
      "-vn",
      "-map_metadata",
      "-1",
      "-acodec",
      "libmp3lame",
      "-b:a",
      "192k",
      outputPath,
    ])

    let stderr = ""
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr || `ffmpeg exited with code ${code}`))
    })
  })
}

async function copySourceToBlob(track: TrackResolveRequest, sourcePath: string) {
  const body = await fs.readFile(sourcePath)
  const extension = getFileExtension(track.archiveFileName) || ".bin"

  if (!isBlobConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      return {
        trackId: track.trackId,
        archiveItemId: track.archiveItemId,
        archiveFileName: track.archiveFileName,
        blobUrl: buildArchiveDownloadUrl(track.archiveItemId, track.archiveFileName),
        mimeType: getAudioMimeType(track.archiveFileName),
        createdAt: nowIso(),
        lastPlayed: nowIso(),
        playCount: 0,
      } satisfies PlaybackRecord
    }

    throw new Error("Blob storage is not configured")
  }

  const blob = await putAudioBlob(track.trackId, extension, body, getAudioMimeType(track.archiveFileName))
  const createdAt = nowIso()
  return {
    trackId: track.trackId,
    archiveItemId: track.archiveItemId,
    archiveFileName: track.archiveFileName,
    blobUrl: blob.url,
    mimeType: getAudioMimeType(track.archiveFileName),
    createdAt,
    lastPlayed: createdAt,
    playCount: 0,
  } satisfies PlaybackRecord
}

async function prepareTrack(track: TrackResolveRequest) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "phi-music-"))
  const sourcePath = path.join(tempRoot, "input")
  const outputPath = path.join(tempRoot, `${track.trackId}.mp3`)

  try {
    await streamArchiveSource(track, sourcePath)
    if (getPreparationMode(track) === "loading") {
      return await copySourceToBlob(track, sourcePath)
    }

    await transcodeToMp3(sourcePath, outputPath)
    const body = await fs.readFile(outputPath)

    if (!isBlobConfigured()) {
      if (process.env.NODE_ENV !== "production") {
        return {
          trackId: track.trackId,
          archiveItemId: track.archiveItemId,
          archiveFileName: track.archiveFileName,
          blobUrl: buildArchiveDownloadUrl(track.archiveItemId, track.archiveFileName),
          mimeType: "audio/mpeg",
          createdAt: nowIso(),
          lastPlayed: nowIso(),
          playCount: 0,
        } satisfies PlaybackRecord
      }

      throw new Error("Blob storage is not configured")
    }

    const blob = await putAudioBlob(track.trackId, ".mp3", body, "audio/mpeg")
    const createdAt = nowIso()
    return {
      trackId: track.trackId,
      archiveItemId: track.archiveItemId,
      archiveFileName: track.archiveFileName,
      blobUrl: blob.url,
      mimeType: "audio/mpeg",
      createdAt,
      lastPlayed: createdAt,
      playCount: 0,
    } satisfies PlaybackRecord
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
}

async function touchTrack(record: PlaybackRecord) {
  const nextRecord = {
    ...record,
    lastPlayed: nowIso(),
    playCount: (record.playCount || 0) + 1,
  }
  await setCachedJson(trackKey(record.trackId), nextRecord)
  await addToSet(TRACK_INDEX_KEY, record.trackId)
  return nextRecord
}

export async function resolveTrackPlayback(
  input: TrackResolveRequest | QueueTrack
): Promise<TrackResolveResponse> {
  const track = ensureTrackInput(input)
  const intent =
    "intent" in input && input.intent === "preload"
      ? "preload"
      : "play"
  const record = await getCachedJson<PlaybackRecord>(trackKey(track.trackId))
  if (record?.blobUrl) {
    const touched = intent === "play" ? await touchTrack(record) : record
    return {
      status: "ready",
      playbackUrl: touched.blobUrl,
      mimeType: touched.mimeType,
      cachedAt: touched.createdAt,
    }
  }

  const failed = await getCachedJson<{ message: string }>(trackFailureKey(track.trackId))
  if (failed) {
    return {
      status: "error",
      message: failed.message,
    }
  }

  const locked = await acquireLock(trackLockKey(track.trackId), LOCK_TTL_SECONDS)
  if (!locked) {
    return {
      status: "preparing",
      mode: getPreparationMode(track),
    }
  }

  try {
    const prepared = await prepareTrack(track)
    const readyRecord = intent === "play" ? await touchTrack(prepared) : prepared
    await setCachedJson(trackKey(track.trackId), readyRecord)
    await addToSet(TRACK_INDEX_KEY, track.trackId)
    await deleteCachedKeys(trackFailureKey(track.trackId))

    return {
      status: "ready",
      playbackUrl: readyRecord.blobUrl,
      mimeType: readyRecord.mimeType,
      cachedAt: readyRecord.createdAt,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Track preparation failed"
    await setCachedJson(trackFailureKey(track.trackId), { message }, FAILURE_TTL_SECONDS)
    return {
      status: "error",
      message,
    }
  } finally {
    await releaseLock(trackLockKey(track.trackId))
  }
}

export async function cleanupExpiredTracks() {
  const trackIds = await getSetMembers(TRACK_INDEX_KEY)
  const removed: string[] = []

  for (const trackId of trackIds) {
    const record = await getCachedJson<PlaybackRecord>(trackKey(trackId))
    if (!record) {
      await removeFromSet(TRACK_INDEX_KEY, trackId)
      continue
    }

    const ageSource = record.lastPlayed || record.createdAt
    if (!ageSource) continue

    const ageMs = Date.now() - new Date(ageSource).getTime()
    if (ageMs < STALE_TRACK_MS) continue

    if (record.blobUrl && isBlobConfigured()) {
      try {
        await deleteBlobUrl(record.blobUrl)
      } catch {
        // still drop stale bookkeeping even if blob deletion fails
      }
    }

    await deleteCachedKeys(trackKey(trackId), trackFailureKey(trackId))
    await removeFromSet(TRACK_INDEX_KEY, trackId)
    removed.push(trackId)
  }

  return removed
}
