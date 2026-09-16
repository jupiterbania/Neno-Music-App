import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error node builtin types are not included for the Vite config
import { fileURLToPath } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const resolveEntry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolveEntry("./src"),
    },
  },
  build: {
    // Target modern browsers bundled in Tauri's WebView – allows smaller output
    target: "es2020",
    // Raise warning threshold; the large chunk warning is cosmetic for a local app
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolveEntry("./index.html"),
        mini: resolveEntry("./mini.html"),
      },
      output: {
        // Manual chunks: split heavy vendor libs into separate cacheable files
        manualChunks(id) {
          // Framer Motion (motion/react) — large, rarely changes
          if (id.includes("motion")) return "vendor-motion";
          // React core
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom"))
            return "vendor-react";
          // YouTube/video data fetching libs
          if (id.includes("youtubei") || id.includes("googlevideo") || id.includes("bgutils"))
            return "vendor-youtube";
          // Solar icons (large SVG icon set)
          if (id.includes("solar-icons")) return "vendor-icons";
          // All other node_modules go to a general vendor chunk
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
