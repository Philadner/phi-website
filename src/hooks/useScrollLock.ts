import { useEffect } from "react";

export default function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    const body = document.body;
    if (!isLocked) return;

    const scrollY = window.scrollY;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      // Remove fixed positioning
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
