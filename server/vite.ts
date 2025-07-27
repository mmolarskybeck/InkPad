import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express) {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // Create Vite server in middleware mode with proper configuration
    const vite = await createViteServer({
      root: path.resolve(process.cwd(), "client"),
      resolve: {
        alias: {
          '@': path.resolve(process.cwd(), 'client', 'src'),
        },
      },
      server: { middlewareMode: true },
      appType: "spa",
    });

    // Use vite's connect instance as middleware
    app.use(vite.middlewares);

    log("Dev server started", "vite");
  } else {
    serveStatic(app);
  }
}

export function serveStatic(app: Express) {
  const clientDist = path.join(process.cwd(), "dist", "client");

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    log("Serving static files from " + clientDist);
  }

  // Always serve index.html for any unknown paths (SPA support)
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}
