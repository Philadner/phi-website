import YTMusic, {
  type AlbumDetailed,
  type AlbumFull,
  type ArtistDetailed,
  type ArtistFull,
  type SongDetailed,
} from "ytmusic-api"
import type {
  AlbumSummary,
  MusicAlbumResult,
  MusicArtistPayload,
  MusicArtistResult,
  MusicSearchResponse,
  MusicSongResult,
  QueueTrack,
} from "../../src/lib/musicTypes"

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
}

const SEARCH_PAGE_SIZE = 20
const SEARCH_CACHE_TTL_MS = 60_000
const ARTIST_CACHE_TTL_MS = 5 * 60_000
const ALBUM_CACHE_TTL_MS = 10 * 60_000

const searchCache = new Map<string, { ts: number; value: MusicSearchResponse }>()
const artistCache = new Map<string, { ts: number; value: MusicArtistPayload | null }>()
const archiveMetadataCache = new Map<string, { ts: number; value: ParsedArchiveItem | null }>()
const ytAlbumCache = new Map<string, { ts: number; value: AlbumFull }>()
const matchedAlbumCache = new Map<string, { ts: number; value: MatchedArchiveAlbum | null }>()
const searchSeedCache = new Map<string, { ts: number; value: SearchSeed }>()

type SearchSeed = {
  songs: MusicSongResult[]
  albums: MusicAlbumResult[]
  artists: MusicArtistResult[]
  usedArchiveIds: Set<string>
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

async function getYtMusic() {
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

  return ytmusicPromise
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

function chooseThumbnail(
  thumbnails: Array<{ url: string; width: number; height: number }> | undefined,
  fallback: string
) {
  if (!thumbnails?.length) return fallback
  const sorted = [...thumbnails].sort((a, b) => b.width * b.height - a.width * a.height)
  return sorted[0]?.url || fallback
}

function serviceThumb(id: string) {
  return `https://archive.org/services/img/${id}`
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
    .map((file) => ({
      albumId: id,
      albumTitle: album.title,
      artist: album.creator || "Unknown Artist",
      title: getTrackTitle(file),
      fileName: file.name,
      sourceUrl: `https://archive.org/download/${id}/${encodeURIComponent(file.name)}`,
      coverUrl: album.coverUrl,
    }))

  return { album, tracks }
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "phi-music-player",
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

async function searchArchive(query: string, page: number, rows = SEARCH_PAGE_SIZE) {
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
  url.searchParams.set("rows", String(rows))
  url.searchParams.set("page", String(page))
  url.searchParams.set("output", "json")

  return fetchJson<{ response?: { docs?: ArchiveDoc[]; numFound?: number } }>(url.toString())
}

async function getArchiveMetadata(id: string) {
  const cached = getCached(archiveMetadataCache, id, ALBUM_CACHE_TTL_MS)
  if (cached !== null) return cached

  try {
    const data = await fetchJson<ArchiveMetadata>(
      `https://archive.org/metadata/${encodeURIComponent(id)}`
    )
    return setCached(archiveMetadataCache, id, parseArchiveMetadata(id, data))
  } catch {
    return setCached(archiveMetadataCache, id, null)
  }
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
    id: `song:${track.albumId}:${track.fileName}`,
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

async function getYtAlbum(albumId: string) {
  const cached = getCached(ytAlbumCache, albumId, ALBUM_CACHE_TTL_MS)
  if (cached) return cached
  const client = await getYtMusic()
  const album = await client.getAlbum(albumId)
  return setCached(ytAlbumCache, albumId, album)
}

async function matchArchiveAlbum(ytAlbum: AlbumDetailed | AlbumFull) {
  const cacheKey = `${ytAlbum.albumId}:${normaliseText(ytAlbum.name)}`
  const cached = getCached(matchedAlbumCache, cacheKey, ALBUM_CACHE_TTL_MS)
  if (cached !== null) return cached

  const albumQuery = [ytAlbum.name, ytAlbum.artist.name].filter(Boolean).join(" ")
  const archiveSearch = await searchArchive(albumQuery, 1, 8)
  const docs = archiveSearch.response?.docs || []
  let bestMatch: MatchedArchiveAlbum | null = null
  let bestDownloads = -1

  const ytTrackNames =
    "songs" in ytAlbum && Array.isArray(ytAlbum.songs) ? ytAlbum.songs.map((song) => song.name) : []

  for (const doc of docs) {
    const parsed = await getArchiveMetadata(doc.identifier)
    if (!parsed || parsed.tracks.length < 2 || ytTrackNames.length < 2) continue

    const matchedTrackCount = countTrackOverlap(
      ytTrackNames,
      parsed.tracks.map((track) => track.title)
    )

    if (matchedTrackCount < 2) continue

    const downloads = doc.downloads || 0
    if (
      !bestMatch ||
      matchedTrackCount > bestMatch.matchedTrackCount ||
      (matchedTrackCount === bestMatch.matchedTrackCount && downloads > bestDownloads)
    ) {
      bestDownloads = downloads
      bestMatch = {
        ...parsed,
        downloads: doc.downloads,
        matchedTrackCount,
      }
    }
  }

  return setCached(matchedAlbumCache, cacheKey, bestMatch)
}

async function matchSongFromArchive(song: SongDetailed): Promise<MusicSongResult | null> {
  if (song.album?.albumId) {
    try {
      const ytAlbum = await getYtAlbum(song.album.albumId)
      const matchedAlbum = await matchArchiveAlbum(ytAlbum)
      const matchedTrack = matchedAlbum?.tracks.find((track) => trackMatches(song.name, track.title))
      if (matchedAlbum && matchedTrack) {
        return createSongResult(matchedTrack, {
          coverUrl: chooseThumbnail(song.thumbnails, matchedAlbum.album.coverUrl),
          duration: song.duration,
          title: song.name,
          artist: song.artist.name,
          albumTitle: ytAlbum.name,
        })
      }
    } catch {
      // fall through to direct archive matching
    }
  }

  const archiveQuery = [song.name, song.artist.name].filter(Boolean).join(" ")
  const archiveSearch = await searchArchive(archiveQuery, 1, 6)
  for (const doc of archiveSearch.response?.docs || []) {
    const parsed = await getArchiveMetadata(doc.identifier)
    if (!parsed) continue

    if (parsed.tracks.length === 1 && trackMatches(song.name, parsed.tracks[0].title)) {
      return createSongResult(parsed.tracks[0], {
        coverUrl: chooseThumbnail(song.thumbnails, parsed.album.coverUrl),
        duration: song.duration,
        title: song.name,
        artist: song.artist.name,
      })
    }

    const matchedTrack = parsed.tracks.find((track) => trackMatches(song.name, track.title))
    if (matchedTrack) {
      return createSongResult(matchedTrack, {
        coverUrl: chooseThumbnail(song.thumbnails, parsed.album.coverUrl),
        duration: song.duration,
        title: song.name,
        artist: song.artist.name,
      })
    }
  }

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

  const cached = getCached(artistCache, trimmed, ARTIST_CACHE_TTL_MS)
  if (cached !== null) return cached

  const client = await getYtMusic()
  try {
    const artist = await client.getArtist(trimmed)
    const payload = await buildArtistPayloadInternal(artist)
    return setCached(artistCache, trimmed, payload)
  } catch {
    return setCached(artistCache, trimmed, null)
  }
}

async function getSearchSeed(query: string) {
  const cached = getCached(searchSeedCache, query, SEARCH_CACHE_TTL_MS)
  if (cached) return cached

  const client = await getYtMusic()
  const [ytSongs, ytAlbums, ytArtists] = await Promise.all([
    client.searchSongs(query),
    client.searchAlbums(query),
    client.searchArtists(query),
  ])

  const songs: MusicSongResult[] = []
  const albums: MusicAlbumResult[] = []
  const artists: MusicArtistResult[] = []
  const usedArchiveIds = new Set<string>()
  const seenSongIds = new Set<string>()
  const seenAlbumIds = new Set<string>()
  const seenArtistIds = new Set<string>()

  for (const song of ytSongs.slice(0, 6)) {
    const matchedSong = await matchSongFromArchive(song)
    if (!matchedSong || seenSongIds.has(matchedSong.id)) continue
    seenSongIds.add(matchedSong.id)
    usedArchiveIds.add(matchedSong.track.albumId)
    songs.push(matchedSong)
  }

  for (const album of ytAlbums.slice(0, 6)) {
    try {
      const fullAlbum = await getYtAlbum(album.albumId)
      const matchedAlbum = await matchArchiveAlbum(fullAlbum)
      if (!matchedAlbum || seenAlbumIds.has(matchedAlbum.album.id)) continue
      seenAlbumIds.add(matchedAlbum.album.id)
      usedArchiveIds.add(matchedAlbum.album.id)
      albums.push(
        createAlbumResult(matchedAlbum, matchedAlbum.downloads, {
          coverUrl: chooseThumbnail(album.thumbnails, matchedAlbum.album.coverUrl),
          title: album.name,
          artist: album.artist.name,
          matchedTrackCount: matchedAlbum.matchedTrackCount,
        })
      )
    } catch {
      // ignore unstable YT album failures
    }
  }

  for (const artist of ytArtists.slice(0, 4)) {
    if (seenArtistIds.has(artist.artistId)) continue
    const payload = await getMusicArtistPayload(artist.artistId)
    if (!payload) continue
    seenArtistIds.add(artist.artistId)
    artists.push({
      type: "artist",
      id: `artist:${artist.artistId}`,
      artistId: artist.artistId,
      name: payload.name,
      imageUrl: payload.imageUrl || chooseThumbnail(artist.thumbnails, ""),
      playableAlbumCount: payload.albums.length,
      playableSongCount: payload.songs.length,
    })
  }

  return setCached(searchSeedCache, query, { songs, albums, artists, usedArchiveIds })
}

async function buildArchiveFallbackResults(
  docs: ArchiveDoc[],
  usedArchiveIds: Set<string>
) {
  const results: Array<MusicSongResult | MusicAlbumResult> = []

  for (const doc of docs) {
    if (usedArchiveIds.has(doc.identifier)) continue

    const parsed = await getArchiveMetadata(doc.identifier)
    if (!parsed?.tracks.length) continue

    if (parsed.tracks.length === 1) {
      results.push(createSongResult(parsed.tracks[0]))
      usedArchiveIds.add(doc.identifier)
      continue
    }

    results.push(createAlbumResult(parsed, doc.downloads))
    usedArchiveIds.add(doc.identifier)
  }

  return results
}

async function buildArchiveOnlySearch(query: string, page: number): Promise<MusicSearchResponse> {
  const archiveData = await searchArchive(query, page)
  const docs = archiveData.response?.docs || []
  const numFound = Number(archiveData.response?.numFound || 0)
  const usedArchiveIds = new Set<string>()
  const results = await buildArchiveFallbackResults(docs, usedArchiveIds)

  return {
    query,
    page,
    totalResults: numFound,
    hasMore: page * SEARCH_PAGE_SIZE < numFound,
    results,
  }
}

export async function getMusicSearchResponse(query: string, page = 1): Promise<MusicSearchResponse> {
  const trimmed = query.trim()
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1
  if (!trimmed) {
    throw new Error("Query required")
  }

  const cacheKey = `${trimmed}|${currentPage}`
  const cached = getCached(searchCache, cacheKey, SEARCH_CACHE_TTL_MS)
  if (cached) return cached

  try {
    const archiveData = await searchArchive(trimmed, currentPage)
    const docs = archiveData.response?.docs || []
    const numFound = Number(archiveData.response?.numFound || 0)

    if (currentPage > 1) {
      const results = await buildArchiveFallbackResults(docs, new Set<string>())
      return setCached(searchCache, cacheKey, {
        query: trimmed,
        page: currentPage,
        totalResults: numFound,
        hasMore: currentPage * SEARCH_PAGE_SIZE < numFound,
        results,
      })
    }

    const seed = await getSearchSeed(trimmed)
    const archiveFallback = await buildArchiveFallbackResults(docs, new Set(seed.usedArchiveIds))
    const results = [...seed.songs, ...seed.albums, ...seed.artists, ...archiveFallback]

    return setCached(searchCache, cacheKey, {
      query: trimmed,
      page: currentPage,
      totalResults: seed.songs.length + seed.albums.length + seed.artists.length + numFound,
      hasMore: currentPage * SEARCH_PAGE_SIZE < numFound,
      results,
    })
  } catch {
    const fallback = await buildArchiveOnlySearch(trimmed, currentPage)
    return setCached(searchCache, cacheKey, fallback)
  }
}
