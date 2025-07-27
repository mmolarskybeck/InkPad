import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async () => {
  // Import Monaco plugin dynamically to avoid ESM issues
  const { default: monacoEditorPlugin } = await import('vite-plugin-monaco-editor');
  
  return {
    root: path.resolve(__dirname, "client"),

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client', 'src'),
      },
    },

  plugins: [
    react({
      jsxRuntime: 'automatic'
    }),
    runtimeErrorOverlay(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html']
    }),
  ],

  build: {
    outDir: path.resolve(__dirname, "dist", "client"),
    emptyOutDir: true
  },

  server: {
    host: true,
    strictPort: true,
  }
  };
});
