import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type TickerProps = {
  separator?: string;   // default ·
  speed?: number;       // pixels/sec (affects duration calc)
  className?: string;
  ariaLabel?: string;
};

export default function Ticker({
  separator = "·",
  speed = 80,
  className,
  ariaLabel = "Site updates",
}: TickerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [rowA, setRowA] = useState<string>("");
  const [rowB, setRowB] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [paused, setPaused] = useState(false);

  // --- phrase helpers ---
  async function getBatch(limit = 40) {
    const res = await fetch("https://api.phi.me.uk/kv/phrases");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr: string[] = await res.json();
    // shuffle + trim + join
    const batch = [...arr].sort(() => Math.random() - 0.5).slice(0, limit);
    return batch.filter(Boolean).join(`  ${separator}  `);
  }

  // Initial load: two independent batches
  useEffect(() => {
    (async () => {
      const [a, b] = await Promise.all([getBatch(), getBatch()]);
      setRowA(a);
      setRowB(b);
    })().catch(console.error);
  }, []);

  // Recompute duration based on the width of A (one copy)
  useEffect(() => {
    const inner = trackRef.current?.querySelector<HTMLSpanElement>("[data-a]");
    if (!inner) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setDuration(0);

    const oneCopyWidth = inner.offsetWidth || 1;
    setDuration(oneCopyWidth / Math.max(10, speed));
  }, [rowA, speed]);

  // On each half-loop, refresh B and rotate
  const handleIter = () => {
    // B is now fully visible on the left. Rotate:
    setRowA(prev => rowB || prev);
    getBatch().then(setRowB).catch(console.error);
  };

  const pauseHandlers = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
  };

  return (
    <div
      className={clsx(
        "relative w-full overflow-hidden select-none ticker-bg",
        className
      )}
      aria-label={ariaLabel}
      role="region"
    >
      <div
        ref={trackRef}
        className="ticker-track"
        data-paused={paused || !duration}
        style={duration ? ({ ["--ticker-duration" as any]: `${duration}s` }) : undefined}
        onAnimationIteration={handleIter}
        {...pauseHandlers}
        tabIndex={0}
        aria-live="off"
      >
        {/* Copy A */}
        <span data-a className="shrink-0">
          <Row text={rowA} />
        </span>
        {/* Copy B */}
        <span data-b className="shrink-0" aria-hidden="true">
          <Row text={rowB} />
        </span>
      </div>
    </div>
  );
}

function Row({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap">
      {text}
    </span>
  );
}
