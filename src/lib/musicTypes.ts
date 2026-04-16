export interface AlbumSummary {
  id: string
  title: string
  creator?: string
  description?: string
  year?: string
  coverUrl: string
}

export interface QueueTrack {
  albumId: string
  albumTitle: string
  artist: string
  title: string
  fileName: string
  sourceUrl: string
  coverUrl: string
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
  archiveId: string
  title: string
  artist: string
  coverUrl: string
  year?: string
  description?: string
  downloads?: number
  trackCount: number
  matchedTrackCount?: number
}

export interface MusicArtistResult {
  type: "artist"
  id: string
  artistId: string
  name: string
  imageUrl: string
  playableAlbumCount: number
  playableSongCount: number
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

export interface MusicArtistPayload {
  artistId: string
  name: string
  imageUrl: string
  albums: MusicAlbumResult[]
  songs: MusicSongResult[]
}
