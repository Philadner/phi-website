import { useMemo, useState } from "react";

const DEFAULT_PLAY_URL = "https://cdn.phi.me.uk/JayGame/JayGame.html";
const DEFAULT_WINDOWS_URL = "https://cdn.phi.me.uk/jayfiles/windows/JayGame.zip";
const DEFAULT_ANDROID_URL = "https://cdn.phi.me.uk/jayfiles/android/JayGame.apk";
const REVIEWS_STORAGE_KEY = "jay-game-reviews-v1";

type Review = {
  id: string;
  name: string;
  rating: number;
  text: string;
  createdAt: string;
};

const starterReviews: Review[] = [
  {
    id: "starter-1",
    name: "phi",
    rating: 5,
    text: "The browser build runs smooth and the download options are super handy.",
    createdAt: "2026-02-20T18:30:00.000Z",
  },
  {
    id: "starter-2",
    name: "jay fan",
    rating: 4,
    text: "Fun little game loop. Looking forward to more levels.",
    createdAt: "2026-02-18T12:00:00.000Z",
  },
];

function loadReviews(): Review[] {
  if (typeof window === "undefined") return starterReviews;

  try {
    const raw = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) return starterReviews;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return starterReviews;

    const valid = parsed.filter((item) => {
      if (!item || typeof item !== "object") return false;
      return (
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.text === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.rating === "number"
      );
    }) as Review[];

    return valid.length ? valid : starterReviews;
  } catch {
    return starterReviews;
  }
}

function saveReviews(reviews: Review[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
}

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function JayGame() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(() => loadReviews());
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  const playUrl = (import.meta.env.VITE_JAYGAME_PLAY_URL as string | undefined) ?? DEFAULT_PLAY_URL;
  const windowsUrl =
    (import.meta.env.VITE_JAYGAME_WINDOWS_URL as string | undefined) ?? DEFAULT_WINDOWS_URL;
  const androidUrl =
    (import.meta.env.VITE_JAYGAME_ANDROID_URL as string | undefined) ?? DEFAULT_ANDROID_URL;

  const buttonStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid gold",
    background: "gold",
    color: "black",
    cursor: "pointer",
    fontWeight: 800,
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  const secondaryStyle: React.CSSProperties = {
    ...buttonStyle,
    background: "transparent",
    color: "gold",
  };

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return total / reviews.length;
  }, [reviews]);

  const handleSubmitReview = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedText = text.trim();

    if (!trimmedName || !trimmedText) return;

    const nextReview: Review = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmedName,
      rating,
      text: trimmedText,
      createdAt: new Date().toISOString(),
    };

    const updated = [nextReview, ...reviews].slice(0, 50);
    setReviews(updated);
    saveReviews(updated);
    setName("");
    setRating(5);
    setText("");
  };

  const stars = (value: number) => "★".repeat(value) + "☆".repeat(5 - value);

  return (
    <main
      id="main-site"
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          style={isPlaying ? secondaryStyle : buttonStyle}
          aria-pressed={isPlaying}
        >
          Play in browser
        </button>

        <a href={windowsUrl} style={secondaryStyle} rel="noopener noreferrer">
          Download (Windows)
        </a>

        <a href={androidUrl} style={secondaryStyle} rel="noopener noreferrer">
          Download (Android)
        </a>
      </div>

      <section
        style={{
          border: "1px solid rgba(255,215,0,0.3)",
          borderRadius: 12,
          padding: 16,
          background: "rgba(255, 215, 0, 0.05)",
        }}
      >
        <h2 style={{ margin: 0, color: "gold", fontSize: "1.15rem" }}>Reviews</h2>
        <p style={{ margin: "8px 0 12px", color: "rgba(255,255,255,0.85)" }}>
          {reviews.length} review{reviews.length === 1 ? "" : "s"} · {averageRating.toFixed(1)} / 5
        </p>

        <form onSubmit={handleSubmitReview} style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            required
            style={{
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,215,0,0.4)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "white",
            }}
          />

          <label style={{ color: "rgba(255,255,255,0.9)", fontSize: ".95rem", display: "grid", gap: 6 }}>
            Rating
            <select
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,215,0,0.4)",
                borderRadius: 8,
                padding: "10px 12px",
                color: "white",
              }}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} star{value === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>

          <textarea
            placeholder="Write a quick review"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
            required
            rows={3}
            style={{
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,215,0,0.4)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "white",
              resize: "vertical",
            }}
          />

          <button type="submit" style={{ ...buttonStyle, width: "fit-content" }}>
            Submit review
          </button>
        </form>

        <div style={{ display: "grid", gap: 10 }}>
          {reviews.map((review) => (
            <article
              key={review.id}
              style={{
                border: "1px solid rgba(255,215,0,0.2)",
                borderRadius: 10,
                padding: "10px 12px",
                background: "rgba(0,0,0,0.25)",
              }}
            >
              <p style={{ margin: 0, color: "gold", fontWeight: 700 }}>
                {review.name} · {stars(review.rating)}
              </p>
              <p style={{ margin: "6px 0", color: "rgba(255,255,255,0.9)" }}>{review.text}</p>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: ".85rem" }}>
                {formatDate(review.createdAt)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {isPlaying ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <iframe
            src={playUrl}
            style={{ width: "100%", height: "100%", border: "1px solid rgba(255,215,0,0.35)" }}
            title="Jay Game"
            allow="fullscreen; autoplay; gamepad"
          />
        </div>
      ) : null}
    </main>
  );
}
