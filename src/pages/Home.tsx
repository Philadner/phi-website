import React, { useEffect, useRef } from "react";
import "../stylesheets/home.css";

const Home: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef<HTMLDivElement>(null);

  // animation state (not React state => no re-renders)
  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const handleMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // normalised -1..1 from centre
      const nx = (e.clientX - cx) / (rect.width / 2);
      const ny = (e.clientY - cy) / (rect.height / 2);

      // clamp and set target offset (px)
      const maxOffset = 45; // adjust vibe here
      target.current.x = Math.max(-1, Math.min(1, nx)) * maxOffset;
      target.current.y = Math.max(-1, Math.min(1, ny)) * maxOffset;
    };

    const animate = () => {
      // ease toward target
      const ease = 0.08; // smaller = slower, floatier
      pos.current.x += (target.current.x - pos.current.x) * ease;
      pos.current.y += (target.current.y - pos.current.y) * ease;

      // a tiny tilt for CRT-ish depth
      const tiltMax = 6; // degrees
      const rx = (-pos.current.y / 45) * tiltMax;
      const ry = ( pos.current.x / 45) * tiltMax;

      if (phiRef.current) {
        phiRef.current.style.transform =
          `translate(-50%, -50%) translate3d(${pos.current.x}px, ${pos.current.y}px, 0) rotateX(${rx}deg) rotateY(${ry}deg)`;
        // faint glow that tightens as you move
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
  }, []);

  return (
    <div ref={containerRef} className="home-stage">
      <div ref={phiRef} className="phi-floating">phi</div>
    </div>
  );
};

export default Home;
