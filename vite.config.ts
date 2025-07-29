import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';
import { monacoEditorPlugin } from 'vite-plugin-monaco-editor';   // ← named import

/* ------------------------------------------------------------ */
/* Detect StackBlitz                                            */
/* ------------------------------------------------------------ */
const hostname = process.env.HOSTNAME ?? '';            // *.webcontainer.io
const isStackblitz =
  process.env.STACKBLITZ === 'true' || hostname.endsWith('.webcontainer.io');

/* ------------------------------------------------------------ */
/* Export config                                                */
/* ------------------------------------------------------------ */
export default defineConfig({
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
    hmr: isStackblitz
      ? {
          protocol: 'wss',
          host: hostname,   // full *.webcontainer.io host
          clientPort: 443,
        }
      : undefined,
  },
});
