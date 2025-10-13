import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type TickerProps = {
  items: string[];
  separator?: string;          // default: ·
  speed?: number;              // pixels per second, default 80
  className?: string;
  ariaLabel?: string;          // for screen readers
};

export default function Ticker({
  items,
  separator = "·",
  speed = 80,
  className,
  ariaLabel = "Site updates",
}: TickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState<number>(0);
  const [paused, setPaused] = useState(false);

  // Duplicate items so the loop is seamless
  const display = useMemo(() => {
    const joined = items.filter(Boolean).join(`  ${separator}  `);
    // render two copies side-by-side
    return `${joined} ${separator} ${joined}${separator}`;
  }, [items, separator]);

  // Compute duration based on content width and desired speed
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setDuration(0);
      return;
    }

    // width of one half of the loop (first copy)
    // We measure the text span inside the track
    const inner = el.querySelector<HTMLSpanElement>("[data-inner]");
    if (!inner) return;

    const halfWidth = inner.offsetWidth; // width of one copy
    const nextDuration = halfWidth / Math.max(10, speed); // seconds
    setDuration(nextDuration);
  }, [display, speed]);

  // Pause on hover/focus (also useful for accessibility)
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
        "border border-neutral-200/50 dark:border-neutral-800/60 rounded-xl",
        "bg-white/40 dark:bg-neutral-900/30 backdrop-blur",
        "px-3 py-2",
        // soft edge fade with mask
        "[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]",
        className
      )}
      aria-label={ariaLabel}
      role="region"
    >
      <div
        ref={trackRef}
        data-paused={paused || !duration}
        style={
          duration
            ? { ["--ticker-duration" as any]: `${duration}s` }
            : undefined
        }
        className={clsx(
          "ticker-track whitespace-nowrap",
          "flex gap-3 items-center",
          "will-change-transform"
        )}
        {...pauseHandlers}
        tabIndex={0}
        aria-live="off"
      >
        {/* First copy */}
        <span data-inner className="shrink-0">
          <Row text={display} />
        </span>
        {/* Second copy (keeps the loop seamless) */}
        <span aria-hidden="true" className="shrink-0">
          <Row text={display} />
        </span>
      </div>
    </div>
  );
}

function Row({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center text-sm md:text-base text-neutral-800 dark:text-neutral-200">
      {text}
    </span>
  );
}
