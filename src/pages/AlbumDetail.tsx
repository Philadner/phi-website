import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "../stylesheets/AlbumDetail.css";

interface FileEntry {
  name: string;
  format?: string;
  size?: number;
  title?: string;
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

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      role="dialog"
      aria-modal="true"
      className="AlbumPage"
      style={{
        outline: "none",
        width: "min(960px, 96vw)",
        margin: "6vh auto",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(20,20,20,0.9)",
        backdropFilter: "saturate(120%) blur(6px)",
        padding: 24,
        zIndex: 10,

        // NEW: allow the panel itself to scroll
        maxHeight: "88vh",
        overflowY: "auto",
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

          <div className="Tracklist">
            {files.map((f, i) => {
              const url = `https://archive.org/download/${id}/${encodeURIComponent(f.name)}`;
              return (
                <div key={i} className="TrackRow">
                  <div className="TrackInfo">
                    <span className="TrackIndex">{i + 1}.</span>
                    <span className="TrackName">{getTrackName(f)}</span>
                  </div>
                  <audio controls preload="none" className="TrackAudio">
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
