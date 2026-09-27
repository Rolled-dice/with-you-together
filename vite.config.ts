// Plain Vite + TanStack Start config targeting Cloudflare Workers via Nitro.
// Replaces @lovable.dev/vite-tanstack-config; this file now owns the full plugin list.
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Load non-VITE_ vars into process.env so server code can read secrets during
  // `vite dev`. In production the Worker gets them from Cloudflare secrets instead.
  // VITE_* vars are exposed to the client by Vite automatically via import.meta.env.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Use src/server.ts (our SSR error wrapper) as the server entry.
        server: { entry: "server" },
        // Fail the build if server-only modules leak into the client bundle.
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      nitro({
        preset: "cloudflare-module",
        cloudflare: {
          nodeCompat: true,
          deployConfig: true,
        },
      }),
      viteReact(),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      port: 8080,
      // Let tunnels (cloudflared / ngrok) reach the dev server for webhook testing.
      allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app"],
    },
  };
});
