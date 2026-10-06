import { useState } from "react";

const DEFAULT_PLAY_URL = "https://cdn.phi.me.uk/JayGame/JayGame.html";
const DEFAULT_WINDOWS_URL = "https://cdn.phi.me.uk/jayfiles/windows/JayGame.zip";
const DEFAULT_ANDROID_URL = "https://cdn.phi.me.uk/jayfiles/android/JayGame.apk";
export default function JayGame() {
  const [isPlaying, setIsPlaying] = useState(false);

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
