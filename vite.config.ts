// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Build id is written by scripts/generate-changelog.mjs (runs before every
// dev/build) to public/version.json. Inject it as __BUILD_ID__ so the running
// bundle can compare itself against the deployed /version.json (DeployWatcher).
function buildId(): string {
  try {
    const p = resolve(dirname(fileURLToPath(import.meta.url)), "public/version.json");
    return JSON.parse(readFileSync(p, "utf8")).buildId ?? "dev";
  } catch {
    return "dev";
  }
}

export default defineConfig({
  vite: {
    define: { __BUILD_ID__: JSON.stringify(buildId()) },
  },
});
