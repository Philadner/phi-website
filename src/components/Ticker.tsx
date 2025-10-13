import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type TickerProps = {
  separator?: string;  // default: ·
  speed?: number;      // pixels per second, default 80
  className?: string;
  ariaLabel?: string;  // for screen readers
};

export default function Ticker({
  separator = "·",
  speed = 80,
  className,
  ariaLabel = "Site updates",
}: TickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState<number>(0);
  const [paused, setPaused] = useState(false);
  const [items, setItems] = useState<string[]>([]);

  // 🔥 Fetch the phrases directly from your KV API
  useEffect(() => {
    async function fetchPhrases() {
      try {
        const res = await fetch("https://api.phi.me.uk/kv/phrases");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          // Shuffle them so they loop differently each time
          const shuffled = data.sort(() => Math.random() - 0.5);
          setItems(shuffled.slice(0, 40)); // Limit to ~40 to keep it performant
        }
      } catch (err) {
        console.error("Failed to fetch ticker items:", err);
      }
    }

    fetchPhrases();
  }, []);

  // Duplicate items for seamless loop
  const display = useMemo(() => {
    const joined = items.filter(Boolean).join(`  ${separator}  `);
    return `${joined} ${separator} ${joined}${separator}`;
  }, [items, separator]);

  // Compute animation duration
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const inner = el.querySelector<HTMLSpanElement>("[data-inner]");
    if (!inner) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setDuration(0);
      return;
    }

    const halfWidth = inner.offsetWidth;
    const nextDuration = halfWidth / Math.max(10, speed);
    setDuration(nextDuration);
  }, [display, speed]);

  // Pause on hover
  const pauseHandlers = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative w-full overflow-hidden select-none",
        "bg-[#6e0000]/90 text-white",
        "px-3 py-2",
        "[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]",
        className
      )}
      aria-label={ariaLabel}
      role="region"
    >
      <div
        ref={trackRef}
        data-paused={paused || !duration}
        style={duration ? { ["--ticker-duration" as any]: `${duration}s` } : undefined}
        className={clsx(
          "ticker-track whitespace-nowrap",
          "flex gap-3 items-center",
          "will-change-transform"
        )}
        {...pauseHandlers}
        tabIndex={0}
        aria-live="off"
      >
        <span data-inner className="shrink-0">
          <Row text={display} />
        </span>
        <span aria-hidden="true" className="shrink-0">
          <Row text={display} />
        </span>
      </div>
    </div>
  );
}

function Row({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center text-sm md:text-base text-white">
      {text}
    </span>
  );
}
