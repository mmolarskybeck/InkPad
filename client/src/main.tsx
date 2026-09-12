import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import { FileOperations } from "@/lib/file-operations";
import "./index.css";

// Fonts are a visual enhancement for the editor shell, not a prerequisite for
// the first paint. Load this stylesheet after the app mounts so the blocking
// CSS stays focused on layout and theme tokens.
const loadFonts = () => import("./fonts.css");

if (typeof window !== "undefined") {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => void loadFonts(), { timeout: 1500 });
  } else {
    globalThis.setTimeout(() => void loadFonts(), 0);
  }
}

void FileOperations.init().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
