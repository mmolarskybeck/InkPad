// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// ---------------------------------------------------------------------------
// 1.  Detect whether we’re running inside StackBlitz WebContainers
//     • STACKBLITZ=true is set automatically
//     • HOSTNAME is the full *.webcontainer.io domain
// ---------------------------------------------------------------------------
const hostname      = process.env.HOSTNAME ?? '';          // e.g. inkpad--3000--slug.webcontainer.io
const isStackblitz  =
  process.env.STACKBLITZ === 'true' ||
  hostname.endsWith('.webcontainer.io');

// ---------------------------------------------------------------------------
// 2.  Export Vite config
// ---------------------------------------------------------------------------
export default defineConfig(async () => {
  // Dynamically import Monaco plugin (avoids ESM issues)
  const { default: monacoEditorPlugin } = await import('vite-plugin-monaco-editor');

  return {
    root: path.resolve(__dirname, 'client'),

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client', 'src'),
      },
    },

    plugins: [
      react({ jsxRuntime: 'automatic' }),
      runtimeErrorOverlay(),
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html'],
      }),
    ],

    build: {
      outDir: path.resolve(__dirname, 'dist', 'client'),
      emptyOutDir: true,
    },

    server: {
      host: true,
      strictPort: true,
      port: 3000,

      // ---------------------------------------------------------------------
      // 3.  StackBlitz‐specific HMR override
      // ---------------------------------------------------------------------
      hmr: isStackblitz
        ? {
            protocol: 'wss',
            host: hostname, // full *.webcontainer.io domain injected by StackBlitz
            clientPort: 443,
          }
        : undefined,
    },
  };
});
