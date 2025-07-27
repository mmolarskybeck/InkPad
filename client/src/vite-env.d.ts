/// <reference types="vite/client" />

declare module '*.ink?raw' {
  const content: string;
  export default content;
}
