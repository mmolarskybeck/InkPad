// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import packageJson from "./package.json";

const isStackblitz =
  process.env.STACKBLITZ === "true" ||
  (process.env.HOSTNAME ?? "").endsWith(".webcontainer.io");

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
    },
  },

  plugins: [
    react({ jsxRuntime: "automatic" }),
  ],

  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },

    // Web‑worker compiler needs ESM output
    worker: { format: "es" },

    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      // Monaco's editor core is intentionally large; warn only if it grows beyond the current shape.
      chunkSizeWarningLimit: 3500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("vite/preload-helper")) return "vendor";
            if (id.includes("node_modules")) {
              if (id.includes("/monaco-editor/")) return "monaco";
              if (id.includes("/inkjs/")) return "inkjs";
              if (id.includes("/@vercel/speed-insights/")) return "speed-insights";
              if (id.includes("/lucide-react/")) return "lucide";
              if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(id)) {
                return "react-vendor";
              }
              return "vendor";
            }
          }
        }
      }
    },


    server: {
      host: true,
      port: Number(process.env.PORT) || 5173,
      strictPort: false,
      hmr: {
        overlay: false, // hide Replit overlay
        ...(isStackblitz && {
          protocol: "wss",
          host: process.env.HOSTNAME,
          clientPort: 443,
        }),    },
  },
});
