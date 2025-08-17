import React, { useEffect, useRef, useState } from "react";
import "../stylesheets/home.css";

const Home: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef<HTMLDivElement>(null);

  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const popScale = useRef(1);

  // ---- NEW: load phrases from your API
  const [middlePhrases, setMiddlePhrases] = useState<string[]>([]);

  useEffect(() => {
    fetch("https://api.phi.me.uk/kv/phrases")
      .then((r) => r.json())
      .then((data) => {
        // API returns an array (e.g. ["a","b",...]); fallback if someone wraps it
        const arr = Array.isArray(data) ? data : (data?.phrases ?? []);
        setMiddlePhrases(arr.filter((x: unknown): x is string => typeof x === "string"));
      })
      .catch((err) => console.error("Failed to load phrases:", err));
  }, []);

  const shuffle = <T,>(arr: T[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const buildCycle = () => ["phi", ...shuffle(middlePhrases).slice(0, 3)];

  // ---- driving text state
  const [phrases, setPhrases] = useState<string[]>([]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // when middlePhrases loads/changes, (re)seed the cycle
  useEffect(() => {
    if (middlePhrases.length) {
      setPhrases(buildCycle());
      setPhraseIndex(0);
      setText("");
      setDeleting(false);
    }
  }, [middlePhrases]);

  // Mouse movement animation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const nx = (e.clientX - cx) / (rect.width / 2);
      const ny = (e.clientY - cy) / (rect.height / 2);

      const maxDrift = 45;
      target.current.x = Math.max(-1, Math.min(1, nx)) * maxDrift;
      target.current.y = Math.max(-1, Math.min(1, ny)) * maxDrift;
    };

    const animate = () => {
      const k = 0.08;
      pos.current.x += (target.current.x - pos.current.x) * k;
      pos.current.y += (target.current.y - pos.current.y) * k;

      const tiltMax = 6;
      const twistMax = 2;
      const rx = (-pos.current.y / 45) * tiltMax;
      const ry = (pos.current.x / 45) * tiltMax;
      const rz = (pos.current.x / 45) * twistMax;

      const maxDrift = 45;
      const distance = Math.sqrt(
        Math.pow(pos.current.x / maxDrift, 2) + Math.pow(pos.current.y / maxDrift, 2)
      );
      const baseScale = 1 + distance * 0.05;

      popScale.current += (1 - popScale.current) * 0.2;

      const el = phiRef.current;
      if (el && containerRef.current) {
        const available = containerRef.current.offsetWidth * 0.9;
        const textWidth = Math.max(el.scrollWidth, 1);
        const scale = Math.min(1, available / textWidth) * baseScale * popScale.current;

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

    return () => {
      container.removeEventListener("mousemove", onMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // Typing effect with acceleration + pop effect
  useEffect(() => {
    const current = phrases[phraseIndex];
    if (!current) return;

    const baseSpeed = deleting ? 50 : 80;
    const accelFactor = 0.85;
    const typingSpeed = Math.max(20, baseSpeed * Math.pow(accelFactor, text.length));
    const pauseTime = current === "phi" ? 2500 : 1200;

    const timer = setTimeout(() => {
      if (!deleting && text.length < current.length) {
        setText(current.slice(0, text.length + 1));
        popScale.current = 1.15;
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
      <div ref={phiRef} className="phi-floating">
        {text || "…"}
      </div>
    </div>
  );
};

export default Home;
