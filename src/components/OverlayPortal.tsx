import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function OverlayPortal({ children }: { children: React.ReactNode }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  if (!elRef.current) {
    elRef.current = document.createElement("div");
    elRef.current.setAttribute("data-overlay-root", ""); // for debugging
    elRef.current.style.position = "relative";
    elRef.current.style.zIndex = "9999"; // higher than your header
  }

  useEffect(() => {
    const el = elRef.current!;
    document.body.appendChild(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  return createPortal(children, elRef.current);
}
