import React, { useEffect, useRef, useState } from "react";
import "../stylesheets/home.css";

const Home: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [crosses, setCrosses] = useState<{ x: number; y: number; key: number }[]>([]);

  // Create the grid when component mounts
  useEffect(() => {
    const cols = Math.floor(window.innerWidth / 30);
    const rows = Math.floor(window.innerHeight / 30);
    const newCrosses = [];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        newCrosses.push({ x, y, key: y * cols + x });
      }
    }

    setCrosses(newCrosses);
  }, []);

  // Handle mouse move for repelling effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const children = container.children;

      for (let i = 0; i < children.length; i++) {
        const el = children[i] as HTMLDivElement;
        const rect = el.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - e.clientX;
        const dy = rect.top + rect.height / 2 - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        

        if (dist < 100) {
          const repelX = (dx / dist) * 10;
          const repelY = (dy / dist) * 10;
          el.style.transform = `translate(${repelX}px, ${repelY}px)`;
          
        } else {
          el.style.transform = `translate(0, 0)`;
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="grid" ref={containerRef}>
      {crosses.map((cross) => (
        <div className="cross" key={cross.key}>✖</div>
      ))}
    </div>
  );
};

export default Home;
