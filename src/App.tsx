import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

import Home from './pages/Home';
import About from './pages/About';
import QuickLinks from './pages/QuickLinks';
import Games from './pages/Games';
import Floop from './pages/Floop';
import Append from './pages/append';
import Changelog from './pages/Changelog';
import Sex from './pages/jacobpage';
import Stats from './pages/stats';
import MusicPLRouter from './pages/MusicPLRouter';
import AboutMusicPL from './pages/AboutMusicPlayer';
import Wpadmin from './pages/wp-admin';
import News from './pages/News';
import JayGame from './pages/JayGame';
import Toggle1998 from './pages/Toggle1998';
import Presentation from './pages/Presentation';
import Remote from './pages/Remote';
import DylanTightness from './pages/DylanTightness';
import PhilTightness from './pages/PhilTightness';
const ChangelogCommits = React.lazy(() => import('./pages/ChangelogCommits'));
import use1998Mode from './hooks/use1998Mode';
import { set1998ModeEnabled } from './hooks/use1998Mode';
import { MusicPlayerProvider, useMusicPlayer } from './components/MusicPlayerContext';
import { PhiMark } from './components/PhiMark';
import './App.css';

function ModernLoader() {
  return (
    <div id="loader">
      <svg className="phi" viewBox="-10 -10 104 116" width="120" height="auto">
        <path d="M47.4691 94.8742V67.8693L47.9534 67.8537C52.3122 67.7166 56.6259 66.839 60.8958 65.2189V65.2199C64.8929 63.6903 68.4645 61.5771 71.6146 58.882L72.2396 58.3351L72.2454 58.3302C75.575 55.4373 78.2558 51.7818 80.2845 47.3546V47.3537C82.3061 42.928 83.3226 37.9032 83.3226 32.2697C83.3226 26.9517 82.5356 22.4635 80.9818 18.7882L80.6615 18.0636L80.6605 18.0627C79.0043 14.4679 76.8897 11.4427 74.3197 8.97964L73.7991 8.49429L73.7943 8.48941C71.3117 6.17323 68.5439 4.39348 65.4896 3.14664L64.8743 2.90445L64.8724 2.90347C61.5635 1.6319 58.291 0.999176 55.0521 0.999176C53.2704 0.999176 51.3345 1.22294 49.2425 1.67398L48.3363 1.88101L48.3333 1.88199L47.8841 1.99234C45.8085 2.52369 44.0577 3.2689 42.6224 4.22086L42.3197 4.42886H42.3187C40.5189 5.69142 39.0689 7.28919 37.9661 9.22574H37.9652C36.8915 11.1217 36.3441 13.4147 36.3441 16.1242V63.8459L35.8304 63.8322C29.1364 63.6535 23.7544 61.0487 19.7269 56.0246L19.3411 55.5314V55.5304C15.2859 50.1848 13.2816 43.2011 13.2816 34.6242C13.2816 26.5123 14.5431 20.091 17.1136 15.4044C19.6172 10.8398 23.2947 7.648 28.1283 5.84195L27.3236 1.50894C18.4518 3.72283 11.836 7.6445 7.42415 13.2462H7.42317C2.93466 18.9632 0.677078 26.0783 0.677078 34.6242C0.677079 44.2236 3.85313 52.0186 10.1888 58.0539C16.5273 64.0918 25.0701 67.3717 35.8665 67.8537L36.3441 67.8752V94.8742H47.4691ZM47.4691 13.1447C47.4691 10.8408 48.1377 8.9429 49.5091 7.50113L49.7923 7.2189C51.3473 5.75275 53.2424 5.01976 55.4476 5.01968C59.9233 5.01968 63.5868 7.49382 66.4398 12.2628L66.4388 12.2638C69.3084 17.0377 70.7191 23.5482 70.7191 31.7492C70.7191 40.5992 68.9526 47.9197 65.3841 53.6779L65.0335 54.2306C61.218 60.0959 55.5202 63.2933 48.0042 63.8312L47.4691 63.8693V13.1447Z"/>
      </svg>
    </div>
  );
}

