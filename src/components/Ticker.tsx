import { useEffect, useRef, useState } from "react";
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
  const iteratingRef = useRef(false);

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

  // Recompute duration based on the rendered width of copy A.
  // Re-run on resize/orientation/font readiness to avoid mobile jitter after reload.
  useEffect(() => {
    const measure = () => {
      const inner = trackRef.current?.querySelector<HTMLSpanElement>("[data-a]");
      if (!inner || !rowA) {
        setDuration(0);
        return;
      }

      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        setDuration(0);
        return;
      }

      const oneCopyWidth = inner.getBoundingClientRect().width || inner.scrollWidth || 0;
      if (oneCopyWidth < 32) {
        setDuration(0);
        return;
      }
      setDuration(oneCopyWidth / Math.max(10, speed));
    };

    measure();

    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    const fonts = (document as any).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => measure()).catch(() => {});
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && trackRef.current) {
      ro = new ResizeObserver(() => measure());
      ro.observe(trackRef.current);
      const inner = trackRef.current.querySelector<HTMLSpanElement>("[data-a]");
      if (inner) ro.observe(inner);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      ro?.disconnect();
    };
  }, [rowA, speed]);

  // On each half-loop, refresh B and rotate
  const handleIter = () => {
    if (iteratingRef.current || !duration) return;
    iteratingRef.current = true;
    // B is now fully visible on the left. Rotate:
    setRowA((prev) => rowB || prev);
    getBatch()
      .then(setRowB)
      .catch(console.error)
      .finally(() => {
        iteratingRef.current = false;
      });
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
