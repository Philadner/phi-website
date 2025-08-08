import React, { useEffect, useRef, useState } from "react";
import "../stylesheets/home.css";

// --- your pool of phrases (add as many as you like) ---
const middlePhrases = [
  "welcome",
  "epic website",
  "we hate trump",
  "enjoy your summer",
  "chillest website ever ever",
  "we love south park",
  "do people actually read these?",
];

// Fisher–Yates shuffle
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build one cycle: phi + 3 random phrases
function buildCycle() {
  return ["phi", ...shuffle(middlePhrases).slice(0, 3)];
}

const Home: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef<HTMLDivElement>(null);

  // floating position (not React state to avoid re-renders)
  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  // typewriter
  const [phrases, setPhrases] = useState<string[]>(() => buildCycle());
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ---------- Floating + width-based auto-shrink ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const nx = (e.clientX - cx) / (rect.width / 2);
      const ny = (e.clientY - cy) / (rect.height / 2);

      const max = 45; // px drift
      target.current.x = Math.max(-1, Math.min(1, nx)) * max;
      target.current.y = Math.max(-1, Math.min(1, ny)) * max;
    };

    const animate = () => {
      // ease toward target
      const k = 0.08;
      pos.current.x += (target.current.x - pos.current.x) * k;
      pos.current.y += (target.current.y - pos.current.y) * k;

      // tilt and twist
      const tiltMax = 6; // X/Y tilt in degrees
      const twistMax = 2; // Z rotation in degrees
      const rx = (-pos.current.y / 45) * tiltMax;
      const ry = (pos.current.x / 45) * tiltMax;
      const rz = (pos.current.x / 45) * twistMax;

      // distance from center affects scale
      const max = 45; // px drift
      const distance = Math.sqrt(
        Math.pow(pos.current.x / max, 2) + Math.pow(pos.current.y / max, 2)
      );
      const baseScale = 1 + distance * 0.05;

      // width-based scaling so it never wraps
      const el = phiRef.current;
      if (el && containerRef.current) {
        const available = containerRef.current.offsetWidth * 0.9;
        const textWidth = Math.max(el.scrollWidth, 1);
        const scale = Math.min(1, available / textWidth) * baseScale;

        el.style.transform =
          `translate(-50%, -50%) translate3d(${pos.current.x}px, ${pos.current.y}px, 0)
           rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)
           scale(${scale})`;

        el.style.textShadow =
          `0 0 ${8 + Math.abs(pos.current.x) * 0.1 + Math.abs(pos.current.y) * 0.1}px rgba(255,221,51,.45)`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    container.addEventListener("mousemove", onMove);
    rafId.current = requestAnimationFrame(animate);

    window.addEventListener("resize", () => {});

    return () => {
      container.removeEventListener("mousemove", onMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // ---------- Typewriter loop + letter pop ----------
  useEffect(() => {
    const current = phrases[phraseIndex];
    if (!current) return;

    const typingSpeed = deleting ? 50 : 80;
    const pauseTime = current === "phi" ? 2500 : 1200;

    const timer = setTimeout(() => {
      if (!deleting && text.length < current.length) {
        // typing forward
        setText(current.slice(0, text.length + 1));

        // add pop effect
        if (phiRef.current) {
          phiRef.current.classList.add("pop");
          setTimeout(() => {
            phiRef.current?.classList.remove("pop");
          }, 80);
        }
      } else if (!deleting && text.length === current.length) {
        setTimeout(() => setDeleting(true), pauseTime);
      } else if (deleting && text.length > 0) {
        setText(current.slice(0, text.length - 1));
      } else if (deleting && text.length === 0) {
        setDeleting(false);
        if (phraseIndex + 1 >= phrases.length) {
          setPhrases(buildCycle());
          setPhraseIndex(0);
        } else {
          setPhraseIndex(phraseIndex + 1);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [text, deleting, phraseIndex, phrases]);

  return (
    <div ref={containerRef} className="home-stage">
      <div ref={phiRef} className="phi-floating">{text}</div>
    </div>
  );
};

export default Home;
