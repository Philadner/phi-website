import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import type {
  AlbumSummary,
  MusicArtistPayload,
  MusicSearchResponse,
  MusicSearchResult,
  MusicSearchStreamChunk,
  QueueTrack,
  TrackResolveResponse,
} from "../lib/musicTypes"
import { createTrackId } from "../lib/musicTypes"

interface FileEntry {
  name: string
  format?: string
  size?: number
  title?: string
}

type SearchCacheEntry = {
  response: MusicSearchResponse
  ts: number
}

type AlbumCacheEntry = {
  album: AlbumSummary
  tracks: QueueTrack[]
}

type ArtistCacheEntry = {
  artist: MusicArtistPayload | null
  ts: number
}

function isMusicSearchResponse(value: unknown): value is MusicSearchResponse {
  if (!value || typeof value !== "object") return false
  return "results" in value && "query" in value && "page" in value
}

function parseSearchStreamMessage(raw: string): MusicSearchStreamChunk {
  const parsed = JSON.parse(raw) as MusicSearchStreamChunk | MusicSearchResponse
  if (isMusicSearchResponse(parsed)) {
    return {
      type: "final",
      response: parsed,
    }
  }
  return parsed
}

interface MusicPlayerContextValue {
  searchQuery: string
  setSearchQuery: (value: string) => void
  submitSearch: () => void
  goToMusicHome: () => void
  searchResults: MusicSearchResult[]
  numFound: number
  searchLoading: boolean
  searchLoadingMore: boolean
  searchLoadingLabel: string
  searchError: string | null
  hasMoreSearch: boolean
  loadMoreSearch: () => Promise<void>
  selectedAlbum: AlbumSummary | null
  selectedAlbumId: string | null
  albumTracks: QueueTrack[]
  albumLoading: boolean
  albumError: string | null
  selectAlbum: (id: string) => Promise<void>
  clearSelectedAlbum: () => void
  selectedArtist: MusicArtistPayload | null
  selectedArtistId: string | null
  artistLoading: boolean
  artistError: string | null
  selectArtist: (id: string) => Promise<void>
  clearSelectedArtist: () => void
  queue: QueueTrack[]
  activeQueueIndex: number | null
  currentTrack: QueueTrack | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  currentPlaybackStatus: "idle" | "preparing" | "ready" | "error"
  currentPlaybackMessage: string | null
  queueDrawerOpen: boolean
  setQueueDrawerOpen: (open: boolean) => void
  playTrack: (track: QueueTrack, queueSeed?: QueueTrack[]) => Promise<void>
  togglePlayPause: () => Promise<void>
  playNext: () => Promise<void>
  playPrevious: () => Promise<void>
  setVolume: (value: number) => void
  seek: (time: number) => void
  moveQueueItem: (from: number, to: number) => void
  removeQueueItem: (index: number) => void
  addTrackToQueue: (track: QueueTrack) => void
  playTrackNext: (track: QueueTrack) => void
  setActiveQueueIndex: (index: number) => Promise<void>
  resetSession: () => void
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null)

const SEARCH_CACHE_TTL_MS = 60_000
const SEARCH_STAGE_MATCHES = "Looking for the best matches..."
const SEARCH_STAGE_PLAYABLE = "Checking what we can actually play..."
const ARTIST_CACHE_TTL_MS = 5 * 60_000
const searchCache = new Map<string, SearchCacheEntry>()
const albumCache = new Map<string, AlbumCacheEntry>()
const artistCache = new Map<string, ArtistCacheEntry>()

function mergeSearchResults(previous: MusicSearchResult[], incoming: MusicSearchResult[]) {
  const byId = new Map(previous.map((item) => [item.id, item]))
  for (const item of incoming) {
    byId.set(item.id, item)
  }

  const ordered: MusicSearchResult[] = []
  const seen = new Set<string>()

  for (const item of incoming) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    ordered.push(byId.get(item.id) || item)
  }

  for (const item of previous) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    ordered.push(byId.get(item.id) || item)
  }

  return ordered
}

