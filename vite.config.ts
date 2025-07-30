// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const isStackblitz =
  process.env.STACKBLITZ === "true" ||
  (process.env.HOSTNAME ?? "").endsWith(".webcontainer.io");

export default defineConfig({
  root: path.resolve(__dirname, "client"),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
    },
  },

  plugins: [
    runtimeErrorOverlay(),
    react({ jsxRuntime: "automatic" }),
  ],

  // Web‑worker compiler needs ESM output
  worker: { format: "es" },

  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },

  server: {
    host: true,
    port: 5173,
    strictPort: false,
    hmr: {
      overlay: false, // hide Replit overlay
      ...(isStackblitz && {
        protocol: "wss",
        host: process.env.HOSTNAME,
        clientPort: 443,
      }),
    },
  },
});
