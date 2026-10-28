export type AppTheme = "light" | "dark" | "system";

export function readAppTheme(): AppTheme {
  try {
    const value = localStorage.getItem("someonenear-theme");
    if (value === "light" || value === "dark") return value;
  } catch {
    /* Use the device preference when storage is unavailable. */
  }
  return "system";
}

export function applyAppTheme(theme: AppTheme) {
  const dark =
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  window.dispatchEvent(new Event("someonenear-theme"));
}

export function setAppTheme(theme: AppTheme) {
  try {
    localStorage.setItem("someonenear-theme", theme);
  } catch {
    /* Apply for this visit. */
  }
  applyAppTheme(theme);
}
