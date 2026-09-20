// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { resolve, sep } from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// On Windows, Vite normalizes `config.root` to forward slashes (e.g. C:/Users/...),
// but @lovable.dev/mcp-js internally uses Node's path.resolve() which produces
// backslash paths (C:\Users\...). Its `assertContains` check then fails because it
// compares a forward-slash parent against a backslash child. We wrap the plugin so
// that, on Windows, both its `config` and `configResolved` hooks see a `config.root`
// using OS-native separators. `vite build` runs multiple builder passes, so we patch
// every hook that reads the root rather than relying on a single call.
function windowsPathFixMcpPlugin() {
  const plugin = mcpPlugin();
  if (sep !== "\\") return plugin;

  const nativeRoot = (config: { root?: string }) =>
    config && typeof config.root === "string"
      ? new Proxy(config, {
          get(target, prop, receiver) {
            if (prop === "root") return (target.root as string).split("/").join(sep);
            return Reflect.get(target, prop, receiver);
          },
        })
      : config;

  const mutablePlugin = plugin as unknown as Record<string, unknown>;
  const wrap = (hookName: "config" | "configResolved") => {
    const original = mutablePlugin[hookName];
    if (typeof original !== "function") return;
    mutablePlugin[hookName] = function patched(
      config: { root?: string },
      ...rest: unknown[]
    ) {
      return (original as (c: unknown, ...a: unknown[]) => unknown).call(
        this,
        nativeRoot(config),
        ...rest,
      );
    };
  };

  wrap("config");
  wrap("configResolved");
  return plugin;
}

// Load non-VITE_ env vars into process.env so server routes (e.g. email webhooks) can read them.
// Never expose these to the client bundle.
Object.assign(
  process.env,
  loadEnv(process.env["NODE_ENV"] === "production" ? "production" : "development", process.cwd(), ""),
);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [windowsPathFixMcpPlugin()],
    resolve: {
      alias: {
        "entities/lib/decode.js": resolve(process.cwd(), "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": resolve(process.cwd(), "node_modules/entities/lib/encode.js"),
      },
    },
  },
});
