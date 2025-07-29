// server/index.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { serveStatic } from './vite';
import { registerRoutes } from './routes';

// 1. Create app
const app = express();

// 2. Prod‑only middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }}));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(','), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(
  '/api/compile',
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    standardHeaders: true,
    legacyHeaders: false
  })
);

// 3. Register all API + story routes
registerRoutes(app);

// 4. In production, serve built frontend
serveStatic(app);

// 5. Listen on PORT
const port = parseInt(process.env.PORT || '3000', 10);
app.listen(port, () => {
  console.log(`Production API + static on port ${port}`);
});
