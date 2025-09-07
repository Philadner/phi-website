// MusicPLRouter.tsx
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import useScrollLock from "../hooks/useScrollLock"; // <- fix the typo
import ArchiveMusicSearch from "./MusicPlayer";
import AlbumDetail from "./AlbumDetail";

function CurrentMusicRoutes({ location }: { location: any }) {
  return (
    <Routes location={location}>
      <Route path="/musicpl" element={<ArchiveMusicSearch />} />
      <Route path="/musicpl/:id" element={<AlbumDetail />} />
    </Routes>
  );
}


export default function MusicPLRouter() {
  const location = useLocation() as any;

  const backgroundLocation = location.state?.backgroundLocation;
  const isOverlay =
    /^\/musicpl\/[^/]+$/.test(location.pathname) && !!backgroundLocation;

  const isMusicPair =
    location.pathname === "/musicpl" || /^\/musicpl\/[^/]+$/.test(location.pathname);

  const savedY: number = isOverlay ? (location.state?.savedScrollY ?? 0) : 0;
  const savedH: number | undefined = isOverlay ? location.state?.savedDocH : undefined;

  useEffect(() => {
  document.body.classList.toggle("overlay-open", isOverlay);
  return () => document.body.classList.remove("overlay-open");
}, [isOverlay]);

  // Lock body only when overlay is open
  useScrollLock(isOverlay);

  if (!isMusicPair) {
    return <CurrentMusicRoutes location={location} />;
  }

return (
  <div style={{ position: "relative", minHeight: "100%", overflow: "visible" }}>
    <AnimatePresence mode="wait" initial={false}>
      {isOverlay ? (
        // ---------- OVERLAY BRANCH ----------
        <motion.div key="overlay-branch" style={{ position: "relative", zIndex: 0 }}>
          {/* Background (blurred) */}
          <motion.div
            key={(backgroundLocation?.pathname || "/musicpl") + "-bg"}
            style={{
              position: "fixed",
              top: 0, right: 0, bottom: 0, left: 0,
              zIndex: 0,
              willChange: "filter, transform, opacity",
              pointerEvents: "none",
            }}
            initial={{ filter: "blur(0px)", scale: 1, opacity: 1 }}
            animate={{ filter: "blur(16px)", scale: 0.985, opacity: 0.75 }}
            exit={{ filter: "blur(0px)", scale: 1, opacity: 1 }}
            transition={{ duration: 0.36, ease: [0.22, 0.61, 0.36, 1] }}
            aria-hidden="true"
          >
            <div
              style={{
                position: "relative",
                height: savedH ? `${savedH}px` : "100vh",
                transform: `translateY(${-savedY}px)`,
              }}
            >
              <CurrentMusicRoutes location={backgroundLocation} />
            </div>
          </motion.div>

          {/* Top (detail) — fixed container (static), animate inner shell */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1,
              perspective: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4vh 0",
              overflowY: "auto",
              pointerEvents: "none",
            }}
          >
            <motion.div
              key={location.pathname + "-panel"}
              style={{
                width: "100%",
                maxWidth: 960,
                display: "flex",
                justifyContent: "center",
                pointerEvents: "auto",
              }}
              initial={{ y: "-18vh", opacity: 0, rotateX: 6 }}
              animate={{ y: 0, opacity: 1, rotateX: 0, transition: { type: "spring", stiffness: 520, damping: 42, mass: 0.8 } }}
              exit={{ opacity: 0, y: "-10vh", transition: { duration: 0.22 } }}
            >
              <CurrentMusicRoutes location={location} />
            </motion.div>
          </div>
        </motion.div>
      ) : (
        // ---------- LIST BRANCH ----------
        <motion.div key="list-branch" style={{ position: "relative", zIndex: 1 }}>
          <CurrentMusicRoutes location={location} />
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
}
