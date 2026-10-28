import { useEffect, useState } from "react";
import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { applyAppTheme, readAppTheme, setAppTheme, type AppTheme } from "@/lib/app-theme";

export function AppThemeSync() {
  useEffect(() => {
    const device = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyAppTheme(readAppTheme());
    sync();
    device.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      device.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return null;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return (
    <button
      type="button"
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      title={dark ? "Use light theme" : "Use dark theme"}
      onClick={() => setAppTheme(dark ? "light" : "dark")}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      {dark ? <SunIcon size={19} /> : <MoonIcon size={19} />}
    </button>
  );
}

export function ThemePreferences() {
  const [theme, setTheme] = useState<AppTheme>("system");
  useEffect(() => {
    const sync = () => setTheme(readAppTheme());
    sync();
    window.addEventListener("someonenear-theme", sync);
    return () => window.removeEventListener("someonenear-theme", sync);
  }, []);
  return (
    <section
      aria-labelledby="appearance-title"
      className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6"
    >
      <h2 id="appearance-title" className="text-lg font-semibold">
        Appearance
      </h2>
      <div
        role="radiogroup"
        aria-label="Colour theme"
        className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
      >
        {(
          [
            ["light", "Light", SunIcon],
            ["dark", "Dark", MoonIcon],
            ["system", "Device", DesktopIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <label
            key={value}
            className={`relative flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${theme === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <input
              type="radio"
              name="app-theme"
              value={value}
              checked={theme === value}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              onChange={() => setAppTheme(value)}
            />
            <Icon aria-hidden className="size-4" />
            {label}
          </label>
        ))}
      </div>
    </section>
  );
}
