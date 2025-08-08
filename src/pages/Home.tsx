import React, { useEffect, useRef, useState } from "react";
import "../stylesheets/home.css";

const middlePhrases = [
  "welcome",
  "epic website",
  "webdev is hell",
  "i love the summer holidays",
  "chillest site ever ever",
];

const shuffleArray = <T,>(array: T[]) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const Home: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef<HTMLDivElement>(null);

  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  const [text, setText] = useState("");
  const [phrases, setPhrases] = useState<string[]>([]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShrinking, setIsShrinking] = useState(false);

  // Start cycle with phi, then shuffle the middle phrases
  useEffect(() => {
    setPhrases(["phi", ...shuffleArray(middlePhrases)]);
  }, []);

  // Floating animation
  useEffect(() => {
    const container = containerRef.current!;
    const handleMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const nx = (e.clientX - cx) / (rect.width / 2);
      const ny = (e.clientY - cy) / (rect.height / 2);

      const maxOffset = 45;
      target.current.x = Math.max(-1, Math.min(1, nx)) * maxOffset;
      target.current.y = Math.max(-1, Math.min(1, ny)) * maxOffset;
    };

    const animate = () => {
      const ease = 0.08;
      pos.current.x += (target.current.x - pos.current.x) * ease;
      pos.current.y += (target.current.y - pos.current.y) * ease;

      const tiltMax = 6;
      const rx = (-pos.current.y / 45) * tiltMax;
      const ry = (pos.current.x / 45) * tiltMax;

      if (phiRef.current) {
        phiRef.current.style.transform =
          `translate(-50%, -50%) translate3d(${pos.current.x}px, ${pos.current.y}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) scale(${isShrinking ? 0.5 : 1})`;
        phiRef.current.style.opacity = isShrinking ? "0" : "1";
        phiRef.current.style.textShadow =
          `0 0 ${8 + Math.abs(pos.current.x) * 0.1 + Math.abs(pos.current.y) * 0.1}px rgba(255, 221, 51, .45)`;
      }
      rafId.current = requestAnimationFrame(animate);
    };

    container.addEventListener("mousemove", handleMove);
    rafId.current = requestAnimationFrame(animate);

    return () => {
      container.removeEventListener("mousemove", handleMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isShrinking]);

  // Typewriter with shrink transition
  useEffect(() => {
    if (phrases.length === 0) return;
    const currentPhrase = phrases[phraseIndex];
    const typingSpeed = isDeleting ? 50 : 100;
    const pauseTime = 1500;

    const timeout = setTimeout(() => {
      if (!isDeleting && text.length < currentPhrase.length) {
        setText(currentPhrase.slice(0, text.length + 1));
      } else if (isDeleting && text.length > 0) {
        setText(currentPhrase.slice(0, text.length - 1));
      } else if (!isDeleting && text.length === currentPhrase.length) {
        setTimeout(() => setIsDeleting(true), pauseTime);
      } else if (isDeleting && text.length === 0) {
        setIsShrinking(true);
        setTimeout(() => {
          setIsShrinking(false);
          setIsDeleting(false);

          if (phraseIndex + 1 >= phrases.length) {
            // Restart with phi at start again, reshuffled middle
            setPhrases(["phi", ...shuffleArray(middlePhrases)]);
            setPhraseIndex(0);
          } else {
            setPhraseIndex(phraseIndex + 1);
          }
        }, 300);
      }
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [text, isDeleting, phraseIndex, phrases]);

  return (
    <div ref={containerRef} className="home-stage">
      <div ref={phiRef} className="phi-floating">{text}</div>
    </div>
  );
};

export default Home;
