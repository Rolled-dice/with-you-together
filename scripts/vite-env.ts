import { loadEnv } from "vite";

// Vite can reload its config in the same process. Discard only values we injected
// previously so .env edits take effect while real shell/deployment overrides win.
const state = globalThis as typeof globalThis & { __someoneNearViteEnv?: Map<string, string> };
export function refreshServerEnvironment(mode: string, root: string) {
  for (const [name, value] of state.__someoneNearViteEnv ?? []) {
    if (process.env[name] === value) delete process.env[name];
  }
  const loaded = loadEnv(mode, root, "");
  state.__someoneNearViteEnv = new Map(
    Object.entries(loaded).filter(([name]) => process.env[name] === undefined),
  );
  for (const [name, value] of state.__someoneNearViteEnv) process.env[name] = value;
}
