import { useEffect, useState } from "react";

const STORAGE_KEY = "phi.mode.1998";
const HTML_ATTR = "data-1998";
const LINK_ID = "phi-1998-css";
const CSS_HREF = "/1998.css";
const DISABLED_MARK = "data-disabled-by-1998";
const PREV_MEDIA = "data-prev-media-by-1998";

function disableAppStyles() {
  // Dev (Vite): <style data-vite-dev-id="...">
  const viteDevStyles = document.querySelectorAll<HTMLStyleElement>(
    "style[data-vite-dev-id]"
  );
  viteDevStyles.forEach((style) => {
    if (style.id === LINK_ID) return;
    if (style.hasAttribute(DISABLED_MARK)) return;
    style.setAttribute(DISABLED_MARK, "true");
    style.setAttribute(PREV_MEDIA, style.media || "");
    style.media = "not all";
  });

  // Prod (Vite build): <link rel="stylesheet" href="/assets/...">
  const builtCssLinks = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"][href^="/assets/"]'
  );
  builtCssLinks.forEach((link) => {
    if (link.id === LINK_ID) return;
    if (link.hasAttribute(DISABLED_MARK)) return;
    link.setAttribute(DISABLED_MARK, "true");
    link.disabled = true;
  });
}

function restoreAppStyles() {
  const disabled = document.querySelectorAll<HTMLElement>(`[${DISABLED_MARK}="true"]`);
  disabled.forEach((el) => {
    if (el.id === LINK_ID) return;

    if (el.tagName === "LINK") {
      (el as HTMLLinkElement).disabled = false;
    } else if (el.tagName === "STYLE") {
      const prevMedia = el.getAttribute(PREV_MEDIA) ?? "";
      (el as HTMLStyleElement).media = prevMedia;
      el.removeAttribute(PREV_MEDIA);
    }

    el.removeAttribute(DISABLED_MARK);
  });
}

function apply1998Mode(enabled: boolean) {
  const html = document.documentElement;

  if (enabled) html.setAttribute(HTML_ATTR, "true");
  else html.removeAttribute(HTML_ATTR);

  const existing = document.getElementById(LINK_ID);

  if (enabled) {
    if (!existing) {
      const link = document.createElement("link");
      link.id = LINK_ID;
      link.rel = "stylesheet";
      link.href = CSS_HREF;
      document.head.appendChild(link);
    }
    disableAppStyles();
    return;
  }

  restoreAppStyles();
  existing?.remove();
}

function getInitialValue() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function get1998ModeEnabled() {
  return getInitialValue();
}

export function set1998ModeEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
  apply1998Mode(enabled);
}

export function toggle1998Mode() {
  set1998ModeEnabled(!getInitialValue());
}

export default function use1998Mode() {
  const [enabled, setEnabled] = useState<boolean>(() => getInitialValue());

  useEffect(() => {
    set1998ModeEnabled(enabled);
  }, [enabled]);

  return [enabled, setEnabled] as const;
}

export function is1998ModeEnabled() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.getAttribute(HTML_ATTR) === "true"
  );
}
