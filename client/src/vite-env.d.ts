/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module '*.ink?raw' {
  const content: string;
  export default content;
}

declare module 'monaco-editor/esm/vs/editor/edcore.main' {
  export * from 'monaco-editor';
}
