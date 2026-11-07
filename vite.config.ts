// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using the configured node-server preset), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isCapacitorBuild = ["build:ios", "build:android"].includes(
  process.env["npm_lifecycle_event"] ?? "",
);

export default defineConfig({
  nitro: isCapacitorBuild ? false : { preset: "node-server" },
  tanstackStart: {
    // The static shell prerender uses TanStack's standard fetch handler.
    server: { entry: isCapacitorBuild ? "capacitor-server" : "server" },
    ...(isCapacitorBuild
      ? {
          spa: {
            enabled: true,
            maskPath: "/",
            prerender: { outputPath: "/index" },
          },
        }
      : {}),
  },
  vite: {
    // turndown's Node build calls require() during SSR and crashes every page;
    // the browser build is safe to import on the server (only used client-side).
    resolve: {
      alias: [{ find: /^turndown$/, replacement: "turndown/lib/turndown.browser.es.js" }],
    },
  },
});
