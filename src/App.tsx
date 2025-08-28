import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';

import Home from './pages/Home';
import About from './pages/About';
import QuickLinks from './pages/QuickLinks';
import Games from './pages/Games';
import MusicPlayer from './pages/MusicPlayer';
import Chatroom from './pages/Chatroom';
import Floop from './pages/Floop';
import Append from './pages/append';
import Changelog from './pages/Changelog';
import AlbumDetail from './pages/AlbumDetail';
import Sex from './pages/jacobpage';
import './App.css';

function Loader() {
  return (
    <div id="loader">
      <svg className="phi" viewBox="-10 -10 104 116" width="120" height="auto">
        <path d="M47.4691 94.8742V67.8693L47.9534 67.8537C52.3122 67.7166 56.6259 66.839 60.8958 65.2189V65.2199C64.8929 63.6903 68.4645 61.5771 71.6146 58.882L72.2396 58.3351L72.2454 58.3302C75.575 55.4373 78.2558 51.7818 80.2845 47.3546V47.3537C82.3061 42.928 83.3226 37.9032 83.3226 32.2697C83.3226 26.9517 82.5356 22.4635 80.9818 18.7882L80.6615 18.0636L80.6605 18.0627C79.0043 14.4679 76.8897 11.4427 74.3197 8.97964L73.7991 8.49429L73.7943 8.48941C71.3117 6.17323 68.5439 4.39348 65.4896 3.14664L64.8743 2.90445L64.8724 2.90347C61.5635 1.6319 58.291 0.999176 55.0521 0.999176C53.2704 0.999176 51.3345 1.22294 49.2425 1.67398L48.3363 1.88101L48.3333 1.88199L47.8841 1.99234C45.8085 2.52369 44.0577 3.2689 42.6224 4.22086L42.3197 4.42886H42.3187C40.5189 5.69142 39.0689 7.28919 37.9661 9.22574H37.9652C36.8915 11.1217 36.3441 13.4147 36.3441 16.1242V63.8459L35.8304 63.8322C29.1364 63.6535 23.7544 61.0487 19.7269 56.0246L19.3411 55.5314V55.5304C15.2859 50.1848 13.2816 43.2011 13.2816 34.6242C13.2816 26.5123 14.5431 20.091 17.1136 15.4044C19.6172 10.8398 23.2947 7.648 28.1283 5.84195L27.3236 1.50894C18.4518 3.72283 11.836 7.6445 7.42415 13.2462H7.42317C2.93466 18.9632 0.677078 26.0783 0.677078 34.6242C0.677079 44.2236 3.85313 52.0186 10.1888 58.0539C16.5273 64.0918 25.0701 67.3717 35.8665 67.8537L36.3441 67.8752V94.8742H47.4691ZM47.4691 13.1447C47.4691 10.8408 48.1377 8.9429 49.5091 7.50113L49.7923 7.2189C51.3473 5.75275 53.2424 5.01976 55.4476 5.01968C59.9233 5.01968 63.5868 7.49382 66.4398 12.2628L66.4388 12.2638C69.3084 17.0377 70.7191 23.5482 70.7191 31.7492C70.7191 40.5992 68.9526 47.9197 65.3841 53.6779L65.0335 54.2306C61.218 60.0959 55.5202 63.2933 48.0042 63.8312L47.4691 63.8693V13.1447Z"/>
      </svg>
    </div>
  );
}

function App() {
  const [loaded, setLoaded] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('body--lock', sideOpen);
    return () => document.body.classList.remove('body--lock');
  }, [sideOpen]);

  
  return (
    <div className={loaded ? 'loaded page' : 'page'}>
      {!loaded && <Loader />}

      <header className="site-header">
        <Link to="/" className="logo">phi(l)</Link>

        <nav className="topnav">
          <Link to="/musicpl">Music Player</Link>
          <Link to="/quickl">Quick links</Link>
          <Link to="/chatroom">Chatroom</Link>
          <Link to="/add">Add</Link>
        </nav>

        {/* sits at the far right, no overlap */}
        <button className="menu-btn" onClick={() => setSideOpen(true)} aria-label="Open menu">☰</button>
      </header>


      {/* Sidebar */}
      <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span>Site Menu</span>
          <button onClick={() => setSideOpen(false)} className="close-btn">×</button>
        </div>

        <nav className="sidebar-nav">
          {/* always visible in sidebar */}
          <Link to="/" onClick={() => setSideOpen(false)}>Home</Link>
          <Link to="/about" onClick={() => setSideOpen(false)}>About</Link>
          <Link to="/changelog" onClick={() => setSideOpen(false)}>Changelog</Link>
          <Link to="/quickl" onClick={() => setSideOpen(false)}>Quick Links</Link>
          
          

          {/* only visible on mobile */}
          <div className="sidebar-mobile-only">
            <Link to="/musicpl" onClick={() => setSideOpen(false)}>Music Player</Link>
            <Link to="/games" onClick={() => setSideOpen(false)}>Games</Link>
            <Link to="/quickl" onClick={() => setSideOpen(false)}>Quick Links</Link>
            <Link to="/chatroom" onClick={() => setSideOpen(false)}>Chatroom</Link>
            <Link to="/add" onClick={() => setSideOpen(false)}>Add</Link>
          </div>
        </nav>
      </aside>

      <div
        className={`overlay ${sideOpen ? 'show' : ''}`}
        onClick={() => setSideOpen(false)}
      />

      {loaded && (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/quickl" element={<QuickLinks />} />
          <Route path="/games" element={<Games />} />
          <Route path="/musicpl" element={<MusicPlayer />} />
          <Route path="/chatroom" element={<Chatroom />} />
          <Route path="/floop" element={<Floop />} />
          <Route path="/yt" element={<Navigate to="https://www.youtube.com/@phil82." replace />} />
          <Route path="/add" element={<Append />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/musicpl/:id" element={<AlbumDetail />} />
          <Route path="/jacob" element={<Sex />} />
        </Routes>
      )}
    </div>
  );
}

export default App;
