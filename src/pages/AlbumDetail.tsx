import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
  return file.name
    .replace(/\.[^/.]+$/, "") // strip extension
    .replace(/[_-]+/g, " ")   // underscores/dashes → spaces
    .trim();
}

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [metadata, setMetadata] = useState<any>(null);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await fetch(`https://archive.org/metadata/${id}`);
        const data = await res.json();
        setMetadata(data.metadata);
        const audioFiles = (data.files || []).filter(isAudioFile);
        setFiles(audioFiles);
      } catch (e) {
        console.error("Error fetching album detail:", e);
      }
    }
    fetchMeta();
  }, [id]);

  return (
    <div className="AlbumPage">
      {/* Back link */}
      <Link to="/musicpl" className="BackLink">
        ← Back to search
      </Link>
  
      {/* Album header */}
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
  
      {/* Tracklist */}
      <div className="Tracklist">
        {files.map((f, i) => {
          const url = `https://archive.org/download/${id}/${encodeURIComponent(
            f.name
          )}`;
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
    </div>
  );
}