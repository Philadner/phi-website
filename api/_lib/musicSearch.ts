import YTMusic, {
  type AlbumDetailed,
  type AlbumFull,
  type ArtistDetailed,
  type ArtistFull,
  type SongDetailed,
} from "ytmusic-api"
import { archiveFetch } from "./archiveFetch.js"
import { getCachedJson, setCachedJson } from "./serverCache.js"
import type {
  AlbumSummary,
  MusicAlbumResult,
  MusicArtistPayload,
  MusicArtistResult,
  MusicSearchResponse,
  MusicSearchStreamChunk,
  MusicSongResult,
  QueueTrack,
} from "../../src/lib/musicTypes.js"
import { createTrackId } from "../../src/lib/musicTypes.js"

type ArchiveDoc = {
  identifier: string
  title: string
  creator?: string
  downloads?: number
  publicdate?: string
}

type ArchiveMetadata = {
  metadata?: Record<string, unknown>
  files?: FileEntry[]
}

type FileEntry = {
  name: string
  format?: string
  size?: number
  title?: string
}

type ParsedArchiveItem = {
  album: AlbumSummary
  tracks: QueueTrack[]
  downloads?: number
}

type MatchedArchiveAlbum = ParsedArchiveItem & {
  matchedTrackCount: number
  matchStrength: "strong" | "weak"
}

const SEARCH_PAGE_SIZE = 20
const SEARCH_CACHE_TTL_MS = 60_000
const ARTIST_CACHE_TTL_MS = 5 * 60_000
const ALBUM_CACHE_TTL_MS = 10 * 60_000
const SEARCH_CACHE_TTL_SECONDS = 6 * 60 * 60
const METADATA_CACHE_TTL_SECONDS = 24 * 60 * 60
const MATCH_CACHE_TTL_SECONDS = 24 * 60 * 60
const PAGE_ONE_FALLBACK_METADATA_BUDGET = 6
const PAGE_ONE_FALLBACK_RESULT_LIMIT = 6

const searchCache = new Map<string, { ts: number; value: MusicSearchResponse }>()
const artistCache = new Map<string, { ts: number; value: MusicArtistPayload | null }>()
const archiveMetadataCache = new Map<string, { ts: number; value: ParsedArchiveItem | null }>()
const archiveSearchCache = new Map<
  string,
  { ts: number; value: { response?: { docs?: ArchiveDoc[]; numFound?: number } } }
>()
const ytAlbumCache = new Map<string, { ts: number; value: AlbumFull }>()
const matchedAlbumCache = new Map<string, { ts: number; value: MatchedArchiveAlbum | null }>()
const searchSeedCache = new Map<string, { ts: number; value: SearchSeed }>()
const archiveMetadataInflight = new Map<string, Promise<ParsedArchiveItem | null>>()
const archiveSearchInflight = new Map<
  string,
  Promise<{ response?: { docs?: ArchiveDoc[]; numFound?: number } }>
>()
const ytAlbumInflight = new Map<string, Promise<AlbumFull>>()

type SearchSeed = {
  songs: MusicSongResult[]
  albums: MusicAlbumResult[]
  artists: MusicArtistResult[]
  usedArchiveIds: Set<string>
}

type SearchSeedProgress = {
  songs: MusicSongResult[]
  albums: MusicAlbumResult[]
  artists: MusicArtistResult[]
  usedArchiveIds: Set<string>
}

type SearchSeedOptions = {
  trace?: SearchTrace
  onProgress?: (progress: SearchSeedProgress) => Promise<void> | void
  harder?: boolean
}

type SearchTrace = {
  requestId: string
  query: string
  page: number
  startedAt: number
  counters: Record<string, number>
  log: (event: string, data?: Record<string, unknown>) => void
  count: (name: string, increment?: number) => void
  time: <T>(event: string, fn: () => Promise<T>, data?: Record<string, unknown>) => Promise<T>
  flush: (status: "ok" | "error", data?: Record<string, unknown>) => void
}

let ytmusicPromise: Promise<YTMusic> | null = null

export function createSearchTrace(query: string, page: number): SearchTrace {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = now()
  const counters: Record<string, number> = {}

  const base = {
    requestId,
    query,
    page,
  }

  return {
    requestId,
    query,
    page,
    startedAt,
    counters,
    log(event, data = {}) {
      console.log("[music-search]", JSON.stringify({
        ...base,
        event,
        elapsedMs: now() - startedAt,
        ...data,
      }))
    },
    count(name, increment = 1) {
      counters[name] = (counters[name] || 0) + increment
    },
    async time(event, fn, data = {}) {
      const timerStart = now()
      try {
        const result = await fn()
        this.log(event, {
          ...data,
          durationMs: now() - timerStart,
        })
        return result
      } catch (error: unknown) {
        this.log(`${event}:error`, {
          ...data,
          durationMs: now() - timerStart,
          message: error instanceof Error ? error.message : "Unknown error",
        })
        throw error
      }
    },
    flush(status, data = {}) {
      this.log("summary", {
        status,
        totalMs: now() - startedAt,
        counters,
        ...data,
      })
    },
  }
}

function now() {
  return Date.now()
}

function getCached<T>(store: Map<string, { ts: number; value: T }>, key: string, ttl: number) {
  const cached = store.get(key)
  if (!cached) return null
  if (now() - cached.ts > ttl) {
    store.delete(key)
    return null
  }
  return cached.value
}

function setCached<T>(store: Map<string, { ts: number; value: T }>, key: string, value: T) {
  store.set(key, { ts: now(), value })
  return value
}

