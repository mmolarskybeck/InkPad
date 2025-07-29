// server/index-dev.ts
import express from 'express';
import { setupVite } from './vite';
import { registerRoutes } from './routes';
import { log } from './vite';

;(async () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // 1. Register API routes
  registerRoutes(app);

  // 2. Mount Vite middleware (only in dev)
  await setupVite(app);

  // 3. Listen on single port
  const port = parseInt(process.env.PORT || '3000', 10);
  app.listen(port, () => log(`Dev server + Vite on http://localhost:${port}`));
})();
