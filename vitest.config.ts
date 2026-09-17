import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Unit-test config, separate from the app's build config (vite.config.ts) so
// the Lovable/MCP TanStack plugins don't run under the test bundler.
// Only unit tests here; Playwright E2E (tests/e2e) is run via `bun run test:e2e`.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Keep Playwright's own spec files out of the Vitest run.
    exclude: ["tests/e2e/**", "node_modules/**", ".output/**", ".worktrees/**"],
  },
});
