// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

dotenv.config();

// Core
import connectDB from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

// API routes
import apiRoutes from './routes/index.js';

// Legacy route aliases
import activityRoutes from './routes/activityRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import arRoutes from './routes/arRoutes.js';
import authRoutes from './routes/authRoutes.js';
import billableRoutes from './routes/billableRoutes.js';
import caseAssignmentRoutes from './routes/caseAssignmentRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import emailEntryRoutes from './routes/emailEntry.js';
import firmRoutes from './routes/firmRoutes.js';
import integrationLogRoutes from './routes/integrationLogRoutes.js';
import kpiSnapshotRoutes from './routes/kpiSnapshotRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import rateCardRoutes from './routes/rateCardRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import revenueRoutes from './routes/revenueRoutes.js';
import timeEntryRoutes from './routes/timeEntryRoutes.js';
import kpiRoutes from './routes/kpiRoutes.js';
import zohoAuthRoutes, { zohoCallbackHandler } from './routes/zohoAuth.js';
import zohoSyncRoutes from './routes/zohoSync.js';
import { invoiceLineRoutes, invoiceRoutes } from './modules/invoices/index.js';
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

// DB
connectDB();




app.use(
  cors({
    origin: true,        
    credentials: true,   
  })
);


// Parsers
app.use(express.json());
app.use(cookieParser());

// Canonical API routes.
app.use('/api', apiRoutes);

// Legacy aliases kept during frontend/extension migration.
app.use('/', activityRoutes);
app.use('/', analyticsRoutes);
app.use('/', arRoutes);
app.use('/', caseAssignmentRoutes);
app.use('/', caseRoutes);
app.use('/', clientRoutes);
app.use('/', emailEntryRoutes);
app.use('/', firmRoutes);
app.use('/', integrationLogRoutes);

// Resource-relative routers -> mount at '/<resource>' AND '/api/<resource>'
const legacyMount = (resourcePath, router) => {
  app.use(`/${resourcePath}`, router);
};

legacyMount('billables',        billableRoutes);
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
