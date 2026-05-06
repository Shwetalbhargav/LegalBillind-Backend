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

const configuredOrigins = [
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

// Canonical API routes.
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
