import React, { useEffect, useRef, useState } from "react";
import "../stylesheets/home.css"; // uses .home-stage and .phi-floating from Home
import "../stylesheets/append.css";
import { PHRASE_MAX_LENGTH } from '../lib/phraseModeration'

const API_URL = "/api/append"; // your Vercel function

const Append: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // motion state
  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const pop = useRef(1);

  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // timeout ref for clearing status
  const statusTimeoutRef = useRef<number | null>(null);

  // helper: show status temporarily
  const setStatusTemp = (msg: string, ms = 500) => {
    setStatus(msg);
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatus("");
      statusTimeoutRef.current = null;
    }, ms);
  };

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  // focus hidden input
  const focusInput = () => inputRef.current?.focus();

  // background motion
  useEffect(() => {

    const el = containerRef.current;
    if (!el) return;
    const desktop = window.matchMedia('(min-width: 701px)')

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const nx = (e.clientX - cx) / (r.width / 2);
      const ny = (e.clientY - cy) / (r.height / 2);
      const max = 45;
      target.current.x = Math.max(-1, Math.min(1, nx)) * max;
      target.current.y = Math.max(-1, Math.min(1, ny)) * max;
    };

    const loop = () => {
      const k = 0.08;
      pos.current.x += (target.current.x - pos.current.x) * k;
      pos.current.y += (target.current.y - pos.current.y) * k;

      const tilt = 6, twist = 2;
      const rx = (-pos.current.y / 45) * tilt;
      const ry = (pos.current.x / 45) * tilt;
      const rz = (pos.current.x / 45) * twist;

      const max = 45;
      const dist = Math.hypot(pos.current.x / max, pos.current.y / max);
      const baseScale = 1 + dist * 0.05;

      // ease pop back to 1
      pop.current += (1 - pop.current) * 0.2;

      const t = phiRef.current;
      if (t && containerRef.current) {
        const zoneWidth = t.parentElement?.clientWidth || containerRef.current.offsetWidth
        const gutter = Math.min(76, Math.max(24, zoneWidth * .05))
        const available = desktop.matches ? Math.max(1, zoneWidth - gutter * 2 - 96) : zoneWidth * .9
        const textWidth = Math.max(t.scrollWidth, 1);
        const scale = desktop.matches ? Math.min(baseScale * pop.current, available / textWidth) : Math.min(1, available / textWidth) * baseScale * pop.current;

        t.style.transform =
          `translate(var(--append-anchor-x, -50%), -50%) translate3d(${pos.current.x}px, ${pos.current.y}px, 0)
           rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)
           scale(${scale})`;
        t.style.textShadow =
          `0 0 ${8 + Math.abs(pos.current.x) * 0.1 + Math.abs(pos.current.y) * 0.1}px rgba(255,221,51,.45)`;
      }

      rafId.current = requestAnimationFrame(loop);
    };

    el.addEventListener("mousemove", onMove);
    rafId.current = requestAnimationFrame(loop);
    return () => {
      el.removeEventListener("mousemove", onMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // submit to Vercel API
  const submit = async () => {
    const phrase = value.trim();
    if (!phrase || loading) return;

    setLoading(true);
    pop.current = 1;
    requestAnimationFrame(() => {
      pop.current = 1.35; // bigger bounce so it's obvious
    });
    setStatus("Posting…");

    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase }),
      });

      const result = await resp.json() as { ok?: boolean; error?: string; notice?: string }
      if (!resp.ok || result.ok !== true) throw new Error(result.error || `Submission failed (HTTP ${resp.status}).`)

      // ---- SUCCESS PATH ----
      // clear input (controlled state)
      setValue(""); 

      // force a visible pop: reset then bump next frame
      pop.current = 1;
      requestAnimationFrame(() => {
        pop.current = 1.35; // bigger bounce so it's obvious
      });

      // keep keyboard up on mobile
      inputRef.current?.focus?.();

      if (result.notice) {
        if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current)
        statusTimeoutRef.current = null
        setStatus(`✅ added. ${result.notice}`)
      } else setStatusTemp('✅ added to the phrase list', 4000)
    } catch (err: unknown) {
      setStatusTemp('❌ ' + (err instanceof Error ? err.message : 'failed'), 10000)
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      ref={containerRef}
      className="home-stage append-stage"
      onClick={focusInput}
      onTouchStart={focusInput}
    >
      <div className="append-status" role="status" aria-live="polite">
        {status.replace(/^[✅❌]\s*/, '')}
      </div>

      <div className="append-input-zone">
        <div ref={phiRef} className="phi-floating">
          {loading ? "Posting…" : (value || "type something...")}
        </div>
      </div>

      {/* Hidden-but-focusable input */}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          pop.current = 1;
          requestAnimationFrame(() => {
            pop.current = 1.05;
          });
          setValue(e.target.value);
          // optional: clear status while typing if not loading
          if (status && !loading) setStatus("");
        }}
        onKeyDown={onKeyDown}
        inputMode="text"
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
        aria-label="Phrase"
        maxLength={PHRASE_MAX_LENGTH}
        style={{
          position: "fixed",
          left: 0,
          bottom: 0,
          width: 1,
          height: 1,
          opacity: 0,
          background: "transparent",
          color: "transparent",
          border: "none",
          outline: "none",
        }}
      />

    </div>
  );
};

export default Append;
