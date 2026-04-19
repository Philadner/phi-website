import YTMusic, {
  type AlbumDetailed,
  type AlbumFull,
  type ArtistDetailed,
  type ArtistFull,
  type SongDetailed,
} from "ytmusic-api"
import { getCachedJson, setCachedJson } from "./serverCache.js"
import type {
  AlbumSummary,
  MusicAlbumPayload,
  MusicAlbumResult,
  MusicArtistPayload,
  MusicArtistResult,
  MusicSearchResponse,
  MusicSearchResult,
  MusicSearchStreamChunk,
  MusicSongResult,
  QueueTrack,
} from "../../src/lib/musicTypes.js"
import { createTrackId } from "../../src/lib/musicTypes.js"

const SEARCH_PAGE_SIZE = 20
const SEARCH_CACHE_TTL_MS = 60_000
const ARTIST_CACHE_TTL_MS = 5 * 60_000
const ALBUM_CACHE_TTL_MS = 5 * 60_000
const SEARCH_CACHE_TTL_SECONDS = 30 * 60
const METADATA_CACHE_TTL_SECONDS = 6 * 60 * 60

const searchCache = new Map<string, { ts: number; value: MusicSearchResponse }>()
const artistCache = new Map<string, { ts: number; value: MusicArtistPayload | null }>()
const albumCache = new Map<string, { ts: number; value: MusicAlbumPayload | null }>()

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

function searchResponseCacheKey(query: string, page: number, harder = false) {
  return `music:search:v2:${encodeURIComponent(query)}:${page}:${harder ? "harder" : "normal"}`
}

function artistPayloadCacheKey(artistId: string) {
  return `music:artist:v2:${artistId}`
}

