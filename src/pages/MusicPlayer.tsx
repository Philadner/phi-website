import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
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
  faVolumeHigh,
  faVolumeXmark,
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

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const remainder = whole % 60
  return `${minutes}:${String(remainder).padStart(2, "0")}`
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
    submitSearch,
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
  } = useMusicPlayer()
  const mainPaneRef = useRef<HTMLElement | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const showInitialSearchLoading = searchLoading && searchResults.length === 0

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
          <div className="music-mobile-toolbar">
            <button
              type="button"
              className="music-mobile-queue-toggle"
              onClick={() => setQueueDrawerOpen(true)}
            >
              <FontAwesomeIcon icon={faBarsStaggered} />
              Queue
            </button>
            {searchQuery.trim() ? (
              <button
                type="button"
                className="music-mobile-search-button"
                onClick={() => submitSearch()}
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} />
                Search now
              </button>
            ) : null}
          </div>

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
                            onOpen={() => void selectAlbum(album.archiveId)}
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
                    const isCurrent = currentTrack?.sourceUrl === track.sourceUrl
                    return (
                      <button
                        type="button"
                        key={track.sourceUrl}
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
                <div>
                  <h1 className="music-results-title">Search Music</h1>
                  <p className="music-results-subtitle">
                    {searchQuery.trim()
                      ? `Found ${numFound.toLocaleString()} results for "${searchQuery.trim()}"`
                      : "Start typing in the header to search for songs, albums, or artists."}
                  </p>
                </div>
              </div>

              {showInitialSearchLoading ? (
                <div className="music-state-card music-state-card--loading">
                  <div className="music-loading-copy">
                    <strong>{searchLoadingLabel}</strong>
                    <span>
                      Archive fallback stays hidden until the YouTube song pass finishes.
                    </span>
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
                        onOpen={() => void selectAlbum(item.archiveId)}
                      />
                    )
                  })}
                </div>
              ) : null}

              {searchResults.length ? (
                <div className="music-results-sentinel">
                  {searchLoadingMore ? "Loading more..." : hasMoreSearch ? "Loading more soon..." : "End of results"}
                </div>
              ) : (
                searchQuery.trim() && !searchLoading && (
                  <div className="music-state-card">
                    No results yet. Try a broader search.
                  </div>
                )
              )}
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
            </>
          )}
        </div>
      ) : null}

      <footer className="music-bottom-bar">
        <div className="music-bottom-track">
          {currentTrack ? (
            <>
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.albumTitle}
                className="music-bottom-cover"
              />
              <div className="music-bottom-copy">
                <p className="music-bottom-title">{currentTrack.title}</p>
                <p className="music-bottom-artist">{currentTrack.artist}</p>
              </div>
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
              onClick={() => void playPrevious()}
              disabled={!queue.length}
            >
              <FontAwesomeIcon icon={faBackwardStep} />
            </button>
            <button
              type="button"
              className="music-icon-button music-icon-button--primary"
              onClick={() => void togglePlayPause()}
              disabled={!queue.length}
            >
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            </button>
            <button
              type="button"
              className="music-icon-button"
              onClick={() => void playNext()}
              disabled={!queue.length}
            >
              <FontAwesomeIcon icon={faForwardStep} />
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
      </footer>
    </main>
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
      {item.matchedTrackCount ? (
        <span className="music-result-meta">{item.matchedTrackCount} matching tracks</span>
      ) : null}
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
          const isCurrent = currentTrack?.sourceUrl === track.sourceUrl
          return (
            <div
              key={`${track.sourceUrl}-${index}`}
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
