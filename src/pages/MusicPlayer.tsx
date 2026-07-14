import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { useNavigate } from "react-router-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faArrowLeft,
  faBackwardStep,
  faBarsStaggered,
  faCompactDisc,
  faForwardStep,
  faMagnifyingGlass,
  faPause,
  faPlay,
  faSpinner,
  faVolumeHigh,
  faVolumeXmark,
  faXmark,
} from "@fortawesome/free-solid-svg-icons"
import { useMusicPlayer } from "../components/MusicPlayerContext"
import type { MusicAlbumResult, MusicArtistResult, MusicSongResult, QueueTrack } from "../lib/musicTypes"
import "../stylesheets/MusicPlayer.css"

type ContextMenuState =
  | {
      kind: "queue"
      x: number
      y: number
      index: number
      canMoveUp: boolean
      canMoveDown: boolean
    }
  | {
      kind: "track"
      x: number
      y: number
      track: QueueTrack
    }
  | null

type CoverTransitionState = {
  previousTrack: QueueTrack
  currentTrack: QueueTrack
  direction: "next" | "previous"
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const remainder = whole % 60
  return `${minutes}:${String(remainder).padStart(2, "0")}`
}

function getLoadingState(label: string) {
  if (label === "Checking what we can actually play...") {
    return {
      progress: 82,
      detail: "Matching the best results to playable versions now.",
    }
  }

  return {
    progress: 42,
    detail: "Pulling together the strongest song, album, and artist matches first.",
  }
}

function getCoverDirection(
  previousIndex: number | null,
  nextIndex: number | null,
  queueLength: number
) {
  if (previousIndex === null || nextIndex === null || queueLength <= 1) return null
  if (previousIndex === nextIndex) return null

  if ((previousIndex + 1) % queueLength === nextIndex) return "next"
  if ((previousIndex - 1 + queueLength) % queueLength === nextIndex) return "previous"

  return nextIndex > previousIndex ? "next" : "previous"
}

