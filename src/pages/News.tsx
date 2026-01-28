import { useEffect, useMemo, useState } from "react";

type NewsArticle = {
  id?: string;
  title: string;
  content: string;
  author?: string;
  createdAt: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function News() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!title.trim() || !content.trim()) return false;
    if (title.trim().length > 120) return false;
    if (content.trim().length > 10_000) return false;
    if (author.trim().length > 60) return false;
    return true;
  }, [author, content, submitting, title]);

  const apiUrl = useMemo(() => {
    return (
      (import.meta.env.VITE_NEWS_API_URL as string | undefined) ??
      "https://api.phi.me.uk/kv/news"
    );
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(apiUrl, { method: "GET" });
      const json = (await r.json()) as unknown;

      if (!r.ok) {
        const msg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error?: unknown }).error ?? "Failed to load news")
            : "Failed to load news";
        setError(msg);
        setArticles([]);
        return;
      }

      const list = Array.isArray(json) ? (json as NewsArticle[]) : [];
      setArticles(list);
    } catch (e: unknown) {
      setError(String(e));
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMsg(null);
    setError(null);
    setSubmitting(true);

    try {
      const r = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          author: author.trim() ? author.trim() : undefined,
        }),
      });

      const json = (await r.json()) as unknown;
      if (!r.ok) {
        const msg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error?: unknown }).error ?? "Failed to post")
            : "Failed to post";
        setSubmitMsg(msg);
        return;
      }

      setTitle("");
      setContent("");
      setAuthor("");
      setSubmitMsg("Posted.");
      await load();
    } catch (err: unknown) {
      setSubmitMsg(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main-site">
      <h1 className="CenterTitle">News</h1>

      <div className="SpaceDiv" />

      <form
        onSubmit={onSubmit}
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: 16,
          border: "1px solid gold",
          borderRadius: 16,
        }}
      >
        <h2 className="HeadingLeft" style={{ marginTop: 0 }}>
          Add an article
        </h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            style={{
              flex: "1 1 280px",
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(255,215,0,0.6)",
              background: "rgba(0,0,0,0.5)",
              color: "gold",
              outline: "none",
            }}
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author (optional)"
            style={{
              flex: "1 1 200px",
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(255,215,0,0.6)",
              background: "rgba(0,0,0,0.5)",
              color: "gold",
              outline: "none",
            }}
          />
        </div>

        <div style={{ height: 10 }} />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your news..."
          rows={6}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(255,215,0,0.6)",
            background: "rgba(0,0,0,0.5)",
            color: "gold",
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid gold",
              background: canSubmit ? "gold" : "rgba(255,215,0,0.2)",
              color: canSubmit ? "black" : "rgba(255,215,0,0.8)",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontWeight: 800,
            }}
          >
            {submitting ? "Posting..." : "Post"}
          </button>

          {submitMsg ? <span style={{ color: "gold" }}>{submitMsg}</span> : null}
        </div>

        <p style={{ margin: "10px 0 0", color: "rgba(255,215,0,0.8)", fontSize: 13 }}>
          Rate limit: 1 post / 5 seconds (and a 60s timeout if you spam 3 posts in 30s).
        </p>
      </form>

      <div className="SpaceDiv" />

      {error ? (
        <p className="BodyTextLeft" style={{ color: "gold" }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="BodyTextLeft" style={{ color: "gold" }}>
          Loading...
        </p>
      ) : null}

      {!loading &&
        articles
          .slice()
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map((a, i) => (
            <article key={a.id ?? `${a.createdAt}-${i}`}>
              <h2 className="HeadingLeft">{a.title}</h2>
              <p className="BodyTextLeft">
                {formatDate(a.createdAt)}
                {a.author ? ` — ${a.author}` : ""}
              </p>
              <div className="SpaceDiv" />
              {a.content.split("\n").map((line, idx) =>
                line.trim() ? (
                  <p key={idx} className="BodyTextLeft">
                    {line}
                  </p>
                ) : (
                  <div key={idx} className="SpaceDiv" />
                )
              )}
              <div className="SpaceDiv" />
            </article>
          ))}
    </main>
  );
}

export default News;
