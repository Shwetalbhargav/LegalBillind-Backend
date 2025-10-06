// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/db.js';
import cookieParser from "cookie-parser";
import clioSyncRoutes from './routes/clioSync.js';
import emailEntryRoutes from './routes/emailEntry.js';
import clioAuthRoutes from './routes/clioAuth.js';
import authRoutes from './routes/authRoutes.js';
import billableRoutes from './routes/billableRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import userRoutes from "./routes/userRoutes.js";
import aiRoutes from './routes/aiRoutes.js';
import partnerProfileRoutes from './routes/partnerProfileRoutes.js';
import lawyerProfileRoutes from './routes/lawyerProfileRoutes.js';
import internProfileRoutes from './routes/internProfileRoutes.js';
import associateProfileRoutes from './routes/associateProfileRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
app.set('trust proxy', 1);
app.get('/healthz', (req, res) => res.json({ ok: true }));

connectDB();

const allowlist = new Set([
  'chrome-extension://loicakonhdggeejichcfpgagooapmdek',
  'https://mail.google.com',
  'http://localhost:5173',
  'http://localhost:5000',
  process.env.FRONTEND_URL,
]);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowlist.has(origin)) return cb(null, true);
    if (/\.vercel\.app$/.test(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// mounts — PATHS ONLY
app.use('/api/email-entry', emailEntryRoutes);
app.use('/api/billables', billableRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/clio-sync', clioSyncRoutes);
app.use('/api/auth', authRoutes);
app.use('/clio', clioAuthRoutes);
app.use("/api/users", userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/partner-profiles', partnerProfileRoutes);
app.use('/api/lawyer-profiles', lawyerProfileRoutes);
app.use('/api/intern-profiles', internProfileRoutes);
app.use('/api/associate-profiles', associateProfileRoutes);
app.use('/api/admin', adminRoutes);

export default app;
