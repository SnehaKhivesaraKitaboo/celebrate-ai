import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityHeaders, jsonBody, crossOriginApi, corsAllowList } from './middleware/security.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { planRoutes } from './routes/planRoutes.js';
import { createPlanService } from './services/planService.js';
import { loadConfig } from './config.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticOptions = { index: 'index.html', maxAge: '1h' };

export function createApp({ config = loadConfig(), planService = createPlanService(config) } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(securityHeaders());
  app.use('/api', crossOriginApi(), corsAllowList(config.allowedOrigins), jsonBody(), healthRoutes(), planRoutes(planService, {
    windowMs: config.planRateWindowMs,
    max: config.planRateMax,
  }), apiNotFound);

  app.use('/shared', express.static(path.join(rootDir, 'shared'), staticOptions));
  app.use(express.static(path.join(rootDir, 'public'), staticOptions));

  app.use(errorHandler);
  return app;
}
