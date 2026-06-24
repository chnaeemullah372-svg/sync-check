// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, nitro, VITE_* env injection, @ path alias, dedupe, etc.
// We override the nitro preset to node-server (default is cloudflare) so production
// builds a standalone Node server (.output/server/index.mjs), and set server/preview
// host+port for the Replit environment (Replit is not detected as a sandbox).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const port = Number(process.env.PORT) || 5000;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port,
      strictPort: true,
      allowedHosts: true,
    },
    preview: {
      host: "0.0.0.0",
      port,
      strictPort: true,
      allowedHosts: true,
    },
  },
});
