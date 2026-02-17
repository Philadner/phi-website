import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "../stylesheets/AlbumDetail.css";

interface FileEntry {
  name: string;
  format?: string;
  size?: number;
  title?: string;
}

interface PlaybackState {
  currentTime: number;
  duration: number;
}

function isAudioFile(f: FileEntry) {
  const fmt = (f.format || "").toLowerCase();
  if (fmt.includes("audio")) return true;
  const name = f.name.toLowerCase();
  return [".mp3", ".ogg", ".oga", ".flac", ".wav", ".aif", ".aiff", ".m4a"].some(ext => name.endsWith(ext));
}

function getTrackName(file: FileEntry): string {
  if (file.title) return file.title;
  return file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// tiny inline spinner
function Spinner() {
  return (
    <div style={{ display: "inline-block", width: 22, height: 22 }}>
      <svg viewBox="0 0 50 50" style={{ width: "100%", height: "100%" }}>
        <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.2" />
        <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="5"
          strokeDasharray="90 150" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite"/>
        </circle>
      </svg>
    </div>
  );
}

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const panelRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [playbackMap, setPlaybackMap] = useState<Record<number, PlaybackState>>({});
  const [downloadingMap, setDownloadingMap] = useState<Record<number, boolean>>({});

  // Close logic (Esc + button) that returns to exact list URL + scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    const bg = location.state?.backgroundLocation;
    const savedScrollY = location.state?.savedScrollY ?? 0;
    if (bg) {
      navigate(
        { pathname: bg.pathname, search: bg.search, hash: bg.hash },
        { replace: true, state: { restoreScroll: savedScrollY } }
      );
    } else {
      navigate(-1);
    }
  };

  // Focus the panel for a11y
  useEffect(() => { panelRef.current?.focus(); }, []);

  useEffect(() => {
    audioRefs.current = [];
    setCurrentIndex(null);
    setIsPlaying(false);
    setPlaybackMap({});
    setDownloadingMap({});
  }, [id]);

  useEffect(() => {
    const update = () => setIsMobile(window.matchMedia("(max-width: 760px)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    return () => {
      audioRefs.current.forEach((audio) => audio?.pause());
    };
  }, []);

  const pauseOthers = useCallback((keepIndex: number) => {
    audioRefs.current.forEach((audio, i) => {
      if (i !== keepIndex && audio && !audio.paused) {
        audio.pause();
      }
    });
  }, []);

  const playTrack = useCallback(async (index: number) => {
    const audio = audioRefs.current[index];
    if (!audio) return;
    pauseOthers(index);
    try {
      await audio.play();
      setCurrentIndex(index);
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [pauseOthers]);

  const toggleTrack = useCallback(async (index: number) => {
    const audio = audioRefs.current[index];
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    await playTrack(index);
  }, [playTrack]);

  const playNext = useCallback(async () => {
    if (!files.length) return;
    const nextIndex = currentIndex === null ? 0 : (currentIndex + 1) % files.length;
    await playTrack(nextIndex);
  }, [currentIndex, files.length, playTrack]);

  const playPrev = useCallback(async () => {
    if (!files.length) return;
    const prevIndex = currentIndex === null
      ? 0
      : (currentIndex - 1 + files.length) % files.length;
    await playTrack(prevIndex);
  }, [currentIndex, files.length, playTrack]);

  const toggleCurrent = useCallback(async () => {
    if (!files.length) return;
    const index = currentIndex ?? 0;
    await toggleTrack(index);
  }, [currentIndex, files.length, toggleTrack]);

  const setPlaybackState = useCallback((index: number, patch: Partial<PlaybackState>) => {
    setPlaybackMap((prev) => ({
      ...prev,
      [index]: {
        currentTime: prev[index]?.currentTime ?? 0,
        duration: prev[index]?.duration ?? 0,
        ...patch,
      },
    }));
  }, []);

  const downloadTrack = useCallback(async (url: string, filename: string, index: number) => {
    if (downloadingMap[index]) return;
    setDownloadingMap((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingMap((prev) => ({ ...prev, [index]: false }));
    }
  }, [downloadingMap]);

  useEffect(() => {
    let aborted = false;
    async function fetchMeta() {
      if (!id) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`https://archive.org/metadata/${id}`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        if (aborted) return;

        setMetadata(data.metadata);
        const audioFiles = (data.files || []).filter(isAudioFile);
        setFiles(audioFiles);
      } catch (e: any) {
        if (!aborted) setLoadError(e?.message || "Failed to load");
      } finally {
        if (!aborted) setIsLoading(false);
      }
    }
    fetchMeta();
    return () => { aborted = true; };
  }, [id]);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role={isMobile ? undefined : "dialog"}
      aria-modal={isMobile ? undefined : true}
      className="AlbumPage"
      style={{
        outline: "none",
        width: isMobile ? "100%" : "min(960px, calc(100vw - 1.5rem))",
        margin: isMobile ? "0 auto" : "2vh auto",
        borderRadius: isMobile ? 0 : 16,
        border: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)",
        background: isMobile ? "transparent" : "rgba(20,20,20,0.9)",
        backdropFilter: isMobile ? "none" : "saturate(120%) blur(6px)",
        padding: isMobile ? 16 : 24,
        zIndex: 10,

        // NEW: allow the panel itself to scroll
        maxHeight: isMobile ? "none" : "88vh",
        overflowY: isMobile ? "visible" : "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
      }}
    >

      <button
        onClick={handleClose}
        className="BackLink"
        aria-label="Close"
        style={{ float: "right", marginBottom: "1rem" }}
      >
        ✕
      </button>

      {/* Loading state */}
      {isLoading && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Spinner />
            <span>Loading album…</span>
          </div>

          {/* Skeleton header */}
          <div className="AlbumHeader">
            <div
              style={{
                width: 240, height: 240, borderRadius: 12,
                background: "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%)",
                backgroundSize: "400% 100%", animation: "shimmer 1.2s linear infinite"
              }}
            />
            <div style={{ marginTop: 16 }}>
              <div style={{ height: 20, width: 220, marginBottom: 8, background: "rgba(255,255,255,0.1)", borderRadius: 6 }} />
              <div style={{ height: 16, width: 140, background: "rgba(255,255,255,0.08)", borderRadius: 6 }} />
            </div>
          </div>

          {/* Skeleton tracks */}
          <div className="Tracklist" style={{ marginTop: 20 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="TrackRow" style={{ alignItems: "center" }}>
                <div className="TrackInfo" style={{ gap: 10 }}>
                  <div style={{ height: 14, width: 18, background: "rgba(255,255,255,0.08)", borderRadius: 4 }} />
                  <div style={{ height: 14, width: 240, background: "rgba(255,255,255,0.1)", borderRadius: 4 }} />
                </div>
                <div style={{ height: 28, width: 180, background: "rgba(255,255,255,0.06)", borderRadius: 6 }} />
              </div>
            ))}
          </div>

          {/* keyframes for shimmer (scoped) */}
          <style>
            {`@keyframes shimmer { 
                0% { background-position: 200% 0; } 
                100% { background-position: -200% 0; } 
              }`}
          </style>
        </div>
      )}

      {/* Error state */}
      {loadError && !isLoading && (
        <div className="opacity-80" style={{ marginTop: 16 }}>
          Failed to load album. {loadError}
        </div>
      )}

      {/* Content */}
      {!isLoading && !loadError && (
        <>
          {metadata && (
            <div className="AlbumHeader">
              <p className="AlbumTitle">{metadata.title}</p>
              <img
                src={`https://archive.org/services/img/${id}`}
                alt={metadata.title}
                className="AlbumCover"
              />
              {metadata.creator && (
                <p className="AlbumArtist">{metadata.creator}</p>
              )}
            </div>
          )}

          <div className="TransportBar" role="group" aria-label="Album playback controls">
            <button className="TransportButton" onClick={() => void playPrev()} disabled={!files.length}>
              Prev
            </button>
            <button className="TransportButton TransportButtonPrimary" onClick={() => void toggleCurrent()} disabled={!files.length}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button className="TransportButton" onClick={() => void playNext()} disabled={!files.length}>
              Next
            </button>
            <p className="NowPlaying" title={currentIndex !== null ? getTrackName(files[currentIndex]) : "Nothing playing"}>
              {currentIndex !== null ? `Now playing: ${getTrackName(files[currentIndex])}` : "Now playing: nothing yet"}
            </p>
          </div>

          <div className="Tracklist">
            {files.map((f, i) => {
              const url = `https://archive.org/download/${id}/${encodeURIComponent(f.name)}`;
              const active = currentIndex === i && isPlaying;
              return (
                <div key={i} className="TrackRow">
                  <div className="TrackInfo">
                    <button
                      type="button"
                      className="TrackPlayButton"
                      onClick={() => void toggleTrack(i)}
                      aria-label={`${active ? "Pause" : "Play"} ${getTrackName(f)}`}
                    >
                      {active ? "Pause" : "Play"}
                    </button>
                    <span className="TrackIndex">{i + 1}.</span>
                    <span className="TrackName">{getTrackName(f)}</span>
                  </div>
                  <div className="TrackControls">
                    <input
                      className="TrackProgress"
                      type="range"
                      min={0}
                      max={playbackMap[i]?.duration || 0}
                      step={0.1}
                      value={playbackMap[i]?.currentTime || 0}
                      onChange={(e) => {
                        const audio = audioRefs.current[i];
                        if (!audio) return;
                        const next = Number(e.target.value);
                        audio.currentTime = next;
                        setPlaybackState(i, { currentTime: next });
                      }}
                      aria-label={`Seek ${getTrackName(f)}`}
                    />
                    <span className="TrackTime">
                      {formatTime(playbackMap[i]?.currentTime || 0)} / {formatTime(playbackMap[i]?.duration || 0)}
                    </span>
                    <button
                      type="button"
                      className="TrackDownload"
                      onClick={() => void downloadTrack(url, f.name, i)}
                      disabled={!!downloadingMap[i]}
                    >
                      {downloadingMap[i] ? "Downloading..." : "Download"}
                    </button>
                  </div>
                  <audio
                    preload="none"
                    className="TrackAudioHidden"
                    ref={(el) => {
                      audioRefs.current[i] = el;
                    }}
                    onPlay={() => {
                      pauseOthers(i);
                      setCurrentIndex(i);
                      setIsPlaying(true);
                    }}
                    onPause={() => {
                      if (currentIndex === i) {
                        setIsPlaying(false);
                      }
                    }}
                    onTimeUpdate={(e) => {
                      const target = e.currentTarget;
                      setPlaybackState(i, {
                        currentTime: target.currentTime,
                        duration: target.duration || 0,
                      });
                    }}
                    onLoadedMetadata={(e) => {
                      const target = e.currentTarget;
                      setPlaybackState(i, {
                        duration: target.duration || 0,
                      });
                    }}
                    onEnded={() => {
                      if (i === currentIndex) {
                        setPlaybackState(i, { currentTime: 0 });
                        void playNext();
                      }
                    }}
                  >
                    <source src={url} type="audio/mpeg" />
                  </audio>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