function applySearchChunk(
  chunk: MusicSearchStreamChunk,
  append: boolean,
  page: number,
  setSearchResults: Dispatch<SetStateAction<MusicSearchResult[]>>,
  setNumFound: Dispatch<SetStateAction<number>>,
  setHasMoreSearch: Dispatch<SetStateAction<boolean>>,
  setSearchError: Dispatch<SetStateAction<string | null>>,
  setSearchPage: Dispatch<SetStateAction<number>>,
  setSearchLoadingLabel: Dispatch<SetStateAction<string>>
) {
  if (chunk.type === "error") {
    throw new Error(chunk.message)
  }

  setSearchResults((previous) => {
    if (!append) return chunk.response.results
    return mergeSearchResults(previous, chunk.response.results)
  })
  setNumFound(chunk.response.totalResults)
  setHasMoreSearch(chunk.response.hasMore)
  setSearchError(null)
  setSearchPage(page)
  setSearchLoadingLabel(chunk.type === "partial" ? SEARCH_STAGE_PLAYABLE : SEARCH_STAGE_MATCHES)
}

function getMusicSearchUrl(query: string, page: number) {
  return `/api/music-search?q=${encodeURIComponent(query)}&page=${page}`
}

function getMusicArtistUrl(id: string) {
  return `/api/music-artist?id=${encodeURIComponent(id)}`
}

function getArchiveMetadataUrl(id: string) {
  return `/api/archive-metadata?id=${encodeURIComponent(id)}`
}

function getTrackResolveUrl() {
  return "/api/track-resolve"
}

function serviceThumb(id: string) {
  return `https://archive.org/services/img/${id}`
}