export default function MusicPlayer({
  initialAlbumId,
  initialArtistId,
}: {
  initialAlbumId: string | null
  initialArtistId: string | null
}) {
  const navigate = useNavigate()
  const {
    searchQuery,
    setSearchQuery,
    submitSearch,
    lookHarderSearch,
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
    activeQueueIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    currentPlaybackStatus,
    currentPlaybackMessage,
    queueDrawerOpen,
    setQueueDrawerOpen,
    mobileSearchOpen,
    setMobileSearchOpen,
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
  } = useMusicPlayer()
  const mainPaneRef = useRef<HTMLElement | null>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null)
  const coverTimeoutRef = useRef<number | null>(null)
  const swipeTimeoutRef = useRef<number | null>(null)
  const swipeStartRef = useRef<{
    x: number
    y: number
    lastX: number
    dragging: boolean
  } | null>(null)
  const suppressNextTrackTransitionRef = useRef(false)
  const previousTrackRef = useRef<QueueTrack | null>(null)
  const previousIndexRef = useRef<number | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [coverTransition, setCoverTransition] = useState<CoverTransitionState | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeTransitioning, setSwipeTransitioning] = useState(false)
  const [swipeActive, setSwipeActive] = useState(false)
  const [mobileVolumeOpen, setMobileVolumeOpen] = useState(false)
  const showInitialSearchLoading = searchLoading && searchResults.length === 0
  const loadingState = getLoadingState(searchLoadingLabel)

  const openAlbumForTrack = async (track: QueueTrack) => {
    if (!track.albumId) return
    clearSelectedArtist()
    await selectAlbum(track.albumId)
    navigate(`/musicpl/album/${track.albumId}`)
  }

  const downloadFromPhi = async (track: QueueTrack) => {
    const response = await fetch("/api/track-resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackId: track.trackId,
        videoId: track.videoId,
        intent: "play",
      }),
    })
    const payload = await response.json() as { status: string; playbackUrl?: string }
    if (payload.status === "ready" && payload.playbackUrl) {
      const a = document.createElement("a")
      a.href = payload.playbackUrl
      a.download = `${track.title}.mp3`
      a.click()
    }
  }

  useEffect(() => {
    if (!initialArtistId) return
    if (selectedArtistId === initialArtistId) return
    void selectArtist(initialArtistId)
  }, [initialArtistId, selectArtist, selectedArtistId])

  useEffect(() => {
    if (initialArtistId) return
    if (!initialAlbumId) return
    if (selectedAlbumId === initialAlbumId) return
    void selectAlbum(initialAlbumId)
  }, [initialAlbumId, initialArtistId, selectAlbum, selectedAlbumId])

  useEffect(() => {
    if (!contextMenu) return

    const close = () => setContextMenu(null)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }

    window.addEventListener("click", close)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("resize", close)

    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("resize", close)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!mobileSearchOpen) return
    setMobileVolumeOpen(false)
    mainPaneRef.current?.scrollTo({ top: 0 })
    const frame = window.requestAnimationFrame(() => mobileSearchInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [mobileSearchOpen])

  useEffect(() => {
    const previousTrack = previousTrackRef.current
    const previousIndex = previousIndexRef.current

    if (!currentTrack) {
      setCoverTransition(null)
      previousTrackRef.current = null
      previousIndexRef.current = activeQueueIndex
      if (coverTimeoutRef.current) {
        window.clearTimeout(coverTimeoutRef.current)
        coverTimeoutRef.current = null
      }
      return
    }

    if (previousTrack && previousTrack.trackId !== currentTrack.trackId) {
      const direction = getCoverDirection(previousIndex, activeQueueIndex, queue.length)
      if (direction && !suppressNextTrackTransitionRef.current) {
        if (coverTimeoutRef.current) {
          window.clearTimeout(coverTimeoutRef.current)
        }

        setCoverTransition({
          previousTrack,
          currentTrack,
          direction,
        })

        coverTimeoutRef.current = window.setTimeout(() => {
          setCoverTransition(null)
          coverTimeoutRef.current = null
        }, 320)
      } else {
        setCoverTransition(null)
      }
      suppressNextTrackTransitionRef.current = false
    } else {
      setCoverTransition(null)
    }

    previousTrackRef.current = currentTrack
    previousIndexRef.current = activeQueueIndex
  }, [activeQueueIndex, currentTrack, queue.length])

  useEffect(() => {
    return () => {
      if (coverTimeoutRef.current) {
        window.clearTimeout(coverTimeoutRef.current)
      }
      if (swipeTimeoutRef.current) {
        window.clearTimeout(swipeTimeoutRef.current)
      }
    }
  }, [])

  const previousQueueTrack =
    activeQueueIndex !== null && queue.length > 1
      ? queue[(activeQueueIndex - 1 + queue.length) % queue.length]
      : null
  const nextQueueTrack =
    activeQueueIndex !== null && queue.length > 1
      ? queue[(activeQueueIndex + 1) % queue.length]
      : null

  const swipeStyle = (offset: string): CSSProperties => ({
    transform: `translateX(${offset})`,
    transition: swipeTransitioning ? "transform 180ms ease-out" : "none",
  })

  const resetSwipe = () => {
    if (swipeTimeoutRef.current) window.clearTimeout(swipeTimeoutRef.current)
    setSwipeTransitioning(true)
    setSwipeOffset(0)
    swipeTimeoutRef.current = window.setTimeout(() => {
      setSwipeTransitioning(false)
      setSwipeActive(false)
      swipeTimeoutRef.current = null
    }, 180)
  }

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!currentTrack || queue.length <= 1 || coverTransition) return
    if (swipeTimeoutRef.current) window.clearTimeout(swipeTimeoutRef.current)
    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      dragging: false,
    }
    setSwipeTransitioning(false)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current
    if (!start) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    start.lastX = event.clientX

    if (!start.dragging) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        swipeStartRef.current = null
        return
      }
      start.dragging = true
      setSwipeActive(true)
    }

    event.preventDefault()
    const width = event.currentTarget.clientWidth
    setSwipeOffset(Math.max(-width, Math.min(width, deltaX)))
  }

  const onTrackPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current
    swipeStartRef.current = null
    if (!start?.dragging) {
      setSwipeActive(false)
      return
    }

    const width = event.currentTarget.clientWidth
    const deltaX = start.lastX - start.x
    const threshold = Math.min(96, width * 0.22)
    if (Math.abs(deltaX) < threshold) {
      resetSwipe()
      return
    }

    const direction = deltaX < 0 ? "next" : "previous"
    setSwipeTransitioning(true)
    setSwipeOffset(direction === "next" ? -width : width)
    swipeTimeoutRef.current = window.setTimeout(() => {
      suppressNextTrackTransitionRef.current = true
      setSwipeTransitioning(false)
      setSwipeOffset(0)
      setSwipeActive(false)
      swipeTimeoutRef.current = null
      if (direction === "next") {
        void playNext()
      } else {
        void playPrevious()
      }
    }, 180)
  }

  const onTrackPointerCancel = () => {
    swipeStartRef.current = null
    resetSwipe()
  }

  const currentTrackSubtitle = currentTrack
    ? currentPlaybackStatus === "preparing"
      ? "Preparing this track..."
      : currentPlaybackStatus === "error"
        ? currentPlaybackMessage || "Track unavailable"
        : currentTrack.artist
    : ""

  useEffect(() => {
    if (selectedAlbum || selectedArtist) return
    const pane = mainPaneRef.current
    if (!pane) return

    const prefetchThreshold = 1400
    let ticking = false

    const maybeLoadMore = () => {
      ticking = false
      if (!hasMoreSearch || searchLoading || searchLoadingMore) return
      const distanceFromBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight
      if (distanceFromBottom <= prefetchThreshold) {
        void loadMoreSearch()
      }
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(maybeLoadMore)
    }

    pane.addEventListener("scroll", onScroll, { passive: true })
    maybeLoadMore()

    return () => {
      pane.removeEventListener("scroll", onScroll)
    }
  }, [
    hasMoreSearch,
    loadMoreSearch,
    searchLoading,
    searchLoadingMore,
    searchResults.length,
    selectedAlbum,
    selectedArtist,
  ])

  return (
    <main id="main-site" className="music-main-shell">
      <div className="music-layout">
        <aside className="music-queue-sidebar">
          <QueuePanel
            queue={queue}
            activeQueueIndex={activeQueueIndex}
            currentTrack={currentTrack}
            onMove={moveQueueItem}
            onContextMenu={(event, index) => {
              event.preventDefault()
              setContextMenu({
                kind: "queue",
                x: event.clientX,
                y: event.clientY,
                index,
                canMoveUp: index > 0,
                canMoveDown: index < queue.length - 1,
              })
            }}
            onSelect={(index) => void setActiveQueueIndex(index)}
          />
        </aside>

        <section className="music-main-pane" ref={mainPaneRef}>
          {mobileSearchOpen ? (
            <section className="music-mobile-search-page" aria-labelledby="music-mobile-search-title">
              <div className="music-mobile-search-page__header">
                <div>
                  <p className="music-kicker">Find something to play</p>
                  <h1 id="music-mobile-search-title">Search</h1>
                </div>
                <button
                  type="button"
                  className="music-mobile-search-page__close"
                  aria-label="Close search"
                  onClick={() => setMobileSearchOpen(false)}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
              <form
                className="music-mobile-search-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  setMobileSearchOpen(false)
                  submitSearch()
                }}
              >
                <label htmlFor="music-mobile-search-input">Songs, albums, or artists</label>
                <div className="music-mobile-search-form__row">
                  <span className="music-mobile-search-form__input">
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                    <input
                      ref={mobileSearchInputRef}
                      id="music-mobile-search-input"
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="What do you want to hear?"
                    />
                  </span>
                  <button type="submit">Search</button>
                </div>
              </form>
            </section>
          ) : null}

          {selectedArtist ? (
            <section className="music-artist-view">
              <button
                type="button"
                className="music-back-button"
                onClick={() => {
                  clearSelectedArtist()
                  navigate("/musicpl")
                }}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Back to results
              </button>

              <div className="music-artist-hero">
                <img
                  src={selectedArtist.imageUrl}
                  alt={selectedArtist.name}
                  className="music-artist-image"
                />
                <div className="music-artist-copy">
                  <p className="music-kicker">Artist</p>
                  <h1 className="music-album-title">{selectedArtist.name}</h1>
                  <p className="music-results-subtitle">
                    {selectedArtist.albums.length} playable albums and {selectedArtist.songs.length} playable songs
                  </p>
                </div>
              </div>

              {artistLoading ? (
                <div className="music-state-card">Loading artist…</div>
              ) : artistError ? (
                <div className="music-state-card music-state-card--error">{artistError}</div>
              ) : (
                <div className="music-artist-sections">
                  <section>
                    <div className="music-section-heading">
                      <h2>Albums</h2>
                    </div>
                    {selectedArtist.albums.length ? (
                      <div className="music-results-grid">
                        {selectedArtist.albums.map((album) => (
                          <AlbumCard
                            key={album.id}
                            item={album}
                            onOpen={() => void selectAlbum(album.albumId)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="music-state-card">No playable albums yet.</div>
                    )}
                  </section>

                  <section>
                    <div className="music-section-heading">
                      <h2>Popular songs</h2>
                    </div>
                    {selectedArtist.songs.length ? (
                      <div className="music-results-grid">
                        {selectedArtist.songs.map((song) => (
                          <SongCard
                            key={song.id}
                            item={song}
                            onPlay={() => void playTrack(song.track, [song.track])}
                            onContextMenu={(event) => {
                              event.preventDefault()
                              setContextMenu({
                                kind: "track",
                                x: event.clientX,
                                y: event.clientY,
                                track: song.track,
                              })
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="music-state-card">No playable songs yet.</div>
                    )}
                  </section>
                </div>
              )}
            </section>
          ) : selectedAlbum ? (
            <section className="music-album-view">
              <button
                type="button"
                className="music-back-button"
                onClick={() => {
                  clearSelectedAlbum()
                  navigate("/musicpl")
                }}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Back to results
              </button>

              <div className="music-album-hero">
                <img
                  src={selectedAlbum.coverUrl}
                  alt={selectedAlbum.title}
                  className="music-album-cover"
                />
                <div className="music-album-copy">
                  <h1 className="music-album-title">{selectedAlbum.title}</h1>
                  <p className="music-album-artist">
                    {selectedAlbum.creator || "Unknown Artist"}
                  </p>
                  {selectedAlbum.year ? (
                    <p className="music-album-meta">{selectedAlbum.year}</p>
                  ) : null}
                  {selectedAlbum.description ? (
                    <p className="music-album-description">
                      {selectedAlbum.description}
                    </p>
                  ) : null}
                </div>
              </div>

              {albumLoading ? (
                <div className="music-state-card">Loading album…</div>
              ) : albumError ? (
                <div className="music-state-card music-state-card--error">
                  {albumError}
                </div>
              ) : (
                <div className="music-track-list">
                  {albumTracks.map((track, index) => {
                    const queueSeed = albumTracks.slice(index)
                    const isCurrent = currentTrack?.trackId === track.trackId
                    return (
                      <button
                        type="button"
                        key={track.trackId}
                        className={`music-track-row ${isCurrent ? "is-current" : ""}`}
                        onClick={() => void playTrack(track, queueSeed)}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          setContextMenu({
                            kind: "track",
                            x: event.clientX,
                            y: event.clientY,
                            track,
                          })
                        }}
                      >
                        <span className="music-track-number">{index + 1}</span>
                        <span className="music-track-copy">
                          <span className="music-track-title">{track.title}</span>
                          <span className="music-track-artist">{track.artist}</span>
                        </span>
                        <span className="music-track-action">
                          <FontAwesomeIcon
                            icon={isCurrent && isPlaying ? faPause : faPlay}
                          />
                          Play from here
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          ) : (
            <section className="music-results-view">
              <div className="music-results-header">
                <p className="music-results-subtitle music-results-count">
                  {searchQuery.trim()
                    ? `${numFound.toLocaleString()} results`
                    : "Search for songs, albums, or artists."}
                </p>
              </div>

              {showInitialSearchLoading ? (
                <div className="music-state-card music-state-card--loading">
                  <div className="music-loading-copy">
                    <strong>{searchLoadingLabel}</strong>
                    <span>{loadingState.detail}</span>
                    <div
                      className="music-loading-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={loadingState.progress}
                      aria-label={searchLoadingLabel}
                    >
                      <div
                        className="music-loading-progress__fill"
                        style={{ width: `${loadingState.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : searchError ? (
                <div className="music-state-card music-state-card--error">
                  {searchError}
                </div>
              ) : !searchQuery.trim() ? (
                <div className="music-empty-state">
                  <FontAwesomeIcon icon={faCompactDisc} />
                  <p>Your search results will show up here.</p>
                </div>
              ) : searchResults.length ? (
                <div className="music-results-grid">
                  {searchResults.map((item) => {
                    if (item.type === "song") {
                      return (
                        <SongCard
                          key={item.id}
                          item={item}
                          onPlay={() => void playTrack(item.track, [item.track])}
                          onContextMenu={(event) => {
                            event.preventDefault()
                            setContextMenu({
                              kind: "track",
                              x: event.clientX,
                              y: event.clientY,
                              track: item.track,
                            })
                          }}
                        />
                      )
                    }

                    if (item.type === "artist") {
                      return (
                        <ArtistCard
                          key={item.id}
                          item={item}
                          onOpen={() => {
                            void selectArtist(item.artistId)
                            navigate(`/musicpl/artist/${item.artistId}`)
                          }}
                        />
                      )
                    }

                    return (
                      <AlbumCard
                        key={item.id}
                        item={item}
                        onOpen={() => void selectAlbum(item.albumId)}
                      />
                    )
                  })}
                </div>
              ) : null}

              {searchResults.length ? (
                <div className="music-results-sentinel">
                  {searchLoading ? (
                    <span className="music-results-status">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      Still searching...
                    </span>
                  ) : searchLoadingMore ? (
                    "Loading more..."
                  ) : hasMoreSearch ? (
                    "Loading more soon..."
                  ) : (
                    "End of results"
                  )}
                </div>
              ) : (
                searchQuery.trim() && !searchLoading && !searchError && (
                  <div className="music-state-card">
                    No results yet. Try a broader search.
                  </div>
                )
              )}

              {searchQuery.trim() && !searchLoading && !searchLoadingMore && !searchError ? (
                <div className="music-search-help">
                  <p>Still can't find the song? Try searching for the album and artist.</p>
                  {!hasMoreSearch ? (
                    <button
                      type="button"
                      className="music-search-help__button"
                      onClick={() => lookHarderSearch()}
                    >
                      Look harder
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}
        </section>
      </div>

      <div
        className={`music-queue-drawer-overlay ${queueDrawerOpen ? "is-open" : ""}`}
        onClick={() => setQueueDrawerOpen(false)}
      />
      <aside className={`music-queue-drawer ${queueDrawerOpen ? "is-open" : ""}`}>
        <div className="music-queue-drawer-header">
          <h2>Queue</h2>
          <button type="button" onClick={() => setQueueDrawerOpen(false)}>
            Close
          </button>
        </div>
        <QueuePanel
          queue={queue}
          activeQueueIndex={activeQueueIndex}
          currentTrack={currentTrack}
          onMove={moveQueueItem}
          onContextMenu={(event, index) => {
            event.preventDefault()
            setContextMenu({
              kind: "queue",
              x: event.clientX,
              y: event.clientY,
              index,
              canMoveUp: index > 0,
              canMoveDown: index < queue.length - 1,
            })
          }}
          onSelect={(index) => void setActiveQueueIndex(index)}
        />
      </aside>

      {contextMenu ? (
        <div
          className="music-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.kind === "queue" ? (
            <>
              <button
                type="button"
                className="music-context-menu__item"
                disabled={!queue[contextMenu.index]?.albumId}
                onClick={() => {
                  void openAlbumForTrack(queue[contextMenu.index])
                  setContextMenu(null)
                }}
              >
                Go to album
              </button>
              <button
                type="button"
                className="music-context-menu__item"
                onClick={() => {
                  removeQueueItem(contextMenu.index)
                  setContextMenu(null)
                }}
              >
                Remove
              </button>
              <button
                type="button"
                className="music-context-menu__item"
                disabled={!contextMenu.canMoveUp}
                onClick={() => {
                  moveQueueItem(contextMenu.index, contextMenu.index - 1)
                  setContextMenu(null)
                }}
              >
                Move up
              </button>
              <button
                type="button"
                className="music-context-menu__item"
                disabled={!contextMenu.canMoveDown}
                onClick={() => {
                  moveQueueItem(contextMenu.index, contextMenu.index + 1)
                  setContextMenu(null)
                }}
              >
                Move down
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="music-context-menu__item"
                disabled={!contextMenu.track.albumId}
                onClick={() => {
                  void openAlbumForTrack(contextMenu.track)
                  setContextMenu(null)
                }}
              >
                Go to album
              </button>
              <button
                type="button"
                className="music-context-menu__item"
                onClick={() => {
                  addTrackToQueue(contextMenu.track)
                  setContextMenu(null)
                }}
              >
                Add to queue
              </button>
              <button
                type="button"
                className="music-context-menu__item"
                onClick={() => {
                  playTrackNext(contextMenu.track)
                  setContextMenu(null)
                }}
              >
                Play next
              </button>
              <button
                type="button"
                className="music-context-menu__item"
                title="Download the cached or freshly prepared audio file"
                onClick={() => {
                  void downloadFromPhi(contextMenu.track)
                  setContextMenu(null)
                }}
              >
                Download
              </button>
            </>
          )}
        </div>
      ) : null}

      <footer className="music-bottom-bar">
        <div
          className={`music-bottom-track ${swipeActive ? "is-swiping" : ""}`}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onTrackPointerMove}
          onPointerUp={onTrackPointerEnd}
          onPointerCancel={onTrackPointerCancel}
        >
          {currentTrack ? (
            <>
              {!coverTransition && previousQueueTrack ? (
                <BottomTrackTile
                  track={previousQueueTrack}
                  ariaHidden
                  className="music-bottom-track-tile--swipe-preview music-bottom-track-tile--swipe-previous"
                  style={swipeStyle(`calc(-100% + ${swipeOffset}px)`)}
                />
              ) : null}
              {!coverTransition && nextQueueTrack ? (
                <BottomTrackTile
                  track={nextQueueTrack}
                  ariaHidden
                  className="music-bottom-track-tile--swipe-preview music-bottom-track-tile--swipe-next"
                  style={swipeStyle(`calc(100% + ${swipeOffset}px)`)}
                />
              ) : null}
              {coverTransition ? (
                <>
                  <BottomTrackTile
                    track={coverTransition.previousTrack}
                    ariaHidden
                    className={`music-bottom-track-tile--previous music-bottom-track-tile--dir-${coverTransition.direction}`}
                  />
                  <BottomTrackTile
                    track={coverTransition.currentTrack}
                    subtitle={currentTrackSubtitle}
                    className={`music-bottom-track-tile--incoming music-bottom-track-tile--dir-${coverTransition.direction}`}
                  />
                </>
              ) : (
                <BottomTrackTile
                  track={currentTrack}
                  subtitle={currentTrackSubtitle}
                  className="music-bottom-track-tile--current"
                  style={swipeStyle(`${swipeOffset}px`)}
                />
              )}
            </>
          ) : (
            <div className="music-bottom-placeholder">Pick a track to start playing</div>
          )}
        </div>

        <div className="music-bottom-controls">
          <div className="music-control-buttons">
            <button
              type="button"
              className="music-icon-button"
              aria-label="Previous track"
              onClick={() => void playPrevious()}
              disabled={!queue.length}
            >
              <FontAwesomeIcon icon={faBackwardStep} />
            </button>
            <button
              type="button"
              className="music-icon-button music-icon-button--primary"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={() => void togglePlayPause()}
              disabled={!queue.length}
            >
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            </button>
            <button
              type="button"
              className="music-icon-button"
              aria-label="Next track"
              onClick={() => void playNext()}
              disabled={!queue.length}
            >
              <FontAwesomeIcon icon={faForwardStep} />
            </button>
            <button
              type="button"
              className="music-icon-button music-mobile-control"
              aria-label={mobileVolumeOpen ? "Close volume control" : "Open volume control"}
              aria-expanded={mobileVolumeOpen}
              onClick={() => setMobileVolumeOpen((open) => !open)}
            >
              <FontAwesomeIcon icon={volume <= 0.001 ? faVolumeXmark : faVolumeHigh} />
            </button>
            <button
              type="button"
              className="music-icon-button music-mobile-control"
              aria-label="Open queue"
              onClick={() => {
                setMobileVolumeOpen(false)
                setQueueDrawerOpen(true)
              }}
            >
              <FontAwesomeIcon icon={faBarsStaggered} />
            </button>
          </div>

          <div className="music-progress">
            <span>{formatTime(currentTime)}</span>
            <input
              className="music-progress-slider"
              type="range"
              min={0}
              max={duration || 0}
              value={Math.min(currentTime, duration || 0)}
              step={0.1}
              onChange={(event) => seek(Number(event.target.value))}
              disabled={!currentTrack}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="music-volume">
          <FontAwesomeIcon icon={volume <= 0.001 ? faVolumeXmark : faVolumeHigh} />
          <input
            className="music-volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>

        {mobileVolumeOpen ? (
          <div className="music-mobile-volume-panel">
            <div className="music-mobile-volume-panel__label">
              <span>Volume</span>
              <strong>{Math.round(volume * 100)}%</strong>
            </div>
            <input
              className="music-mobile-volume-slider"
              aria-label="Volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </div>
        ) : null}
      </footer>
    </main>
  )
}

function BottomTrackTile({
  track,
  subtitle = track.artist,
  className = "",
  style,
  ariaHidden = false,
}: {
  track: QueueTrack
  subtitle?: string
  className?: string
  style?: CSSProperties
  ariaHidden?: boolean
}) {
  return (
    <div
      className={`music-bottom-track-tile ${className}`}
      style={style}
      aria-hidden={ariaHidden || undefined}
    >
      <img
        src={track.coverUrl}
        alt={track.albumTitle}
        className="music-bottom-cover"
        draggable={false}
      />
      <div className="music-bottom-copy">
        <p className="music-bottom-title">{track.title}</p>
        <p className="music-bottom-artist">{subtitle}</p>
      </div>
    </div>
  )
}

function AlbumCard({
  item,
  onOpen,
}: {
  item: MusicAlbumResult
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className="music-result-card music-result-card--album"
      onClick={onOpen}
    >
      <img src={item.coverUrl} alt={item.title} className="music-result-cover" />
      <span className="music-result-title">{item.title}</span>
      <span className="music-result-artist">{item.artist}</span>
      <span className="music-result-meta">{item.trackCount} tracks</span>
    </button>
  )
}

function SongCard({
  item,
  onPlay,
  onContextMenu,
}: {
  item: MusicSongResult
  onPlay: () => void
  onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      className="music-result-card music-result-card--song"
      onClick={onPlay}
      onContextMenu={onContextMenu}
    >
      <div className="music-song-card-media">
        <img src={item.coverUrl} alt={item.title} className="music-result-cover" />
        <span className="music-song-card-play">
          <FontAwesomeIcon icon={faPlay} />
        </span>
      </div>
      <span className="music-result-title">{item.title}</span>
      <span className="music-result-artist">{item.artist}</span>
      {item.albumTitle ? <span className="music-result-meta">{item.albumTitle}</span> : null}
    </button>
  )
}

function ArtistCard({
  item,
  onOpen,
}: {
  item: MusicArtistResult
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className="music-result-card music-result-card--artist"
      onClick={onOpen}
    >
      <div className="music-artist-card-media">
        <img src={item.imageUrl} alt={item.name} className="music-artist-card-image" />
      </div>
      <span className="music-result-title">{item.name}</span>
      <span className="music-result-artist">Artist</span>
    </button>
  )
}

function QueuePanel({
  queue,
  activeQueueIndex,
  currentTrack,
  onMove,
  onContextMenu,
  onSelect,
}: {
  queue: ReturnType<typeof useMusicPlayer>["queue"]
  activeQueueIndex: number | null
  currentTrack: ReturnType<typeof useMusicPlayer>["currentTrack"]
  onMove: (from: number, to: number) => void
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>, index: number) => void
  onSelect: (index: number) => void
}) {
  const dragIndexRef = useRef<number | null>(null)

  if (!queue.length) {
    return (
      <div className="music-queue-empty">
        Queue an album by clicking a track in the main panel.
      </div>
    )
  }

  return (
    <div className="music-queue-panel">
      <div className="music-queue-heading">
        <h2>Queue</h2>
        <p>{queue.length} tracks lined up</p>
      </div>

      <div className="music-queue-list">
        {queue.map((track, index) => {
          const isCurrent = currentTrack?.trackId === track.trackId
          return (
            <div
              key={`${track.trackId}-${index}`}
              className={`music-queue-item ${isCurrent ? "is-current" : ""}`}
              draggable
              onContextMenu={(event) => onContextMenu(event, index)}
              onDragStart={() => {
                dragIndexRef.current = index
              }}
              onDragOver={(event) => {
                event.preventDefault()
              }}
              onDrop={() => {
                if (dragIndexRef.current === null) return
                onMove(dragIndexRef.current, index)
                dragIndexRef.current = null
              }}
              onDragEnd={() => {
                dragIndexRef.current = null
              }}
            >
              <button
                type="button"
                className="music-queue-item-main"
                onClick={() => onSelect(index)}
              >
                <span className="music-queue-item-copy">
                  <span className="music-queue-item-title">{track.title}</span>
                  <span className="music-queue-item-artist">{track.artist}</span>
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {activeQueueIndex !== null ? (
        <p className="music-queue-now-playing">
          Now playing {activeQueueIndex + 1} of {queue.length}
        </p>
      ) : null}
    </div>
  )
}
