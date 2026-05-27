// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

dotenv.config();

import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

// API routes
import apiRoutes from './routes/index.js';

const app = express();

// Trust proxy & health
app.set('trust proxy', 1);
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/version', (req, res) => res.json({
  ok: true,
  commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
  branch: process.env.RENDER_GIT_BRANCH || null,
}));

const defaultLocalOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
];

const configuredOrigins = [
  ...defaultLocalOrigins,
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGINS,
]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.has(normalizedOrigin)) return callback(null, true);
      if (normalizedOrigin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }
      const error = new Error('Origin not allowed by CORS');
      error.statusCode = 403;
      return callback(error);
    },
    credentials: true,
  })
);


// Parsers
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  const origin = String(req.get('origin') || '');
  if (!origin.startsWith('chrome-extension://')) return next();

  const extensionId = String(req.get('x-legal-billables-extension') || '');
  const extensionVersion = String(req.get('x-legal-billables-extension-version') || '');
  if (!extensionId || !extensionVersion) {
    return res.status(403).json({
      ok: false,
      message: 'Chrome extension requests must include extension identity headers',
    });
  }
  req.extensionContext = { extensionId, extensionVersion };
  next();
});

// Canonical API routes.
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
