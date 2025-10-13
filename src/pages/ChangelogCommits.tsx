import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "../stylesheets/Changelog.css";

type Commit = {
  sha: string;
  title: string;
  body: string;
  url: string;
  author: string;
  date: string;
};

export default function ChangelogCommits() {
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/commits?sha=labs&per_page=50");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Commit[];
        setCommits(data);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  return (
    <main id="main-site">
      <h1 className="CenterTitle">The Changelogz</h1>
      <p className="BodyTextCentre">Live from the <strong>labs</strong> branch commits</p>
      <div className="SpaceDiv" />

      {error && <p className="BodyTextCentre">Error: {error}</p>}
      {!commits && !error && <p className="BodyTextCentre">Loading…</p>}

      {commits?.map((c) => (
        <section key={c.sha}>
          <h2 className="HeadingBigLeft">{c.title}</h2>

          {c.body && (
            <div className="BodyTextCentre">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {c.body}
              </ReactMarkdown>
            </div>
          )}

          <p className="BodyTextCentre">
            <small>
              {c.author} — {formatUK(c.date)} —{" "}
              <a href={c.url} target="_blank" rel="noreferrer">View on GitHub</a>
            </small>
          </p>

          <div className="BigSpaceDiv" />
        </section>
      ))}
    </main>
  );
}

function formatUK(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    });
  } catch {
    return iso;
  }
}