function getTrackPrepareMessage(track: QueueTrack) {
  const extension = track.archiveFileName.toLowerCase().split(".").pop() || ""
  if (["flac", "wav", "aif", "aiff"].includes(extension)) {
    return "huge file: compressing..."
  }

  if ((track.sourceSizeBytes || 0) > 25 * 1024 * 1024) {
    return "huge file: compressing..."
  }

  return "loading"
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

function normaliseAlbum(metadata: Record<string, unknown>, id: string): AlbumSummary {
  const year =
    typeof metadata.year === "string"
      ? metadata.year
      : typeof metadata.date === "string"
        ? metadata.date
        : undefined

  return {
    id,
    title: typeof metadata.title === "string" ? metadata.title : id,
    creator: typeof metadata.creator === "string" ? metadata.creator : undefined,
    description:
      typeof metadata.description === "string" ? metadata.description : undefined,
    year,
    coverUrl: serviceThumb(id),
  }
}

function moveIndex(current: number | null, from: number, to: number) {
  if (current === null) return current
  if (current === from) return to
  if (from < current && to >= current) return current - 1
  if (from > current && to <= current) return current + 1
  return current
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<MusicSearchResult[]>([])
  const [numFound, setNumFound] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchLoadingMore, setSearchLoadingMore] = useState(false)
  const [searchLoadingLabel, setSearchLoadingLabel] = useState(SEARCH_STAGE_MATCHES)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasMoreSearch, setHasMoreSearch] = useState(false)
  const [searchPage, setSearchPage] = useState(1)
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumSummary | null>(null)
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)
  const [albumTracks, setAlbumTracks] = useState<QueueTrack[]>([])
  const [albumLoading, setAlbumLoading] = useState(false)
  const [albumError, setAlbumError] = useState<string | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<MusicArtistPayload | null>(null)
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null)
  const [artistLoading, setArtistLoading] = useState(false)
  const [artistError, setArtistError] = useState<string | null>(null)
  const [queue, setQueue] = useState<QueueTrack[]>([])
  const [activeQueueIndexState, setActiveQueueIndexState] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [currentPlaybackStatus, setCurrentPlaybackStatus] = useState<"idle" | "preparing" | "ready" | "error">("idle")
  const [currentPlaybackMessage, setCurrentPlaybackMessage] = useState<string | null>(null)
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null)
  const searchControllerRef = useRef<AbortController | null>(null)
  const albumRequestRef = useRef(0)
  const artistRequestRef = useRef(0)
  const playbackRequestRef = useRef(0)
  const preloadRequestRef = useRef(0)
  const preloadTrackIdRef = useRef<string | null>(null)
  const preloadUrlRef = useRef<string | null>(null)
  const playbackUrlCacheRef = useRef(new Map<string, string>())
  const shouldAutoplayRef = useRef(false)

  const currentTrack =
    activeQueueIndexState !== null ? queue[activeQueueIndexState] ?? null : null

  const clearSelectedAlbum = useCallback(() => {
    setSelectedAlbum(null)
    setSelectedAlbumId(null)
    setAlbumTracks([])
    setAlbumError(null)
    setAlbumLoading(false)
  }, [])

  const clearSelectedArtist = useCallback(() => {
    setSelectedArtist(null)
    setSelectedArtistId(null)
    setArtistError(null)
    setArtistLoading(false)
  }, [])

  const requestTrackPlayback = useCallback(async (track: QueueTrack, intent: "play" | "preload") => {
    const response = await fetch(getTrackResolveUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trackId: track.trackId,
        archiveItemId: track.archiveItemId,
        archiveFileName: track.archiveFileName,
        sourceSizeBytes: track.sourceSizeBytes,
        intent,
      }),
    })

    const payload = (await response.json()) as TrackResolveResponse
    if (!response.ok && payload.status !== "preparing") {
      throw new Error(
        payload.status === "error" ? payload.message : `Track resolve failed: ${response.status}`
      )
    }

    return payload
  }, [])

  const waitForTrackPlayback = useCallback(async (track: QueueTrack, intent: "play" | "preload") => {
    const cachedUrl = playbackUrlCacheRef.current.get(track.trackId)
    if (cachedUrl && intent === "preload") {
      return {
        status: "ready",
        playbackUrl: cachedUrl,
        mimeType: "audio/mpeg",
        cachedAt: new Date().toISOString(),
      } satisfies TrackResolveResponse
    }

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const payload = await requestTrackPlayback(track, intent)

      if (payload.status === "ready") {
        playbackUrlCacheRef.current.set(track.trackId, payload.playbackUrl)
        return payload
      }

      if (payload.status === "error") {
        throw new Error(payload.message)
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1500))
    }

    throw new Error("Track preparation timed out")
  }, [requestTrackPlayback])

  const runSearch = useCallback(async (query: string, page: number, append = false) => {
    const trimmed = query.trim()
    if (!trimmed) {
      searchControllerRef.current?.abort()
      setSearchLoading(false)
      setSearchLoadingMore(false)
      setSearchLoadingLabel(SEARCH_STAGE_MATCHES)
      setSearchError(null)
      setSearchResults([])
      setNumFound(0)
      setHasMoreSearch(false)
      return
    }

    const cacheKey = `${trimmed}|${page}`
    const cached = searchCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
      setSearchResults((previous) => {
        if (!append) return cached.response.results
        const known = new Set(previous.map((item) => item.id))
        const nextItems = cached.response.results.filter((item) => !known.has(item.id))
        return nextItems.length ? [...previous, ...nextItems] : previous
      })
      setNumFound(cached.response.totalResults)
      setHasMoreSearch(cached.response.hasMore)
      setSearchError(null)
      setSearchLoading(false)
      setSearchLoadingMore(false)
      setSearchLoadingLabel(SEARCH_STAGE_MATCHES)
      if (append) setSearchPage(page)
      return
    }

    if (append) {
      setSearchLoadingMore(true)
    } else {
      searchControllerRef.current?.abort()
      setSearchLoading(true)
      setSearchLoadingLabel(SEARCH_STAGE_MATCHES)
      window.setTimeout(() => {
        setSearchLoadingLabel((previous) =>
          previous === SEARCH_STAGE_MATCHES
            ? SEARCH_STAGE_PLAYABLE
            : previous
        )
      }, 450)
    }
    setSearchError(null)

    const controller = new AbortController()
    searchControllerRef.current = controller

    try {
      const response = await fetch(getMusicSearchUrl(trimmed, page), {
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      let finalPayload: MusicSearchResponse | null = null

      if (response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine) continue

            const chunk = parseSearchStreamMessage(trimmedLine)
            if (chunk.type !== "error") {
              finalPayload = chunk.response
            }
            applySearchChunk(
              chunk,
              append,
              page,
              setSearchResults,
              setNumFound,
              setHasMoreSearch,
              setSearchError,
              setSearchPage,
              setSearchLoadingLabel
            )
          }
        }

        const finalLine = buffer.trim()
        if (finalLine) {
          const chunk = parseSearchStreamMessage(finalLine)
          if (chunk.type !== "error") {
            finalPayload = chunk.response
          }
          applySearchChunk(
            chunk,
            append,
            page,
            setSearchResults,
            setNumFound,
            setHasMoreSearch,
            setSearchError,
            setSearchPage,
            setSearchLoadingLabel
          )
        }
      } else {
        const payload = (await response.json()) as MusicSearchResponse
        finalPayload = payload
        setSearchResults((previous) => {
          if (!append) return payload.results
          return mergeSearchResults(previous, payload.results)
        })
        setNumFound(payload.totalResults)
        setHasMoreSearch(payload.hasMore)
        setSearchError(null)
        setSearchPage(page)
        setSearchLoadingLabel(SEARCH_STAGE_MATCHES)
      }

      if (!finalPayload) {
        throw new Error("Search stream ended without a response")
      }

      searchCache.set(cacheKey, { response: finalPayload, ts: Date.now() })
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return
      if (!append) {
        setSearchResults([])
        setNumFound(0)
        setHasMoreSearch(false)
      }
      setSearchError(error instanceof Error ? error.message : "Search failed")
      setSearchLoadingLabel(SEARCH_STAGE_MATCHES)
    } finally {
      if (append) {
        setSearchLoadingMore(false)
      } else {
        setSearchLoading(false)
      }
    }
  }, [])

  const selectAlbum = useCallback(async (id: string) => {
    if (!id) return

    clearSelectedArtist()
    setSelectedAlbumId(id)
    setAlbumLoading(true)
    setAlbumError(null)

    const cached = albumCache.get(id)
    if (cached) {
      setSelectedAlbum(cached.album)
      setAlbumTracks(cached.tracks)
      setAlbumLoading(false)
      return
    }

    const requestId = albumRequestRef.current + 1
    albumRequestRef.current = requestId

    try {
      const response = await fetch(getArchiveMetadataUrl(id))
      if (!response.ok) {
        throw new Error(`Album failed: ${response.status}`)
      }

      const data = await response.json()
      if (albumRequestRef.current !== requestId) return

      const album = normaliseAlbum(data?.metadata || {}, id)
      const tracks = ((data?.files || []) as FileEntry[])
        .filter(isAudioFile)
        .map((file) => ({
          trackId: createTrackId(id, file.name),
          archiveItemId: id,
          archiveFileName: file.name,
          albumTitle: album.title,
          artist: album.creator || "Unknown Artist",
          title: getTrackTitle(file),
          coverUrl: album.coverUrl,
          sourceSizeBytes: typeof file.size === "number" ? file.size : Number(file.size) || undefined,
        }))

      albumCache.set(id, { album, tracks })
      setSelectedAlbum(album)
      setAlbumTracks(tracks)
      setAlbumError(null)
    } catch (error: unknown) {
      if (albumRequestRef.current !== requestId) return
      setSelectedAlbum(null)
      setAlbumTracks([])
      setAlbumError(error instanceof Error ? error.message : "Failed to load album")
    } finally {
      if (albumRequestRef.current === requestId) {
        setAlbumLoading(false)
      }
    }
  }, [clearSelectedArtist])

  const selectArtist = useCallback(async (id: string) => {
    if (!id) return

    clearSelectedAlbum()
    setSelectedArtistId(id)
    setArtistLoading(true)
    setArtistError(null)

    const cached = artistCache.get(id)
    if (cached && Date.now() - cached.ts < ARTIST_CACHE_TTL_MS) {
      setSelectedArtist(cached.artist)
      setArtistLoading(false)
      if (!cached.artist) {
        setArtistError("Artist not found")
      }
      return
    }

    const requestId = artistRequestRef.current + 1
    artistRequestRef.current = requestId

    try {
      const response = await fetch(getMusicArtistUrl(id))
      if (!response.ok) {
        throw new Error(`Artist failed: ${response.status}`)
      }

      const payload = (await response.json()) as MusicArtistPayload
      if (artistRequestRef.current !== requestId) return

      artistCache.set(id, { artist: payload, ts: Date.now() })
      setSelectedArtist(payload)
      setArtistError(null)
    } catch (error: unknown) {
      if (artistRequestRef.current !== requestId) return
      setSelectedArtist(null)
      setArtistError(error instanceof Error ? error.message : "Failed to load artist")
    } finally {
      if (artistRequestRef.current === requestId) {
        setArtistLoading(false)
      }
    }
  }, [clearSelectedAlbum])

  const queueAndPlayIndex = useCallback(async (nextQueue: QueueTrack[], index: number) => {
    if (!nextQueue.length) return
    shouldAutoplayRef.current = true
    setQueue(nextQueue)
    setActiveQueueIndexState(index)
    setQueueDrawerOpen(false)
  }, [])

  const playTrack = useCallback(
    async (track: QueueTrack, queueSeed?: QueueTrack[]) => {
      const nextQueue = queueSeed?.length ? queueSeed : queue
      const index = nextQueue.findIndex((item) => item.trackId === track.trackId)
      if (index === -1) return
      await queueAndPlayIndex(nextQueue, index)
    },
    [queue, queueAndPlayIndex]
  )

  const setActiveQueueIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= queue.length) return
      if (activeQueueIndexState === index && currentTrack) {
        const audio = audioRef.current
        if (!audio) return
        if (audio.paused) {
          try {
            await audio.play()
          } catch {
            setIsPlaying(false)
          }
        }
        return
      }

      shouldAutoplayRef.current = true
      setActiveQueueIndexState(index)
      setQueueDrawerOpen(false)
    },
    [activeQueueIndexState, currentTrack, queue.length]
  )

  const playNext = useCallback(async () => {
    if (!queue.length) return
    const nextIndex =
      activeQueueIndexState === null
        ? 0
        : (activeQueueIndexState + 1) % queue.length
    await setActiveQueueIndex(nextIndex)
  }, [activeQueueIndexState, queue.length, setActiveQueueIndex])

  const playPrevious = useCallback(async () => {
    if (!queue.length) return
    const audio = audioRef.current
    if (audio && audio.currentTime > 5) {
      audio.currentTime = 0
      setCurrentTime(0)
      return
    }

    const prevIndex =
      activeQueueIndexState === null
        ? 0
        : (activeQueueIndexState - 1 + queue.length) % queue.length
    await setActiveQueueIndex(prevIndex)
  }, [activeQueueIndexState, queue.length, setActiveQueueIndex])

  const togglePlayPause = useCallback(async () => {
    if (!queue.length) return
    const audio = audioRef.current
    if (!audio) return

    if (activeQueueIndexState === null) {
      await setActiveQueueIndex(0)
      return
    }

    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setIsPlaying(false)
      }
      return
    }

    audio.pause()
  }, [activeQueueIndexState, queue.length, setActiveQueueIndex])

  const setVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, value))
    setVolumeState(next)
    if (audioRef.current) {
      audioRef.current.volume = next
    }
  }, [])

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }, [])

  const moveQueueItem = useCallback((from: number, to: number) => {
    setQueue((previous) => {
      if (
        from < 0 ||
        to < 0 ||
        from >= previous.length ||
        to >= previous.length ||
        from === to
      ) {
        return previous
      }

      const next = [...previous]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })

    setActiveQueueIndexState((previous) => moveIndex(previous, from, to))
  }, [])

  const removeQueueItem = useCallback((index: number) => {
    setQueue((previous) => previous.filter((_, itemIndex) => itemIndex !== index))
    setActiveQueueIndexState((previous) => {
      if (previous === null) return previous
      if (previous === index) return null
      if (index < previous) return previous - 1
      return previous
    })
  }, [])

  const addTrackToQueue = useCallback((track: QueueTrack) => {
    setQueue((previous) => [...previous, track])
  }, [])

  const playTrackNext = useCallback((track: QueueTrack) => {
    setQueue((previous) => {
      if (!previous.length) return [track]

      const insertAt = activeQueueIndexState === null ? 1 : activeQueueIndexState + 1
      const next = [...previous]
      next.splice(insertAt, 0, track)
      return next
    })
  }, [activeQueueIndexState])

  const goToMusicHome = useCallback(() => {
    searchControllerRef.current?.abort()
    setSearchQuery("")
    setSearchResults([])
    setNumFound(0)
    setSearchError(null)
    setSearchLoading(false)
    setSearchLoadingMore(false)
        setSearchLoadingLabel(SEARCH_STAGE_MATCHES)
    setHasMoreSearch(false)
    setSearchPage(1)
    clearSelectedAlbum()
    clearSelectedArtist()
  }, [clearSelectedAlbum, clearSelectedArtist])

  const resetSession = useCallback(() => {
    searchControllerRef.current?.abort()
    albumRequestRef.current += 1
    artistRequestRef.current += 1
    playbackRequestRef.current += 1
    preloadRequestRef.current += 1
    shouldAutoplayRef.current = false
    clearSelectedAlbum()
    clearSelectedArtist()
    setQueue([])
    setActiveQueueIndexState(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setCurrentPlaybackStatus("idle")
    setCurrentPlaybackMessage(null)
    setQueueDrawerOpen(false)
    setSearchLoading(false)
    setSearchLoadingMore(false)
    setSearchLoadingLabel("Searching YouTube Music first...")
    setHasMoreSearch(false)
    playbackUrlCacheRef.current.clear()
    preloadTrackIdRef.current = null
    preloadUrlRef.current = null

    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
    }

    const preloadAudio = preloadAudioRef.current
    if (preloadAudio) {
      preloadAudio.pause()
      preloadAudio.removeAttribute("src")
      preloadAudio.load()
    }
  }, [clearSelectedAlbum, clearSelectedArtist])

  useEffect(() => {
    if (searchQuery.trim()) return

    clearSelectedAlbum()
    clearSelectedArtist()
    setSearchLoading(false)
    setSearchLoadingMore(false)
    setSearchLoadingLabel("Searching YouTube Music first...")
    setSearchError(null)
    setCurrentPlaybackStatus("idle")
    setCurrentPlaybackMessage(null)
    setSearchResults([])
    setNumFound(0)
    setHasMoreSearch(false)
    setSearchPage(1)
  }, [clearSelectedAlbum, clearSelectedArtist, searchQuery])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
    if (preloadAudioRef.current) {
      preloadAudioRef.current.volume = volume
    }
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!currentTrack) {
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setCurrentPlaybackStatus("idle")
      setCurrentPlaybackMessage(null)
      return
    }

    const requestId = playbackRequestRef.current + 1
    playbackRequestRef.current = requestId
    setCurrentPlaybackStatus("preparing")
    setCurrentPlaybackMessage(getTrackPrepareMessage(currentTrack))

    const applyResolvedUrl = async (playbackUrl: string) => {
      if (playbackRequestRef.current !== requestId) return
      if (audio.currentSrc === playbackUrl) {
        setCurrentPlaybackStatus("ready")
        setCurrentPlaybackMessage(null)
        return
      }

      audio.src = playbackUrl
      audio.load()
      setCurrentTime(0)
      setDuration(0)
      setCurrentPlaybackStatus("ready")
      setCurrentPlaybackMessage(null)

      if (!shouldAutoplayRef.current) {
        setIsPlaying(false)
        return
      }

      try {
        await audio.play()
      } catch {
        setIsPlaying(false)
      } finally {
        shouldAutoplayRef.current = false
      }
    }

    const cachedPreloadUrl =
      preloadTrackIdRef.current === currentTrack.trackId ? preloadUrlRef.current : null

    if (cachedPreloadUrl) {
      void requestTrackPlayback(currentTrack, "play").catch(() => {})
      void applyResolvedUrl(cachedPreloadUrl)
      return
    }

    void waitForTrackPlayback(currentTrack, "play")
      .then((payload) => {
        if (payload.status !== "ready") return
        return applyResolvedUrl(payload.playbackUrl)
      })
      .catch((error: unknown) => {
        if (playbackRequestRef.current !== requestId) return
        setCurrentPlaybackStatus("error")
        setCurrentPlaybackMessage(
          error instanceof Error ? error.message : "Track failed to prepare"
        )
        shouldAutoplayRef.current = false
      })
  }, [currentTrack, requestTrackPlayback, waitForTrackPlayback])

  useEffect(() => {
    if (!currentTrack || !queue.length || duration <= 0) return
    if (duration - currentTime > 8) return

    const nextIndex =
      activeQueueIndexState === null
        ? null
        : (activeQueueIndexState + 1) % queue.length
    if (nextIndex === null || nextIndex === activeQueueIndexState) return

    const nextTrack = queue[nextIndex]
    if (!nextTrack || preloadTrackIdRef.current === nextTrack.trackId) return

    const requestId = preloadRequestRef.current + 1
    preloadRequestRef.current = requestId

    void waitForTrackPlayback(nextTrack, "preload")
      .then((payload) => {
        if (preloadRequestRef.current !== requestId || payload.status !== "ready") return

        preloadTrackIdRef.current = nextTrack.trackId
        preloadUrlRef.current = payload.playbackUrl

        const preloadAudio = preloadAudioRef.current
        if (!preloadAudio) return

        preloadAudio.src = payload.playbackUrl
        preloadAudio.load()
      })
      .catch(() => {
        if (preloadRequestRef.current !== requestId) return
        preloadTrackIdRef.current = null
        preloadUrlRef.current = null
      })
  }, [activeQueueIndexState, currentTime, currentTrack, duration, queue, waitForTrackPlayback])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      setCurrentTime(0)
      void playNext()
    }

    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    audio.addEventListener("ended", onEnded)

    return () => {
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
      audio.removeEventListener("ended", onEnded)
    }
  }, [playNext])

  const submitSearch = useCallback(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      clearSelectedAlbum()
      clearSelectedArtist()
      setSearchResults([])
      setNumFound(0)
      setSearchError(null)
      setHasMoreSearch(false)
      setSearchPage(1)
      return
    }

    const nextPage = 1
    setSearchPage(nextPage)
    clearSelectedAlbum()
    clearSelectedArtist()
    void runSearch(trimmed, nextPage)
  }, [clearSelectedAlbum, clearSelectedArtist, runSearch, searchQuery])

  const loadMoreSearch = useCallback(async () => {
    const trimmed = searchQuery.trim()
    if (!trimmed || searchLoading || searchLoadingMore || !hasMoreSearch) return

    const nextPage = searchPage + 1
    await runSearch(trimmed, nextPage, true)
  }, [hasMoreSearch, runSearch, searchLoading, searchLoadingMore, searchPage, searchQuery])

  const value = useMemo<MusicPlayerContextValue>(
    () => ({
      searchQuery,
      setSearchQuery,
      submitSearch,
      goToMusicHome,
      searchResults,
      numFound,
      searchLoading,
      searchLoadingMore,
      searchLoadingLabel,
      searchError,
      hasMoreSearch,
      loadMoreSearch,
      selectedAlbum,
      selectedAlbumId,
      albumTracks,
      albumLoading,
      albumError,
      selectAlbum,
      clearSelectedAlbum,
      selectedArtist,
      selectedArtistId,
      artistLoading,
      artistError,
      selectArtist,
      clearSelectedArtist,
      queue,
      activeQueueIndex: activeQueueIndexState,
      currentTrack,
      isPlaying,
      currentTime,
      duration,
      volume,
      currentPlaybackStatus,
      currentPlaybackMessage,
      queueDrawerOpen,
      setQueueDrawerOpen,
      playTrack,
      togglePlayPause,
      playNext,
      playPrevious,
      setVolume,
      seek,
      moveQueueItem,
      removeQueueItem,
      addTrackToQueue,
      playTrackNext,
      setActiveQueueIndex,
      resetSession,
    }),
    [
      activeQueueIndexState,
      albumError,
      albumLoading,
      albumTracks,
      artistError,
      artistLoading,
      clearSelectedAlbum,
      clearSelectedArtist,
      currentTime,
      currentTrack,
      currentPlaybackMessage,
      currentPlaybackStatus,
      duration,
      goToMusicHome,
      hasMoreSearch,
      isPlaying,
      loadMoreSearch,
      moveQueueItem,
      numFound,
      playNext,
      playPrevious,
      playTrack,
      playTrackNext,
      queue,
      queueDrawerOpen,
      removeQueueItem,
      resetSession,
      searchError,
      searchLoading,
      searchLoadingMore,
      searchLoadingLabel,
      searchQuery,
      searchResults,
      seek,
      selectAlbum,
      selectArtist,
      selectedAlbum,
      selectedAlbumId,
      selectedArtist,
      selectedArtistId,
      setActiveQueueIndex,
      setVolume,
      submitSearch,
      togglePlayPause,
      volume,
      addTrackToQueue,
    ]
  )

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
      <audio ref={preloadAudioRef} preload="metadata" hidden aria-hidden="true" />
    </MusicPlayerContext.Provider>
  )
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext)
  if (!context) {
    throw new Error("useMusicPlayer must be used within MusicPlayerProvider")
  }
  return context
}