function RetroLoader() {
  const text = "phi";
  const [typedChars, setTypedChars] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTypedChars((n) => (n < text.length ? n + 1 : n));
    }, 140);
    return () => window.clearInterval(timer);
  }, [text.length]);

  return (
    <div
      id="loader"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#c0c0c0",
      }}
    >
      <div
        style={{
          textAlign: "center",
          width: "min(520px, 80vw)",
          background: "#d4d0c8",
          borderTop: "2px solid #ffffff",
          borderLeft: "2px solid #ffffff",
          borderRight: "2px solid #404040",
          borderBottom: "2px solid #404040",
          padding: "22px 20px 16px",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#000000",
            fontFamily: "'Press Start 2P', 'VT323', 'Lucida Console', 'Courier New', monospace",
            fontSize: "clamp(28px, 6vw, 52px)",
            letterSpacing: "0.14em",
            textTransform: "lowercase",
            lineHeight: 1.1,
            textShadow: "1px 1px 0 #ffffff",
            imageRendering: "pixelated",
            minHeight: "1.4em",
          }}
        >
          {text.slice(0, typedChars)}
          <span
            className="retro-loader-anim"
            style={{
              display: "inline-block",
              width: "0.6ch",
              marginLeft: "0.06em",
              opacity: typedChars >= text.length ? 1 : 0.85,
              animation: "phi-retro-cursor 0.65s steps(1, end) infinite",
            }}
          >
            _
          </span>
        </p>

        <div
          aria-hidden="true"
          style={{
            marginTop: "1.1rem",
            height: "20px",
            borderTop: "2px solid #404040",
            borderLeft: "2px solid #404040",
            borderRight: "2px solid #ffffff",
            borderBottom: "2px solid #ffffff",
            background: "#808080",
            overflow: "hidden",
          }}
        >
          <div
            className="retro-loader-anim"
            style={{
              height: "100%",
              width: "100%",
              background:
                "repeating-linear-gradient(90deg, #ff0040 0 14px, #ff8a00 14px 28px, #ffe100 28px 42px, #28d428 42px 56px, #00b7ff 56px 70px, #3d4dff 70px 84px, #a23cff 84px 98px)",
              backgroundSize: "280px 100%",
              animation: "phi-retro-rainbow 0.85s linear infinite",
            }}
          />
        </div>

      </div>

      <style>{`
        @keyframes phi-retro-rainbow {
          from { background-position: 0 0; }
          to { background-position: 280px 0; }
        }
        @keyframes phi-retro-cursor {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
function AppShell() {
  const [loaded, setLoaded] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [mode1998] = use1998Mode();
  const location = useLocation();
  const isMusicMode = location.pathname.startsWith("/musicpl");
  const isPresentationDemo = location.pathname === "/presentation" || location.pathname === "/remote";
  const wasMusicModeRef = useRef(isMusicMode);
  const headerRef = useRef<HTMLElement | null>(null);
  const modeToggleText = mode1998 ? "TAKE ME BACK" : "TURN ON NEW DESIGN";
  const {
    searchQuery,
    setSearchQuery,
    submitSearch,
    resetSession,
    goToMusicHome,
    setMobileSearchOpen,
  } = useMusicPlayer();
  const toggleModeWithRefresh = () => {
    const next = !mode1998;
    set1998ModeEnabled(next);
    window.location.reload();
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('body--lock', sideOpen);
    return () => document.body.classList.remove('body--lock');
  }, [sideOpen]);

  useEffect(() => {
    document.body.classList.toggle('body--music-lock', isMusicMode);
    return () => document.body.classList.remove('body--music-lock');
  }, [isMusicMode]);

  useEffect(() => {
    if (wasMusicModeRef.current && !isMusicMode) {
      resetSession();
    }
    wasMusicModeRef.current = isMusicMode;
  }, [isMusicMode, resetSession]);
  
    // --- Collapsing titlebar logic (0–50px) ---
useEffect(() => {
  const el = headerRef.current;
  if (!el) return;

  if (isMusicMode) {
    el.style.setProperty('--p', '0');
    el.style.setProperty('--squish', '0');
    el.style.setProperty('--fade', '0');
    el.classList.add('is-revealed');
    return () => {
      el.classList.remove('is-revealed');
    };
  }

  let raf = 0;
  const hovering = { current: false };
  const lastYRef = { current: window.scrollY || 0 };
  const revealUntilRef = { current: 0 }; // timestamp (ms) we remain revealed until

  const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));

  const applyVars = (y: number) => {
    const now = performance.now();
    const revealing = hovering.current || now < revealUntilRef.current;

    // collapse progress
    const p = revealing ? 0 : clamp(y / 50);           // 0->1 over 0..50px
    const squish = revealing ? 0 : clamp(y / 30);       // 0->1 over 0..30px
    const fade = revealing ? 0 : clamp((y - 40) / 10);  // 0->1 over 40..50px

    el.style.setProperty('--p', String(p));
    el.style.setProperty('--squish', String(squish));
    el.style.setProperty('--fade', String(fade));

    // explicit class for CSS overrides
    if (revealing) el.classList.add('is-revealed');
    else el.classList.remove('is-revealed');
  };

  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const y = window.scrollY || 0;
      const lastY = lastYRef.current;
      const delta = y - lastY;

      // If user scrolls UP more than ~6px, reveal for 800ms
      if (delta < -6) {
        revealUntilRef.current = performance.now() + 800;
      }
      // If user scrolls DOWN > ~3px, cancel reveal immediately
      if (delta > 3) {
        revealUntilRef.current = 0;
      }

      lastYRef.current = y;
      applyVars(y);
    });
  };

  // hover handlers keep it open while hovered
  const onEnter = () => { hovering.current = true; applyVars(window.scrollY || 0); };
  const onLeave = () => { hovering.current = false; applyVars(window.scrollY || 0); };

  el.addEventListener('mouseenter', onEnter);
  el.addEventListener('mouseleave', onLeave);
  window.addEventListener('scroll', onScroll, { passive: true });

  // kick once
  applyVars(window.scrollY || 0);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    el.removeEventListener('mouseenter', onEnter);
    el.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('scroll', onScroll);
  };
}, [isMusicMode]);

  
  const navigate = useNavigate();
  
  return (
    <div className={loaded ? 'loaded page' : 'page'}>
      {!loaded && (mode1998 ? <RetroLoader /> : <ModernLoader />)}

      {!isPresentationDemo && <header ref={headerRef} className={`site-header ${isMusicMode ? "site-header--music" : ""}`}>
        <div className="site-header__inner">
          {isMusicMode ? (
            <div className="music-brand titlebar-content">
              <Link to="/" className="music-brand__back" aria-label="Back to website">
                <FontAwesomeIcon icon={faArrowLeft} />
              </Link>
              <Link
                to="/musicpl"
                className="logo"
                onClick={() => {
                  goToMusicHome();
                  setSideOpen(false);
                }}
              >
                <span className="music-brand__wordmark">phi(music)</span>
                <PhiMark className="music-brand__mark" />
              </Link>
            </div>
          ) : (
            <Link to="/" className="logo titlebar-content">phi(l)</Link>
          )}

          {isMusicMode ? (
            <>
              <form
                className="music-header-search titlebar-content"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitSearch();
                }}
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} className="music-header-search__icon" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search songs, albums, or artists..."
                  aria-label="Search music"
                />
                <button type="submit">Search</button>
              </form>
              <button
                type="button"
                className="music-header-search-trigger titlebar-content"
                aria-label="Open music search"
                onClick={() => setMobileSearchOpen(true)}
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </button>
            </>
          ) : (
            <nav className="topnav titlebar-content">
              <Link to="/musicpl">Music</Link>
              <Link to="/quickl">Quick links</Link>
              <Link to="/add">➕</Link>
            </nav>
          )}

          <div className="header-actions titlebar-content">
            <button
              className="menu-btn"
              onClick={() => setSideOpen(true)}
              aria-label="Open menu"
              type="button"
            >
              ☰
            </button>
          </div>
        </div>
      </header>}
      {!isPresentationDemo && <div className="header-spacer" />}


      {/* Sidebar */}
      <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span>Site Menu</span>
          <button onClick={() => setSideOpen(false)} className="close-btn">×</button>
        </div>

        <nav className="sidebar-nav">
          <button
            className="mode-1998-btn sidebar-mode-btn"
            type="button"
            aria-pressed={mode1998}
            onClick={() => {
              toggleModeWithRefresh();
              setSideOpen(false);
            }}
            title="Toggle 1998 mode"
          >
            {modeToggleText}
          </button>

          {/* always visible in sidebar */}
          <Link to="/" onClick={() => setSideOpen(false)}>Home</Link>
          <Link to="/about" onClick={() => setSideOpen(false)}>About</Link>
          <Link to="/changelog" onClick={() => setSideOpen(false)}>Changelog</Link>
          <Link to="/realchangelog" onClick={() => setSideOpen(false)}>Real Changelog</Link>
          <Link to="/quickl" onClick={() => setSideOpen(false)}>Quick Links</Link>
          <Link to="/news" onClick={() => setSideOpen(false)}>News</Link>
          <Link to="/dylan" onClick={() => setSideOpen(false)}>Dylan Tightness</Link>
          <Link to="/phil-tightness" onClick={() => setSideOpen(false)}>Phil Tightness</Link>
          <div
            className="gameshow-banner"
            role="button"
            tabIndex={0}
            onClick={() => {
              setSideOpen(false);
              navigate("/jay");
              }
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setSideOpen(false);
                navigate("/jay");
              }
            }}
          >
            <span className="gameshow-text">Jay Game</span>
            <span className="gameshow-divider">Play in browser</span>
          </div>

          {/* <Link
            to="/workinhardorhardlyworkin"
            onClick={() => setSideOpen(false)}
            className="sidebar-note"
          >
            is phil lazy
          </Link> */}
          
          

          {/* only visible on mobile test change */}
          <div className="sidebar-mobile-only">
            <Link to="/musicpl" onClick={() => setSideOpen(false)}>Music</Link>
            <Link to="/games" onClick={() => setSideOpen(false)}>Games</Link>
            <Link to="/quickl" onClick={() => setSideOpen(false)}>Quick Links</Link>
            <Link to="/add" onClick={() => setSideOpen(false)}>Add</Link>
          </div>
        </nav>
      </aside>

      <div
        className={`overlay ${sideOpen ? 'show' : ''}`}
        onClick={() => setSideOpen(false)}
      />

      {loaded && (
        <>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/1998" element={<Toggle1998 />} />
            <Route path="/1998/:rest" element={<Navigate to="/" replace />} />
            <Route path="/1998/:rest/*" element={<Navigate to="/" replace />} />
            <Route path="/about" element={<About />} />
            <Route path="/quickl" element={<QuickLinks />} />
            <Route path="/games" element={<Games />} />
            <Route path="/floop" element={<Floop />} />
            <Route path="/add" element={<Append />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/jacob" element={<Sex />} />
            <Route path="/realchangelog" element={<ChangelogCommits />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/workinhardorhardlyworkin" element={<Stats />} />
            <Route path="/wp-admin" element={<Wpadmin />} />
            <Route path="/news" element={<News />} />
            <Route path="/jay" element={<JayGame />} />
            <Route path="/presentation" element={<Presentation />} />
            <Route path="/remote" element={<Remote />} />
            <Route path="/dylan" element={<DylanTightness />} />
            <Route path="/dylan-tightness" element={<DylanTightness />} />
            <Route path="/phil" element={<PhilTightness />} />
            <Route path="/phil-tightness" element={<PhilTightness />} />
            <Route path="/musicpl/*" element={<MusicPLRouter />} />
            <Route path="/about-musicpl" element={<AboutMusicPL />} />

          </Routes>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <MusicPlayerProvider>
      <AppShell />
    </MusicPlayerProvider>
  );
}
