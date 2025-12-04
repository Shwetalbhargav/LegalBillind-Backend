// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

dotenv.config();

// Core
import connectDB from './config/db.js';

// Routes (29 total)
import activityRoutes from './routes/activityRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import arRoutes from './routes/arRoutes.js';
import associateProfileRoutes from './routes/associateProfileRoutes.js';
import authRoutes from './routes/authRoutes.js';
import billableRoutes from './routes/billableRoutes.js';
import caseAssignmentRoutes from './routes/caseAssignmentRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import clioAuthRoutes from './routes/clioAuth.js';
import clioSyncRoutes from './routes/clioSync.js';
import emailEntryRoutes from './routes/emailEntry.js';
import firmRoutes from './routes/firmRoutes.js';
import integrationLogRoutes from './routes/integrationLogRoutes.js';
import internProfileRoutes from './routes/internProfileRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import invoiceLineRoutes from './routes/invoiceLineRoutes.js';
import kpiSnapshotRoutes from './routes/kpiSnapshotRoutes.js';
import lawyerProfileRoutes from './routes/lawyerProfileRoutes.js';
import partnerProfileRoutes from './routes/partnerProfileRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import rateCardRoutes from './routes/rateCardRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import revenueRoutes from './routes/revenueRoutes.js';
import timeEntryRoutes from './routes/timeEntryRoutes.js';
import userRoutes from './routes/userRoutes.js';
import kpiRoutes from './routes/kpiRoutes.js';




const app = express();

// Trust proxy & health
app.set('trust proxy', 1);
app.get('/healthz', (req, res) => res.json({ ok: true }));

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

/**
 * Mounts (dual-path: legacy + /api)
 *
 * Some routers define their own absolute paths internally (e.g. '/clients', '/cases').
 * We mount them at BOTH '/' (legacy) and '/api' (new) to keep existing consumers working.
 *
 * Others are resource-relative routers; we mount them at BOTH '/<resource>' (legacy)
 * and '/api/<resource>' (new).
 */

// Routers with absolute paths inside -> mount at '/' AND '/api'
for (const base of ['/', '/api']) {
  app.use(base, activityRoutes);          
  app.use(base, analyticsRoutes);         
  app.use(base, arRoutes);               
  app.use(base, caseAssignmentRoutes);     
  app.use(base, caseRoutes);               
  app.use(base, clientRoutes);             
  app.use(base, emailEntryRoutes);         
  app.use(base, firmRoutes);               
  app.use(base, integrationLogRoutes);   
}

// Resource-relative routers -> mount at '/<resource>' AND '/api/<resource>'
const dualMount = (resourcePath, router) => {
  app.use(`/${resourcePath}`, router);
  app.use(`/api/${resourcePath}`, router);
};

dualMount('billables',        billableRoutes);
dualMount('invoices',         invoiceRoutes);
app.use('/invoices/:invoiceId/lines', invoiceLineRoutes);
app.use('/api/invoices/:invoiceId/lines', invoiceLineRoutes); // keep both for nested
dualMount('kpi-snapshots',    kpiSnapshotRoutes);
dualMount('kpi',              kpiRoutes)
dualMount('payments',         paymentRoutes);
dualMount('rate-cards',       rateCardRoutes);
dualMount('reports',          reportsRoutes);
dualMount('revenue',          revenueRoutes);
dualMount('time-entries',     timeEntryRoutes);
dualMount('users',            userRoutes);

// Auth & Admin (both)
dualMount('auth',             authRoutes);   
dualMount('admin',            adminRoutes); 

// AI helpers (both)
dualMount('ai',               aiRoutes);

// Profiles (both)
dualMount('partner-profiles',   partnerProfileRoutes);
dualMount('lawyer-profiles',    lawyerProfileRoutes);
dualMount('intern-profiles',    internProfileRoutes);
dualMount('associate-profiles', associateProfileRoutes);

app.use('/clio', clioAuthRoutes);
app.use('/api/clio', clioAuthRoutes);

dualMount('clio-sync', clioSyncRoutes);

export default app;
