import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../stylesheets/MusicPlayer.css";

// --- Types ---
interface ArchiveItem {
  identifier: string;
  title: string;
  creator?: string;
  downloads?: number;
  publicdate?: string;
}

interface FileEntry {
  name: string;
  format?: string;
  size?: number;
}

// --- Helpers ---
const PAGE_SIZE = 20;

function buildQuery(q: string) {
  const terms = q.trim();
  const encoded = encodeURIComponent(terms);
  return `https://archive.org/advancedsearch.php?q=(title:(\"${encoded}\")+OR+creator:(\"${encoded}\"))+AND+mediatype:(audio)&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=downloads&fl[]=publicdate&sort[]=downloads+desc&rows=${PAGE_SIZE}&page=`;
}

function serviceThumb(id: string) {
  return `https://archive.org/services/img/${id}`;
}

//function detailsUrl(id: string) {
//  return `https://archive.org/details/${id}`;
//}

//function downloadUrl(id: string, filename: string) {
//  return `https://archive.org/download/${id}/${encodeURIComponent(filename)}`;
//}

//function extToMime(name: string, fallback?: string) {
//  const lower = name.toLowerCase();
//  if (lower.endsWith(".mp3")) return "audio/mpeg";
//  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
//  if (lower.endsWith(".flac")) return "audio/flac";
//  if (lower.endsWith(".wav")) return "audio/wav";
//  if (lower.endsWith(".aiff") || lower.endsWith(".aif")) return "audio/aiff";
//  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
//  return fallback || "audio/mpeg";
//}

function isAudioFile(f: FileEntry) {
  const fmt = (f.format || "").toLowerCase();
  if (fmt.includes("audio")) return true;
  const name = f.name.toLowerCase();
  return [".mp3", ".ogg", ".oga", ".flac", ".wav", ".aif", ".aiff", ".m4a"].some((ext) =>
    name.endsWith(ext)
  );
}

// concurrency limiter
async function pMap<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const ret: R[] = [];
  let i = 0;
  const workers: Promise<void>[] = [];
  async function work() {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await mapper(items[idx], idx);
    }
  }
  for (let k = 0; k < Math.max(1, Math.min(limit, items.length)); k++) workers.push(work());
  await Promise.all(workers);
  return ret;
}

// --- Component ---
export default function ArchiveMusicSearch() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ArchiveItem[]>([]);
  const [numFound, setNumFound] = useState(0);

  const [fileMap, setFileMap] = useState<
    Record<string, FileEntry[] | "loading" | "error" | undefined>
  >({});

  const controllerRef = useRef<AbortController | null>(null);

  const canPrev = page > 1;
  const canNext = page * PAGE_SIZE < numFound;

  const search = useCallback(
    async (resetPage = false) => {
      if (resetPage) setPage(1);
      const searchPage = resetPage ? 1 : page;
      setLoading(true);
      setError(null);
      controllerRef.current?.abort();
      const ac = new AbortController();
      controllerRef.current = ac;
      try {
        const url = buildQuery(query) + String(searchPage) + "&output=json";
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const data = await res.json();
        const docs: ArchiveItem[] = data?.response?.docs || [];
        setResults(docs);
        setNumFound(data?.response?.numFound || 0);
      } catch (e: any) {
        if (e.name !== "AbortError") setError(e?.message || "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [page, query]
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setNumFound(0);
      return;
    }
    search(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const onSubmit = useCallback(() => {
    if (!query.trim()) return;
    search(true);
  }, [query, search]);

  //const fetchFiles = useCallback(
  //  async (id: string) => {
  //    if (fileMap[id] === "loading") return;
  //    setFileMap((m) => ({ ...m, [id]: "loading" }));
  //    try {
  //      const metaRes = await fetch(`https://archive.org/metadata/${id}`);
  //      if (!metaRes.ok) throw new Error(`Metadata failed: ${metaRes.status}`);
  //      const meta = await metaRes.json();
  //      const files: FileEntry[] = (meta?.files || []).filter(isAudioFile);
  //      setFileMap((m) => ({ ...m, [id]: files }));
  //    } catch (e) {
  //      setFileMap((m) => ({ ...m, [id]: "error" }));
  //    }
  //  },
  //  [fileMap]
  //);

  const prefetchAll = useCallback(async () => {
    const ids = results.map((r) => r.identifier).filter((id) => !fileMap[id]);
    await pMap(ids, 4, async (id) => {
      try {
        const res = await fetch(`https://archive.org/metadata/${id}`);
        const meta = await res.json();
        const files: FileEntry[] = (meta?.files || []).filter(isAudioFile);
        setFileMap((m) => ({ ...m, [id]: files }));
      } catch {
        setFileMap((m) => ({ ...m, [id]: "error" }));
      }
    });
  }, [results, fileMap]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(numFound / PAGE_SIZE)), [numFound]);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="SpaceDiv"></div>
      <h1 className="CenterTitle">Archive.org Music Search</h1>

      {/* Search bar */}
      <div className="search-container">
        <input
          className="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search music on Archive.org..."
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
        />
        <button className="search-button" onClick={onSubmit}>
          Search
        </button>
      </div>

      {/* Info + controls */}
      {query && (
        <div className="flex items-center justify-between mb-2 text-sm">
          <div>
            {loading ? "Searching…" : error ? (
              <span className="text-red-600">{error}</span>
            ) : (
              <>
                Found {numFound.toLocaleString()} results • Page {page} / {totalPages}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={!canNext}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
            <button
              disabled={!results.length}
              onClick={prefetchAll}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prefetch files
            </button>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="results-grid">
        {results.map((item) => (
          <div key={item.identifier} className="result-card">
            <Link to={`/musicpl/${item.identifier}`}>
              <img
                src={serviceThumb(item.identifier)}
                alt={item.title}
                className="result-cover"
              />
              <div className="result-title">{item.title}</div>
              <div className="result-artist">{item.creator || "Unknown Artist"}</div>
            </Link>
          </div>
        ))}
      </div>

      {!loading && !results.length && query && !error && (
        <div className="opacity-70 text-sm mt-4">
          No results. Try a broader search or different keywords.
        </div>
      )}
    </div>
  );
}
