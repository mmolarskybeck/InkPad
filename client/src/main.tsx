import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Configure Monaco Editor to avoid worker issues
(self as any).MonacoEnvironment = {
  getWorker: function () {
    return null;
  }
};

createRoot(document.getElementById("root")!).render(<App />);
