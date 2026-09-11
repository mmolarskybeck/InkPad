// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import packageJson from "./package.json";

const isStackblitz =
  process.env.STACKBLITZ === "true" ||
  (process.env.HOSTNAME ?? "").endsWith(".webcontainer.io");

const devServerPort = Number(process.env.PORT) || 2173;
const previewServerPort = Number(process.env.PREVIEW_PORT) || 3173;

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },

  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "client", "src") },
      // inkjs's exports map hides dist/, but the HTML export inlines the runtime source.
      {
        find: /^inkjs-runtime-source(?=\?|$)/,
        replacement: path.resolve(__dirname, "node_modules", "inkjs", "dist", "ink.js"),
      },
    ],
    // CodeMirror extensions break silently if two copies of @codemirror/state
    // or @codemirror/view end up in the same page (facets/keymaps from one
    // copy are invisible to a view built from the other).
    //
    // @codemirror/view is pinned to 6.43.2 in package.json: the content-DOM
    // update rewrite in 6.43.3 through (at least) 6.43.5 corrupts the editor
    // state with this extension stack — deleted empty lines during cursor
    // motion, and "TilePointer.advance" crashes on full-document replaces.
    // Re-verify against upstream before bumping past 6.43.2.
    dedupe: [
      "@codemirror/autocomplete",
      "@codemirror/commands",
      "@codemirror/language",
      "@codemirror/lint",
      "@codemirror/search",
      "@codemirror/state",
      "@codemirror/view",
      "@lezer/common",
      "@lezer/highlight",
      "@lezer/lr",
    ],
    // The runtime source is inlined as text via the alias above; the optimizer
    // cannot pre-bundle a ?raw asset.
    exclude: ["inkjs-runtime-source?raw", "inkjs-runtime-source"],
  },

  // The editor is lazy-loaded, so without this Vite only discovers the
  // CodeMirror packages mid-session, re-optimizes, and can leave a stale
  // browser tab mixing two copies of @codemirror/state (dev-only editor
  // breakage: dead keymaps, invisible selection, phantom text).
  optimizeDeps: {
    include: [
      "@codemirror/autocomplete",
      "@codemirror/commands",
      "@codemirror/language",
      "@codemirror/lint",
      "@codemirror/search",
      "@codemirror/state",
      "@codemirror/view",
      "@lezer/common",
      "@lezer/highlight",
      "@lezer/lr",
    ],
    // The runtime source is inlined as text via the alias above; the optimizer
    // cannot pre-bundle a ?raw asset.
    exclude: ["inkjs-runtime-source?raw", "inkjs-runtime-source"],
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
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("vite/preload-helper")) return "vendor";
            if (id.includes("node_modules")) {
              if (id.includes("/inkjs/")) return "inkjs";
              if (id.includes("/@codemirror/") || id.includes("/@lezer/")) return "codemirror-vendor";
              if (id.includes("/jszip/")) return "zip-vendor";
              if (id.includes("/file-saver/")) return "download-vendor";
              if (id.includes("/@radix-ui/") || id.includes("/vaul/")) return "ui-vendor";
              if (id.includes("/@vercel/speed-insights/")) return "speed-insights";
              if (id.includes("/@vercel/analytics/")) return "analytics";
              if (id.includes("/react-resizable-panels/")) return "layout-vendor";
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


    preview: {
      host: true,
      port: previewServerPort,
      strictPort: false,
    },

    server: {
      host: true,
      port: devServerPort,
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
