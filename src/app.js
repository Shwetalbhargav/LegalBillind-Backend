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

// Legacy route aliases
import { aiRoutes } from './modules/ai/index.js';
import { activityRoutes } from './modules/activities/index.js';
import { analyticsRoutes, revenueRoutes } from './modules/analytics/index.js';
import { authRoutes } from './modules/auth/index.js';
import { billableRoutes } from './modules/billables/index.js';
import { caseAssignmentRoutes, caseRoutes } from './modules/cases/index.js';
import { clientRoutes } from './modules/clients/index.js';
import { emailEntryRoutes } from './modules/emailEntries/index.js';
import { firmRoutes } from './modules/firms/index.js';
import { invoiceLineRoutes, invoiceRoutes } from './modules/invoices/index.js';
import { integrationLogRoutes, zohoAuthRoutes, zohoCallbackHandler, zohoSyncRoutes } from './modules/integrations/index.js';
import { kpiRoutes, kpiSnapshotRoutes } from './modules/kpi/index.js';
import { arRoutes, paymentRoutes } from './modules/payments/index.js';
import { rateCardRoutes } from './modules/rates/index.js';
import { reportsRoutes } from './modules/reports/index.js';
import { timeEntryRoutes } from './modules/timeEntries/index.js';
import {
  adminRoutes,
  associateProfileRoutes,
  internProfileRoutes,
  lawyerProfileRoutes,
  partnerProfileRoutes,
  userRoutes,
} from './modules/users/index.js';




const app = express();

// Trust proxy & health
app.set('trust proxy', 1);
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/callback', zohoCallbackHandler);

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

// Legacy aliases kept during frontend/extension migration.
const legacyMount = (resourcePath, router) => {
  app.use(`/${resourcePath}`, router);
};

legacyMount('activities',       activityRoutes);
legacyMount('analytics',        analyticsRoutes);
legacyMount('ar',               arRoutes);
legacyMount('billables',        billableRoutes);
legacyMount('case-assignments', caseAssignmentRoutes);
legacyMount('cases',            caseRoutes);
legacyMount('clients',          clientRoutes);
legacyMount('email-entries',    emailEntryRoutes);
legacyMount('firms',            firmRoutes);
legacyMount('integration-logs', integrationLogRoutes);
legacyMount('invoices',         invoiceRoutes);
app.use('/invoices/:invoiceId/lines', invoiceLineRoutes);
legacyMount('kpi-snapshots',    kpiSnapshotRoutes);
legacyMount('kpi',              kpiRoutes)
legacyMount('payments',         paymentRoutes);
legacyMount('rate-cards',       rateCardRoutes);
legacyMount('reports',          reportsRoutes);
legacyMount('revenue',          revenueRoutes);
legacyMount('time-entries',     timeEntryRoutes);
legacyMount('users',            userRoutes);

// Auth & Admin (both)
legacyMount('auth',             authRoutes);   
legacyMount('admin',            adminRoutes); 

// AI helpers (both)
legacyMount('ai',               aiRoutes);

// Profiles (both)
legacyMount('partner-profiles',   partnerProfileRoutes);
legacyMount('lawyer-profiles',    lawyerProfileRoutes);
legacyMount('intern-profiles',    internProfileRoutes);
legacyMount('associate-profiles', associateProfileRoutes);

app.use('/integrations/zoho', zohoAuthRoutes);

app.use('/integrations/zoho-sync', zohoSyncRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