async function getYtMusic(trace?: SearchTrace) {
  if (!ytmusicPromise) {
    ytmusicPromise = (async () => {
      const client = new YTMusic()
      const initialised = await client.initialize()
      if (!initialised) {
        throw new Error("Failed to initialise YouTube Music client")
      }
      return client
    })()
  }

  if (!trace) return ytmusicPromise
  return trace.time("ytmusic:init", async () => ytmusicPromise as Promise<YTMusic>)
}

function normaliseText(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\b(feat|ft|featuring|remaster(ed)?|mono|stereo|live|edit|version|explicit|clean)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getTitleMatchScore(query: string, candidate: string) {
  const normalisedQuery = normaliseText(query)
  const normalisedCandidate = normaliseText(candidate)

  if (!normalisedQuery || !normalisedCandidate) return 0
  if (normalisedCandidate === normalisedQuery) return 4
  if (normalisedCandidate.startsWith(normalisedQuery)) return 3
  if (normalisedCandidate.includes(normalisedQuery)) return 2

  const queryWords = normalisedQuery.split(" ")
  const candidateWords = new Set(normalisedCandidate.split(" "))
  return queryWords.every((word) => candidateWords.has(word)) ? 1 : 0
}

function preferAlbumsFirst(
  query: string,
  songs: MusicSongResult[],
  albums: MusicAlbumResult[]
) {
  const bestAlbumScore = albums.reduce(
    (highest, album) => Math.max(highest, getTitleMatchScore(query, album.title)),
    0
  )
  const bestSongScore = songs.reduce(
    (highest, song) => Math.max(highest, getTitleMatchScore(query, song.title)),
    0
  )

  return bestAlbumScore > 0 && bestAlbumScore >= bestSongScore
}

function preferAlbumsFirstFromCandidates(
  query: string,
  songs: Array<{ name: string }>,
  albums: Array<{ name: string }>
) {
  const bestAlbumScore = albums.reduce(
    (highest, album) => Math.max(highest, getTitleMatchScore(query, album.name)),
    0
  )
  const bestSongScore = songs.reduce(
    (highest, song) => Math.max(highest, getTitleMatchScore(query, song.name)),
    0
  )

  return bestAlbumScore > 0 && bestAlbumScore >= bestSongScore
}

function chooseThumbnail(
  thumbnails: Array<{ url: string; width: number; height: number }> | undefined,
  fallback: string
) {
  if (!thumbnails?.length) return fallback
  const sorted = [...thumbnails].sort((a, b) => b.width * b.height - a.width * a.height)
  return sorted[0]?.url || fallback
}

function getArchiveFallbackScore(query: string, doc: ArchiveDoc) {
  const titleScore = getTitleMatchScore(query, doc.title || "")
  const creatorScore = getTitleMatchScore(query, doc.creator || "")
  return titleScore * 3 + creatorScore
}

function serviceThumb(id: string) {
  return `https://archive.org/services/img/${id}`
}

function searchResponseCacheKey(query: string, page: number, harder = false) {
  return `music:search:${encodeURIComponent(query)}:${page}:${harder ? "harder" : "normal"}`
}

function artistPayloadCacheKey(artistId: string) {
  return `music:artist:${artistId}`
}

function archiveMetadataCacheKey(id: string) {
  return `music:archive:meta:${id}`
}

function matchedAlbumCacheKey(key: string) {
  return `music:match:album:${key}`
}

function matchedSongCacheKey(key: string) {
  return `music:match:song:${key}`
}

function createQueueTrack(input: {
  archiveItemId: string
  albumTitle: string
  artist: string
  title: string
  archiveFileName: string
  coverUrl: string
  sourceSizeBytes?: number
}) {
  return {
    trackId: createTrackId(input.archiveItemId, input.archiveFileName),
    archiveItemId: input.archiveItemId,
    archiveFileName: input.archiveFileName,
    albumTitle: input.albumTitle,
    artist: input.artist,
    title: input.title,
    coverUrl: input.coverUrl,
    sourceSizeBytes: input.sourceSizeBytes,
  } satisfies QueueTrack
}

function isAudioFile(file: FileEntry) {
  const format = (file.format || "").toLowerCase()
  if (format.includes("audio")) return true
  const name = file.name.toLowerCase()
  return [".mp3", ".ogg", ".oga", ".flac", ".wav", ".aif", ".aiff", ".m4a"].some((ext) =>
    name.endsWith(ext)
  )
}

function getTrackTitle(file: FileEntry) {
  if (file.title?.trim()) return file.title.trim()
  return file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim()
}

function yearFromMetadata(metadata: Record<string, unknown>) {
  if (typeof metadata.year === "string" && metadata.year.trim()) return metadata.year.trim()
  if (typeof metadata.date === "string" && metadata.date.trim()) return metadata.date.trim()
  return undefined
}

function parseArchiveMetadata(id: string, data: ArchiveMetadata): ParsedArchiveItem {
  const metadata = data.metadata || {}
  const title = typeof metadata.title === "string" ? metadata.title : id
  const creator = typeof metadata.creator === "string" ? metadata.creator : undefined
  const description =
    typeof metadata.description === "string" ? metadata.description : undefined

  const album: AlbumSummary = {
    id,
    title,
    creator,
    description,
    year: yearFromMetadata(metadata),
    coverUrl: serviceThumb(id),
  }

  const tracks = (data.files || [])
    .filter(isAudioFile)
    .map((file) =>
      createQueueTrack({
        archiveItemId: id,
        albumTitle: album.title,
        artist: album.creator || "Unknown Artist",
        title: getTrackTitle(file),
        archiveFileName: file.name,
        coverUrl: album.coverUrl,
        sourceSizeBytes: typeof file.size === "number" ? file.size : Number(file.size) || undefined,
      })
    )

  return { album, tracks }
}

async function fetchJson<T>(url: string) {
  const response = await archiveFetch(url)

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

async function searchArchiveExpression(
  expression: string,
  cacheNamespace: string,
  page: number,
  rows = SEARCH_PAGE_SIZE,
  trace?: SearchTrace
) {
  const cacheKey = `${cacheNamespace}|${page}|${rows}`
  const cached = getCached(archiveSearchCache, cacheKey, SEARCH_CACHE_TTL_MS)
  if (cached) {
    trace?.count("archiveSearch.memoryHit")
    trace?.log("archive-search:cache-hit", { query: cacheNamespace, page, rows, layer: "memory" })
    return cached
  }

  const inflight = archiveSearchInflight.get(cacheKey)
  if (inflight) {
    trace?.count("archiveSearch.inflightHit")
    trace?.log("archive-search:inflight-hit", { query: cacheNamespace, page, rows })
    return inflight
  }

  const url = new URL("https://archive.org/advancedsearch.php")
  url.searchParams.set("q", expression)
  url.searchParams.set("fl[]", "identifier")
  url.searchParams.append("fl[]", "title")
  url.searchParams.append("fl[]", "creator")
  url.searchParams.append("fl[]", "downloads")
  url.searchParams.append("fl[]", "publicdate")
  url.searchParams.append("sort[]", "downloads desc")
  url.searchParams.set("rows", String(rows))
  url.searchParams.set("page", String(page))
  url.searchParams.set("output", "json")

  trace?.count("archiveSearch.network")
  const request = (trace
    ? trace.time(
        "archive-search:network",
        async () =>
          fetchJson<{ response?: { docs?: ArchiveDoc[]; numFound?: number } }>(url.toString()),
        { query: cacheNamespace, page, rows }
      )
    : fetchJson<{ response?: { docs?: ArchiveDoc[]; numFound?: number } }>(url.toString()))
    .then((value) => {
      setCached(archiveSearchCache, cacheKey, value)
      return value
    })
    .finally(() => {
      archiveSearchInflight.delete(cacheKey)
    })

  archiveSearchInflight.set(cacheKey, request)
  return request
}

async function searchArchive(query: string, page: number, rows = SEARCH_PAGE_SIZE, trace?: SearchTrace) {
  return searchArchiveExpression(
    `(title:("${query}") OR creator:("${query}")) AND mediatype:(audio)`,
    query,
    page,
    rows,
    trace
  )
}

async function searchArchiveAlbumCandidates(
  albumTitle: string,
  artistName: string,
  page: number,
  rows: number,
  trace?: SearchTrace
) {
  const strictExpression = `(title:("${albumTitle}") AND creator:("${artistName}")) AND mediatype:(audio)`
  const strictNamespace = `album:${artistName}:${albumTitle}:strict`
  const strictResults = await searchArchiveExpression(
    strictExpression,
    strictNamespace,
    page,
    rows,
    trace
  )

  if ((strictResults.response?.docs || []).length) {
    return strictResults
  }

  const looseExpression = `(title:("${albumTitle}") OR (title:("${albumTitle}") AND creator:("${artistName}"))) AND mediatype:(audio)`
  const looseNamespace = `album:${artistName}:${albumTitle}:loose`
  return searchArchiveExpression(looseExpression, looseNamespace, page, rows, trace)
}

async function getArchiveMetadata(id: string, trace?: SearchTrace) {
  const redisCached = await getCachedJson<ParsedArchiveItem>(archiveMetadataCacheKey(id))
  if (redisCached) {
    trace?.count("archiveMetadata.redisHit")
    trace?.log("archive-metadata:cache-hit", { id, layer: "redis" })
    setCached(archiveMetadataCache, id, redisCached)
    return redisCached
  }

  const cached = getCached(archiveMetadataCache, id, ALBUM_CACHE_TTL_MS)
  if (cached !== null) {
    trace?.count("archiveMetadata.memoryHit")
    trace?.log("archive-metadata:cache-hit", { id, layer: "memory" })
    return cached
  }

  const inflight = archiveMetadataInflight.get(id)
  if (inflight) {
    trace?.count("archiveMetadata.inflightHit")
    trace?.log("archive-metadata:inflight-hit", { id })
    return inflight
  }

  const request = (async () => {
    try {
      trace?.count("archiveMetadata.network")
      const data = trace
        ? await trace.time(
            "archive-metadata:network",
            async () =>
              fetchJson<ArchiveMetadata>(
                `https://archive.org/metadata/${encodeURIComponent(id)}`
              ),
            { id }
          )
        : await fetchJson<ArchiveMetadata>(
            `https://archive.org/metadata/${encodeURIComponent(id)}`
          )
      const parsed = parseArchiveMetadata(id, data)
      setCached(archiveMetadataCache, id, parsed)
      await setCachedJson(archiveMetadataCacheKey(id), parsed, METADATA_CACHE_TTL_SECONDS)
      return parsed
    } catch {
      return setCached(archiveMetadataCache, id, null)
    } finally {
      archiveMetadataInflight.delete(id)
    }
  })()

  archiveMetadataInflight.set(id, request)
  return request
}

function createSongResult(track: QueueTrack, overrides?: {
  coverUrl?: string
  duration?: number | null
  title?: string
  artist?: string
  albumTitle?: string
}) {
  return {
    type: "song",
    id: `song:${track.trackId}`,
    title: overrides?.title || track.title,
    artist: overrides?.artist || track.artist,
    coverUrl: overrides?.coverUrl || track.coverUrl,
    albumTitle: overrides?.albumTitle || track.albumTitle,
    duration: overrides?.duration ?? null,
    track: {
      ...track,
      coverUrl: overrides?.coverUrl || track.coverUrl,
      title: overrides?.title || track.title,
      artist: overrides?.artist || track.artist,
      albumTitle: overrides?.albumTitle || track.albumTitle,
    },
  } satisfies MusicSongResult
}

function createAlbumResult(item: ParsedArchiveItem, downloads?: number, overrides?: {
  coverUrl?: string
  title?: string
  artist?: string
  matchedTrackCount?: number
}) {
  return {
    type: "album",
    id: `album:${item.album.id}`,
    archiveId: item.album.id,
    title: overrides?.title || item.album.title,
    artist: overrides?.artist || item.album.creator || "Unknown Artist",
    coverUrl: overrides?.coverUrl || item.album.coverUrl,
    year: item.album.year,
    description: item.album.description,
    downloads,
    trackCount: item.tracks.length,
    matchedTrackCount: overrides?.matchedTrackCount,
  } satisfies MusicAlbumResult
}

function trackMatches(songName: string, trackTitle: string) {
  const left = normaliseText(songName)
  const right = normaliseText(trackTitle)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

function countTrackOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right.map(normaliseText).filter(Boolean))
  let count = 0
  for (const name of left) {
    const key = normaliseText(name)
    if (key && rightSet.has(key)) count += 1
  }
  return count
}

function getArtistMatchScore(left?: string, right?: string) {
  if (!left || !right) return 0
  const normalisedLeft = normaliseText(left)
  const normalisedRight = normaliseText(right)
  if (!normalisedLeft || !normalisedRight) return 0
  if (normalisedLeft === normalisedRight) return 3
  if (normalisedLeft.includes(normalisedRight) || normalisedRight.includes(normalisedLeft)) {
    return 2
  }
  const leftWords = new Set(normalisedLeft.split(" "))
  const rightWords = normalisedRight.split(" ")
  return rightWords.some((word) => leftWords.has(word)) ? 1 : 0
}

function getArchiveAlbumCandidateScore(ytAlbum: AlbumDetailed | AlbumFull, parsed: ParsedArchiveItem) {
  const ytTrackNames =
    "songs" in ytAlbum && Array.isArray(ytAlbum.songs) ? ytAlbum.songs.map((song) => song.name) : []
  const overlap = countTrackOverlap(
    ytTrackNames,
    parsed.tracks.map((track) => track.title)
  )
  const titleScore = getTitleMatchScore(ytAlbum.name, parsed.album.title)
  const artistScore = getArtistMatchScore(ytAlbum.artist.name, parsed.album.creator)

  return {
    overlap,
    titleScore,
    artistScore,
    totalScore: overlap * 8 + titleScore * 5 + artistScore * 4,
  }
}

async function getYtAlbum(albumId: string, trace?: SearchTrace) {
  const cached = getCached(ytAlbumCache, albumId, ALBUM_CACHE_TTL_MS)
  if (cached) {
    trace?.count("ytAlbum.memoryHit")
    trace?.log("yt-album:cache-hit", { albumId, layer: "memory" })
    return cached
  }
  const inflight = ytAlbumInflight.get(albumId)
  if (inflight) {
    trace?.count("ytAlbum.inflightHit")
    trace?.log("yt-album:inflight-hit", { albumId })
    return inflight
  }
  const client = await getYtMusic(trace)
  trace?.count("ytAlbum.network")
  const request = (trace
    ? trace.time("yt-album:network", async () => client.getAlbum(albumId), { albumId })
    : client.getAlbum(albumId))
    .then((album) => {
      setCached(ytAlbumCache, albumId, album)
      return album
    })
    .finally(() => {
      ytAlbumInflight.delete(albumId)
    })

  ytAlbumInflight.set(albumId, request)
  return request
}

async function matchArchiveAlbum(
  ytAlbum: AlbumDetailed | AlbumFull,
  trace?: SearchTrace,
  harder = false
) {
  const cacheKey = `${ytAlbum.albumId}:${normaliseText(ytAlbum.name)}`
  const redisCached = await getCachedJson<MatchedArchiveAlbum>(matchedAlbumCacheKey(cacheKey))
  if (redisCached) {
    trace?.count("matchAlbum.redisHit")
    trace?.log("match-album:cache-hit", { albumId: ytAlbum.albumId, layer: "redis" })
    setCached(matchedAlbumCache, cacheKey, redisCached)
    return redisCached
  }

  const cached = getCached(matchedAlbumCache, cacheKey, ALBUM_CACHE_TTL_MS)
  if (cached !== null) {
    trace?.count("matchAlbum.memoryHit")
    trace?.log("match-album:cache-hit", { albumId: ytAlbum.albumId, layer: "memory" })
    return cached
  }

  const searchPages = harder ? [1, 2, 3, 4, 5] : [1, 2, 3]
  const docs: ArchiveDoc[] = []
  const seenDocIds = new Set<string>()

  for (const page of searchPages) {
    const archiveSearch = await searchArchiveAlbumCandidates(
      ytAlbum.name,
      ytAlbum.artist.name,
      page,
      harder ? 6 : 4,
      trace
    )
    for (const doc of archiveSearch.response?.docs || []) {
      if (seenDocIds.has(doc.identifier)) continue
      seenDocIds.add(doc.identifier)
      docs.push(doc)
    }
  }

  let bestStrongMatch: MatchedArchiveAlbum | null = null
  let bestWeakMatch: MatchedArchiveAlbum | null = null
  let bestStrongScore = -1
  let bestWeakScore = -1

  for (const doc of docs) {
    const parsed = await getArchiveMetadata(doc.identifier, trace)
    if (!parsed || parsed.tracks.length < 2) continue

    const score = getArchiveAlbumCandidateScore(ytAlbum, parsed)
    const downloads = doc.downloads || 0
    const isStrongMatch =
      score.overlap >= 2 ||
      (score.overlap >= 1 && score.titleScore >= 3 && score.artistScore >= 2)
    const isWeakMatch =
      !isStrongMatch &&
      score.titleScore >= 3 &&
      score.artistScore >= 1 &&
      (score.overlap >= 1 || parsed.tracks.length >= 6)

    if (isStrongMatch) {
      const candidate = {
        ...parsed,
        downloads: doc.downloads,
        matchedTrackCount: score.overlap,
        matchStrength: "strong" as const,
      }
      if (
        !bestStrongMatch ||
        score.totalScore > bestStrongScore ||
        (score.totalScore === bestStrongScore && downloads > (bestStrongMatch.downloads || 0))
      ) {
        bestStrongScore = score.totalScore
        bestStrongMatch = candidate
      }
      continue
    }

    if (isWeakMatch) {
      const candidate = {
        ...parsed,
        downloads: doc.downloads,
        matchedTrackCount: score.overlap,
        matchStrength: "weak" as const,
      }
      if (
        !bestWeakMatch ||
        score.totalScore > bestWeakScore ||
        (score.totalScore === bestWeakScore && downloads > (bestWeakMatch.downloads || 0))
      ) {
        bestWeakScore = score.totalScore
        bestWeakMatch = candidate
      }
    }
  }

  const bestMatch = bestStrongMatch || bestWeakMatch
  setCached(matchedAlbumCache, cacheKey, bestMatch)
  if (bestMatch) {
    await setCachedJson(matchedAlbumCacheKey(cacheKey), bestMatch, MATCH_CACHE_TTL_SECONDS)
  }
  trace?.log("match-album:result", {
    albumId: ytAlbum.albumId,
    matched: Boolean(bestMatch),
    matchedTrackCount: bestMatch?.matchedTrackCount || 0,
    matchStrength: bestMatch?.matchStrength || "none",
    docsChecked: docs.length,
  })
  return bestMatch
}

async function matchSongFromArchive(song: SongDetailed, trace?: SearchTrace): Promise<MusicSongResult | null> {
  const songCacheKey = `${normaliseText(song.name)}:${normaliseText(song.artist.name)}`
  const redisCached = await getCachedJson<MusicSongResult>(matchedSongCacheKey(songCacheKey))
  if (redisCached) {
    trace?.count("matchSong.redisHit")
    trace?.log("match-song:cache-hit", { song: song.name, artist: song.artist.name })
    return redisCached
  }

  if (song.album?.albumId) {
    try {
      const ytAlbum = await getYtAlbum(song.album.albumId, trace)
      const matchedAlbum = await matchArchiveAlbum(ytAlbum, trace)
      const matchedTrack = matchedAlbum?.tracks.find((track) => trackMatches(song.name, track.title))
      if (matchedAlbum && matchedTrack) {
        const result = createSongResult(matchedTrack, {
          coverUrl: chooseThumbnail(song.thumbnails, matchedAlbum.album.coverUrl),
          duration: song.duration,
          title: song.name,
          artist: song.artist.name,
          albumTitle: ytAlbum.name,
        })
        await setCachedJson(matchedSongCacheKey(songCacheKey), result, MATCH_CACHE_TTL_SECONDS)
        return result
      }
    } catch {
      // ignore and return null below
    }
  }

  trace?.log("match-song:miss", { song: song.name, artist: song.artist.name })
  return null
}

async function buildArtistPayloadInternal(artist: ArtistFull | ArtistDetailed) {
  const artistId = artist.artistId
  const client = await getYtMusic()
  const fullArtist =
    "topSongs" in artist ? artist : await client.getArtist(artistId)

  const albums: MusicAlbumResult[] = []
  const songs: MusicSongResult[] = []
  const seenAlbumIds = new Set<string>()
  const seenSongIds = new Set<string>()

  const ytAlbums = [...fullArtist.topAlbums, ...fullArtist.topSingles].slice(0, 8)
  for (const ytAlbum of ytAlbums) {
    const matchedAlbum = await matchArchiveAlbum(ytAlbum)
    if (!matchedAlbum || seenAlbumIds.has(matchedAlbum.album.id)) continue
    seenAlbumIds.add(matchedAlbum.album.id)
    albums.push(
      createAlbumResult(matchedAlbum, matchedAlbum.downloads, {
        coverUrl: chooseThumbnail(ytAlbum.thumbnails, matchedAlbum.album.coverUrl),
        title: ytAlbum.name,
        artist: ytAlbum.artist.name,
        matchedTrackCount: matchedAlbum.matchedTrackCount,
      })
    )
  }

  for (const ytSong of fullArtist.topSongs.slice(0, 8)) {
    const matchedSong = await matchSongFromArchive(ytSong)
    if (!matchedSong || seenSongIds.has(matchedSong.id)) continue
    seenSongIds.add(matchedSong.id)
    songs.push(matchedSong)
  }

  if (!albums.length && !songs.length) {
    return null
  }

  return {
    artistId,
    name: fullArtist.name,
    imageUrl: chooseThumbnail(fullArtist.thumbnails, ""),
    albums,
    songs,
  } satisfies MusicArtistPayload
}

export async function getMusicArtistPayload(artistId: string) {
  const trimmed = artistId.trim()
  if (!trimmed) {
    throw new Error("Artist id required")
  }

  const redisCached = await getCachedJson<MusicArtistPayload>(artistPayloadCacheKey(trimmed))
  if (redisCached) {
    setCached(artistCache, trimmed, redisCached)
    return redisCached
  }

  const cached = getCached(artistCache, trimmed, ARTIST_CACHE_TTL_MS)
  if (cached !== null) return cached

  const client = await getYtMusic()
  try {
    const artist = await client.getArtist(trimmed)
    const payload = await buildArtistPayloadInternal(artist)
    setCached(artistCache, trimmed, payload)
    if (payload) {
      await setCachedJson(artistPayloadCacheKey(trimmed), payload, METADATA_CACHE_TTL_SECONDS)
    }
    return payload
  } catch {
    return setCached(artistCache, trimmed, null)
  }
}

async function getSearchSeed(query: string, options: SearchSeedOptions = {}) {
  const { trace, onProgress, harder = false } = options
  const cached = getCached(searchSeedCache, query, SEARCH_CACHE_TTL_MS)
  if (cached) {
    trace?.count("searchSeed.memoryHit")
    trace?.log("search-seed:cache-hit", { layer: "memory" })
    return cached
  }

  const client = await getYtMusic(trace)
  const [ytSongs, ytAlbums, ytArtists] = await Promise.all([
    trace
      ? trace.time("yt-search:songs", async () => client.searchSongs(query), { query })
      : client.searchSongs(query),
    trace
      ? trace.time("yt-search:albums", async () => client.searchAlbums(query), { query })
      : client.searchAlbums(query),
    trace
      ? trace.time("yt-search:artists", async () => client.searchArtists(query), { query })
      : client.searchArtists(query),
  ])

  const songs: MusicSongResult[] = []
  const albums: MusicAlbumResult[] = []
  const usedArchiveIds = new Set<string>()
  const seenSongIds = new Set<string>()
  const seenAlbumIds = new Set<string>()

  const artists = ytArtists
    .slice(0, 4)
    .filter((artist, index, array) => array.findIndex((entry) => entry.artistId === artist.artistId) === index)
    .map((artist) => ({
      type: "artist",
      id: `artist:${artist.artistId}`,
      artistId: artist.artistId,
      name: artist.name,
      imageUrl: chooseThumbnail(artist.thumbnails, ""),
    }) satisfies MusicArtistResult)

  const emitProgress = async () => {
    if (!onProgress) return
    await onProgress({
      songs: [...songs],
      albums: [...albums],
      artists: [...artists],
      usedArchiveIds: new Set(usedArchiveIds),
    })
  }

  await emitProgress()

  const albumFirst = preferAlbumsFirstFromCandidates(trimmedQuery(query), ytSongs, ytAlbums)
  trace?.log("search-seed:intent", {
    albumFirst,
    ytSongs: ytSongs.length,
    ytAlbums: ytAlbums.length,
  })

  const albumCandidates = ytAlbums.slice(0, albumFirst ? (harder ? 6 : 4) : harder ? 5 : 3)
  for (const album of albumCandidates) {
    try {
      const fullAlbum = await getYtAlbum(album.albumId, trace)
      const matchedAlbum = await matchArchiveAlbum(fullAlbum, trace, harder)
      if (!matchedAlbum) continue

      const result = createAlbumResult(matchedAlbum, matchedAlbum.downloads, {
        coverUrl: chooseThumbnail(album.thumbnails, matchedAlbum.album.coverUrl),
        title: album.name,
        artist: album.artist.name,
        matchedTrackCount: matchedAlbum.matchedTrackCount,
      })

      if (seenAlbumIds.has(result.archiveId)) continue
      seenAlbumIds.add(result.archiveId)
      usedArchiveIds.add(result.archiveId)
      albums.push(result)
      await emitProgress()
    } catch {
      continue
    }
  }

  if (!albumFirst) {
    for (const song of ytSongs.slice(0, harder ? 8 : 6)) {
      try {
        const matchedSong = await matchSongFromArchive(song, trace)
        if (!matchedSong || seenSongIds.has(matchedSong.id)) continue
        seenSongIds.add(matchedSong.id)
        usedArchiveIds.add(matchedSong.track.archiveItemId)
        songs.push(matchedSong)
        await emitProgress()
      } catch {
        continue
      }
    }
  }

  trace?.log("search-seed:result", {
    ytSongs: ytSongs.length,
    ytAlbums: ytAlbums.length,
    ytArtists: ytArtists.length,
    matchedSongs: songs.length,
    matchedAlbums: albums.length,
    artists: artists.length,
  })
  return setCached(searchSeedCache, query, { songs, albums, artists, usedArchiveIds })
}

function trimmedQuery(query: string) {
  return query.trim()
}

async function buildArchiveFallbackResults(
  docs: ArchiveDoc[],
  usedArchiveIds: Set<string>,
  trace?: SearchTrace,
  options?: {
    metadataBudget?: number
    resultLimit?: number
    query?: string
  }
) {
  const results: Array<MusicSongResult | MusicAlbumResult> = []
  const metadataBudget = options?.metadataBudget ?? docs.length
  const resultLimit = options?.resultLimit ?? docs.length
  const rankedDocs = options?.query
    ? [...docs]
        .map((doc) => ({
          doc,
          score: getArchiveFallbackScore(options.query as string, doc),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score
          return (right.doc.downloads || 0) - (left.doc.downloads || 0)
        })
        .map((entry) => entry.doc)
    : docs
  let inspected = 0

  for (const doc of rankedDocs) {
    if (usedArchiveIds.has(doc.identifier)) continue
    if (inspected >= metadataBudget || results.length >= resultLimit) break

    inspected += 1
    const parsed = await getArchiveMetadata(doc.identifier, trace)
    if (!parsed?.tracks.length) continue

    if (parsed.tracks.length === 1) {
      results.push(createSongResult(parsed.tracks[0]))
      usedArchiveIds.add(doc.identifier)
      continue
    }

    results.push(createAlbumResult(parsed, doc.downloads))
    usedArchiveIds.add(doc.identifier)
  }

  trace?.log("archive-fallback:result", {
    docs: docs.length,
    inspected,
    results: results.length,
  })
  return results
}

async function buildArchiveOnlySearch(query: string, page: number): Promise<MusicSearchResponse> {
  const archiveData = await searchArchive(query, page)
  const docs = archiveData.response?.docs || []
  const numFound = Number(archiveData.response?.numFound || 0)
  const usedArchiveIds = new Set<string>()
  const results = await buildArchiveFallbackResults(docs, usedArchiveIds, undefined, {
    query,
  })

  return {
    query,
    page,
    totalResults: numFound,
    hasMore: page * SEARCH_PAGE_SIZE < numFound,
    results,
  }
}

export async function getMusicSearchResponse(query: string, page = 1, trace?: SearchTrace): Promise<MusicSearchResponse> {
  const trimmed = query.trim()
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1
  if (!trimmed) {
    throw new Error("Query required")
  }

  const redisCached = await getCachedJson<MusicSearchResponse>(
    searchResponseCacheKey(trimmed, currentPage)
  )
  if (redisCached) {
    trace?.count("search.redisHit")
    trace?.flush("ok", { cacheLayer: "redis", resultCount: redisCached.results.length })
    setCached(searchCache, `${trimmed}|${currentPage}`, redisCached)
    return redisCached
  }

  const cacheKey = `${trimmed}|${currentPage}`
  const cached = getCached(searchCache, cacheKey, SEARCH_CACHE_TTL_MS)
  if (cached) {
    trace?.count("search.memoryHit")
    trace?.flush("ok", { cacheLayer: "memory", resultCount: cached.results.length })
    return cached
  }

  try {
    const archiveData = await searchArchive(trimmed, currentPage, SEARCH_PAGE_SIZE, trace)
    const docs = archiveData.response?.docs || []
    const numFound = Number(archiveData.response?.numFound || 0)

    if (currentPage > 1) {
      const payload = {
        query: trimmed,
        page: currentPage,
        totalResults: numFound,
        hasMore: currentPage * SEARCH_PAGE_SIZE < numFound,
        results: await buildArchiveFallbackResults(docs, new Set<string>(), trace, {
          query: trimmed,
        }),
      } satisfies MusicSearchResponse
      setCached(searchCache, cacheKey, payload)
      await setCachedJson(searchResponseCacheKey(trimmed, currentPage), payload, SEARCH_CACHE_TTL_SECONDS)
      trace?.flush("ok", { mode: "page>1", resultCount: payload.results.length, numFound })
      return payload
    }

    const seed = await getSearchSeed(trimmed, { trace })
    const archiveFallback = await buildArchiveFallbackResults(
      docs,
      new Set(seed.usedArchiveIds),
      trace,
      {
        query: trimmed,
        metadataBudget: PAGE_ONE_FALLBACK_METADATA_BUDGET,
        resultLimit: PAGE_ONE_FALLBACK_RESULT_LIMIT,
      }
    )
    const primaryResults = preferAlbumsFirst(trimmed, seed.songs, seed.albums)
      ? [...seed.albums, ...seed.songs]
      : [...seed.songs, ...seed.albums]
    const results = [...primaryResults, ...seed.artists, ...archiveFallback]

    const payload = {
      query: trimmed,
      page: currentPage,
      totalResults: seed.songs.length + seed.albums.length + seed.artists.length + numFound,
      hasMore: currentPage * SEARCH_PAGE_SIZE < numFound,
      results,
    } satisfies MusicSearchResponse
    setCached(searchCache, cacheKey, payload)
    await setCachedJson(searchResponseCacheKey(trimmed, currentPage), payload, SEARCH_CACHE_TTL_SECONDS)
    trace?.flush("ok", {
      mode: "page1",
      resultCount: payload.results.length,
      matchedSongs: seed.songs.length,
      matchedAlbums: seed.albums.length,
      artists: seed.artists.length,
      archiveFallback: archiveFallback.length,
      numFound,
    })
    return payload
  } catch (error: unknown) {
    trace?.log("search:fallback", {
      message: error instanceof Error ? error.message : "Unknown error",
    })
    const fallback = await buildArchiveOnlySearch(trimmed, currentPage)
    setCached(searchCache, cacheKey, fallback)
    await setCachedJson(searchResponseCacheKey(trimmed, currentPage), fallback, SEARCH_CACHE_TTL_SECONDS)
    trace?.flush("ok", {
      mode: "archive-only-fallback",
      resultCount: fallback.results.length,
    })
    return fallback
  }
}

function buildSeedResults(query: string, seed: SearchSeed) {
  const primaryResults = preferAlbumsFirst(query, seed.songs, seed.albums)
    ? [...seed.albums, ...seed.songs]
    : [...seed.songs, ...seed.albums]

  return [...primaryResults, ...seed.artists]
}

export async function streamMusicSearchResponse(
  query: string,
  page = 1,
  writeChunk: (chunk: MusicSearchStreamChunk) => Promise<void> | void,
  trace?: SearchTrace,
  harder = false
) {
  const trimmed = query.trim()
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1
  if (!trimmed) {
    throw new Error("Query required")
  }

  const redisCached = await getCachedJson<MusicSearchResponse>(
    searchResponseCacheKey(trimmed, currentPage, harder)
  )
  if (redisCached) {
    trace?.count("search.redisHit")
    await writeChunk({ type: "final", response: redisCached })
    trace?.flush("ok", { cacheLayer: "redis", resultCount: redisCached.results.length })
    setCached(searchCache, `${trimmed}|${currentPage}`, redisCached)
    return
  }

  const cacheKey = `${trimmed}|${currentPage}`
  const cached = getCached(searchCache, cacheKey, SEARCH_CACHE_TTL_MS)
  if (cached) {
    trace?.count("search.memoryHit")
    await writeChunk({ type: "final", response: cached })
    trace?.flush("ok", { cacheLayer: "memory", resultCount: cached.results.length })
    return
  }

  try {
    const archiveData = await searchArchive(trimmed, currentPage, SEARCH_PAGE_SIZE, trace)
    const docs = archiveData.response?.docs || []
    const numFound = Number(archiveData.response?.numFound || 0)

    if (currentPage > 1) {
      const payload = {
        query: trimmed,
        page: currentPage,
        totalResults: numFound,
        hasMore: currentPage * SEARCH_PAGE_SIZE < numFound,
        results: await buildArchiveFallbackResults(docs, new Set<string>(), trace),
      } satisfies MusicSearchResponse
      setCached(searchCache, cacheKey, payload)
      await setCachedJson(searchResponseCacheKey(trimmed, currentPage, harder), payload, SEARCH_CACHE_TTL_SECONDS)
      await writeChunk({ type: "final", response: payload })
      trace?.flush("ok", { mode: "page>1", resultCount: payload.results.length, numFound })
      return
    }

    let latestSeed: SearchSeed = {
      songs: [],
      albums: [],
      artists: [],
      usedArchiveIds: new Set<string>(),
    }

    const seed = await getSearchSeed(trimmed, {
      trace,
      harder,
      onProgress: async (progress) => {
        latestSeed = {
          songs: progress.songs,
          albums: progress.albums,
          artists: progress.artists,
          usedArchiveIds: progress.usedArchiveIds,
        }

        const partialPayload = {
          query: trimmed,
          page: currentPage,
          totalResults: progress.songs.length + progress.albums.length + progress.artists.length,
          hasMore: false,
          results: buildSeedResults(trimmed, latestSeed),
        } satisfies MusicSearchResponse

        await writeChunk({ type: "partial", response: partialPayload })
      },
    })

    latestSeed = seed
    const archiveFallback = await buildArchiveFallbackResults(
      docs,
      new Set(seed.usedArchiveIds),
      trace,
      {
        query: trimmed,
        metadataBudget: harder ? PAGE_ONE_FALLBACK_METADATA_BUDGET * 2 : PAGE_ONE_FALLBACK_METADATA_BUDGET,
        resultLimit: harder ? PAGE_ONE_FALLBACK_RESULT_LIMIT * 2 : PAGE_ONE_FALLBACK_RESULT_LIMIT,
      }
    )
    const results = [...buildSeedResults(trimmed, seed), ...archiveFallback]

    const payload = {
      query: trimmed,
      page: currentPage,
      totalResults: seed.songs.length + seed.albums.length + seed.artists.length + numFound,
      hasMore: currentPage * SEARCH_PAGE_SIZE < numFound,
      results,
    } satisfies MusicSearchResponse
    setCached(searchCache, cacheKey, payload)
    await setCachedJson(searchResponseCacheKey(trimmed, currentPage, harder), payload, SEARCH_CACHE_TTL_SECONDS)
    await writeChunk({ type: "final", response: payload })
    trace?.flush("ok", {
      mode: "page1",
      resultCount: payload.results.length,
      matchedSongs: seed.songs.length,
      matchedAlbums: seed.albums.length,
      artists: seed.artists.length,
      archiveFallback: archiveFallback.length,
      numFound,
    })
  } catch (error: unknown) {
    trace?.log("search:fallback", {
      message: error instanceof Error ? error.message : "Unknown error",
    })
    const fallback = await buildArchiveOnlySearch(trimmed, currentPage)
    setCached(searchCache, cacheKey, fallback)
    await setCachedJson(searchResponseCacheKey(trimmed, currentPage, harder), fallback, SEARCH_CACHE_TTL_SECONDS)
    await writeChunk({ type: "final", response: fallback })
    trace?.flush("ok", {
      mode: "archive-only-fallback",
      resultCount: fallback.results.length,
    })
  }
}