function albumPayloadCacheKey(albumId: string) {
  return `music:album:v2:${albumId}`
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

function chooseThumbnail(
  thumbnails: Array<{ url: string; width: number; height: number }> | undefined,
  fallback: string
) {
  if (!thumbnails?.length) return fallback
  const sorted = [...thumbnails].sort((a, b) => b.width * b.height - a.width * a.height)
  return sorted[0]?.url || fallback
}

function buildQueueTrack(song: SongDetailed, fallback?: { albumId?: string; albumTitle?: string }): QueueTrack {
  return {
    trackId: createTrackId(song.videoId),
    videoId: song.videoId,
    albumId: song.album?.albumId || fallback?.albumId,
    albumTitle: song.album?.name || fallback?.albumTitle || "Single",
    artist: song.artist.name,
    title: song.name,
    coverUrl: chooseThumbnail(song.thumbnails, ""),
    duration: song.duration,
  }
}

function createSongResult(song: SongDetailed): MusicSongResult {
  return {
    type: "song",
    id: `song:${song.videoId}`,
    title: song.name,
    artist: song.artist.name,
    coverUrl: chooseThumbnail(song.thumbnails, ""),
    albumTitle: song.album?.name || undefined,
    duration: song.duration,
    track: buildQueueTrack(song),
  }
}

function createAlbumResult(album: AlbumDetailed | AlbumFull): MusicAlbumResult {
  const trackCount = "songs" in album ? album.songs.length : 0
  return {
    type: "album",
    id: `album:${album.albumId}`,
    albumId: album.albumId,
    title: album.name,
    artist: album.artist.name,
    coverUrl: chooseThumbnail(album.thumbnails, ""),
    year: album.year ? String(album.year) : undefined,
    trackCount,
  }
}

function createArtistResult(artist: ArtistDetailed | ArtistFull): MusicArtistResult {
  return {
    type: "artist",
    id: `artist:${artist.artistId}`,
    artistId: artist.artistId,
    name: artist.name,
    imageUrl: chooseThumbnail(artist.thumbnails, ""),
    playableAlbumCount: "topAlbums" in artist ? artist.topAlbums.length + artist.topSingles.length : undefined,
    playableSongCount: "topSongs" in artist ? artist.topSongs.length : undefined,
  }
}

function createAlbumSummary(album: AlbumFull): AlbumSummary {
  return {
    id: album.albumId,
    title: album.name,
    creator: album.artist.name,
    year: album.year ? String(album.year) : undefined,
    coverUrl: chooseThumbnail(album.thumbnails, ""),
  }
}

function createAlbumPayload(album: AlbumFull): MusicAlbumPayload {
  return {
    album: createAlbumSummary(album),
    tracks: album.songs.map((song: SongDetailed) =>
      buildQueueTrack(song, {
        albumId: album.albumId,
        albumTitle: album.name,
      })
    ),
  }
}

function paginate<T>(items: T[], page: number, pageSize = SEARCH_PAGE_SIZE) {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

async function buildSearchResponse(
  query: string,
  page = 1,
  trace?: SearchTrace,
  harder = false
): Promise<MusicSearchResponse> {
  const trimmed = query.trim()
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1
  if (!trimmed) {
    throw new Error("Query required")
  }

  const redisCached = await getCachedJson<MusicSearchResponse>(
    searchResponseCacheKey(trimmed, currentPage, harder)
  )
  if (redisCached) {
    setCached(searchCache, searchResponseCacheKey(trimmed, currentPage, harder), redisCached)
    return redisCached
  }

  const cached = getCached(
    searchCache,
    searchResponseCacheKey(trimmed, currentPage, harder),
    SEARCH_CACHE_TTL_MS
  )
  if (cached) return cached

  const client = await getYtMusic(trace)
  const [songs, albums, artists] = await Promise.all([
    trace
      ? trace.time("yt-search:songs", async () => client.searchSongs(trimmed), { query: trimmed })
      : client.searchSongs(trimmed),
    trace
      ? trace.time("yt-search:albums", async () => client.searchAlbums(trimmed), { query: trimmed })
      : client.searchAlbums(trimmed),
    trace
      ? trace.time("yt-search:artists", async () => client.searchArtists(trimmed), { query: trimmed })
      : client.searchArtists(trimmed),
  ])

  const allResults: MusicSearchResult[] = [
    ...songs.map(createSongResult),
    ...albums.map(createAlbumResult),
    ...artists.map(createArtistResult),
  ]

  const response = {
    query: trimmed,
    page: currentPage,
    totalResults: allResults.length,
    hasMore: currentPage * SEARCH_PAGE_SIZE < allResults.length,
    results: paginate(allResults, currentPage),
  } satisfies MusicSearchResponse

  setCached(searchCache, searchResponseCacheKey(trimmed, currentPage, harder), response)
  await setCachedJson(
    searchResponseCacheKey(trimmed, currentPage, harder),
    response,
    SEARCH_CACHE_TTL_SECONDS
  )
  return response
}

async function buildArtistPayloadInternal(artistId: string) {
  const client = await getYtMusic()
  const [artist, songs, albums] = await Promise.all([
    client.getArtist(artistId),
    client.getArtistSongs(artistId),
    client.getArtistAlbums(artistId),
  ])

  return {
    artistId: artist.artistId,
    name: artist.name,
    imageUrl: chooseThumbnail(artist.thumbnails, ""),
    albums: albums.slice(0, 12).map(createAlbumResult),
    songs: songs.slice(0, 12).map(createSongResult),
  } satisfies MusicArtistPayload
}

export async function getMusicArtistPayload(artistId: string) {
  const trimmed = artistId.trim()
  if (!trimmed) throw new Error("Artist id required")

  const redisCached = await getCachedJson<MusicArtistPayload>(artistPayloadCacheKey(trimmed))
  if (redisCached) {
    setCached(artistCache, trimmed, redisCached)
    return redisCached
  }

  const cached = getCached(artistCache, trimmed, ARTIST_CACHE_TTL_MS)
  if (cached !== null) return cached

  try {
    const payload = await buildArtistPayloadInternal(trimmed)
    setCached(artistCache, trimmed, payload)
    await setCachedJson(artistPayloadCacheKey(trimmed), payload, METADATA_CACHE_TTL_SECONDS)
    return payload
  } catch {
    return setCached(artistCache, trimmed, null)
  }
}

export async function getMusicAlbumPayload(albumId: string) {
  const trimmed = albumId.trim()
  if (!trimmed) throw new Error("Album id required")

  const redisCached = await getCachedJson<MusicAlbumPayload>(albumPayloadCacheKey(trimmed))
  if (redisCached) {
    setCached(albumCache, trimmed, redisCached)
    return redisCached
  }

  const cached = getCached(albumCache, trimmed, ALBUM_CACHE_TTL_MS)
  if (cached !== null) return cached

  try {
    const client = await getYtMusic()
    const album = await client.getAlbum(trimmed)
    const payload = createAlbumPayload(album)
    setCached(albumCache, trimmed, payload)
    await setCachedJson(albumPayloadCacheKey(trimmed), payload, METADATA_CACHE_TTL_SECONDS)
    return payload
  } catch {
    return setCached(albumCache, trimmed, null)
  }
}

export function createSearchTrace(query: string, page: number): SearchTrace {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = now()
  const counters: Record<string, number> = {}

  return {
    requestId,
    query,
    page,
    startedAt,
    counters,
    log(event, data = {}) {
      console.log(
        "[music-search]",
        JSON.stringify({
          requestId,
          query,
          page,
          event,
          elapsedMs: now() - startedAt,
          ...data,
        })
      )
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

export async function streamMusicSearchResponse(
  query: string,
  page: number,
  emit: (chunk: MusicSearchStreamChunk) => Promise<void> | void,
  trace?: SearchTrace,
  harder = false
) {
  const response = await buildSearchResponse(query, page, trace, harder)
  await emit({
    type: "final",
    response,
  })
  trace?.flush("ok", {
    results: response.results.length,
    totalResults: response.totalResults,
    hasMore: response.hasMore,
  })
}
