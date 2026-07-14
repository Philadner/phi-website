export interface AlbumSummary {
  id: string
  title: string
  creator?: string
  description?: string
  year?: string
  coverUrl: string
}

export interface QueueTrack {
  trackId: string
  videoId: string
  albumId?: string
  albumTitle: string
  artist: string
  title: string
  coverUrl: string
  duration?: number | null
  contentType?: string
}

export interface TrackResolveRequest {
  trackId: string
  videoId: string
  intent?: "play" | "preload"
}

export type TrackResolveResponse =
  | {
      status: "ready"
      playbackUrl: string
      mimeType: string
      cachedAt: string
    }
  | {
      status: "preparing"
      mode: "loading" | "compressing"
    }
  | {
      status: "starter"
      playbackUrl: string
      expiresAt: number
    }
  | {
      status: "error"
      message: string
    }

export interface MusicSongResult {
  type: "song"
  id: string
  title: string
  artist: string
  coverUrl: string
  albumTitle?: string
  duration?: number | null
  track: QueueTrack
}

export interface MusicAlbumResult {
  type: "album"
  id: string
  albumId: string
  title: string
  artist: string
  coverUrl: string
  year?: string
  description?: string
  trackCount: number
}

export interface MusicArtistResult {
  type: "artist"
  id: string
  artistId: string
  name: string
  imageUrl: string
  playableAlbumCount?: number
  playableSongCount?: number
}

export type MusicSearchResult =
  | MusicSongResult
  | MusicAlbumResult
  | MusicArtistResult

export interface MusicSearchResponse {
  query: string
  page: number
  totalResults: number
  hasMore: boolean
  results: MusicSearchResult[]
}

export type MusicSearchStreamChunk =
  | {
      type: "partial"
      response: MusicSearchResponse
    }
  | {
      type: "final"
      response: MusicSearchResponse
    }
  | {
      type: "error"
      message: string
    }

export interface MusicArtistPayload {
  artistId: string
  name: string
  imageUrl: string
  albums: MusicAlbumResult[]
  songs: MusicSongResult[]
}

export interface MusicAlbumPayload {
  album: AlbumSummary
  tracks: QueueTrack[]
}

export function createTrackId(videoId: string) {
  return encodeURIComponent(videoId)
}
