import { useEffect, useState } from "react";
type SiteTheme = "cream" | "navy";
const preferenceKey = "sn_member_theme";
const themeEvent = "sn:theme-change";
export function useSiteTheme() {
  const [theme, setTheme] = useState<SiteTheme>("cream");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(preferenceKey);
      } catch {
        /* Follow the device preference. */
      }
      setTheme(saved === "navy" || saved === "cream" ? saved : media.matches ? "navy" : "cream");
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("storage", update);
    window.addEventListener(themeEvent, update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", update);
      window.removeEventListener(themeEvent, update);
    };
  }, []);
  function chooseTheme(next: SiteTheme) {
    try {
      localStorage.setItem(preferenceKey, next);
    } catch {
      /* Keep the selection for this mounted view. */
    }
    window.dispatchEvent(new Event(themeEvent));
    setTheme(next);
  }
  return [theme, chooseTheme] as const;
}
