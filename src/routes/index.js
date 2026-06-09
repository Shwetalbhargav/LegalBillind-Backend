// src/routes/index.js

import { Router } from 'express';

import { aiRoutes } from '../modules/ai/index.js';
import { activityRoutes } from '../modules/activities/index.js';
import { analyticsRoutes, revenueRoutes } from '../modules/analytics/index.js';
import { authRoutes } from '../modules/auth/index.js';
import { billableRoutes } from '../modules/billables/index.js';
import { caseAssignmentRoutes, caseRoutes } from '../modules/cases/index.js';
import { clientRoutes } from '../modules/clients/index.js';
import { documentStorageRoutes } from '../modules/documentStorage/index.js';
import { emailEntryRoutes } from '../modules/emailEntries/index.js';
import { firmRoutes } from '../modules/firms/index.js';
import {
  invoiceLineRoutes,
  invoiceRoutes,
} from '../modules/invoices/index.js';
import { integrationLogRoutes, zohoAuthRoutes, zohoSyncRoutes } from '../modules/integrations/index.js';
import { kpiRoutes, kpiSnapshotRoutes } from '../modules/kpi/index.js';
import { arRoutes, paymentRoutes } from '../modules/payments/index.js';
import { rateCardRoutes } from '../modules/rates/index.js';
import { reportsRoutes } from '../modules/reports/index.js';
import { taskRoutes } from '../modules/tasks/index.js';
import { timeEntryRoutes } from '../modules/timeEntries/index.js';
import { workSessionRoutes } from '../modules/workSessions/index.js';
import {
  adminRoutes,
  associateProfileRoutes,
  internProfileRoutes,
  lawyerProfileRoutes,
  partnerProfileRoutes,
  userRoutes,
} from '../modules/users/index.js';

const router = Router();

// Resource-relative routers.
router.use('/activities', activityRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/ar', arRoutes);
router.use('/billables', billableRoutes);
router.use('/case-assignments', caseAssignmentRoutes);
router.use('/cases', caseRoutes);
router.use('/clients', clientRoutes);
router.use('/document-storage', documentStorageRoutes);
router.use('/email-entries', emailEntryRoutes);
router.use('/firms', firmRoutes);
router.use('/integration-logs', integrationLogRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/invoices/:invoiceId/lines', invoiceLineRoutes);
router.use('/kpi-snapshots', kpiSnapshotRoutes);
router.use('/kpi', kpiRoutes);
router.use('/payments', paymentRoutes);
router.use('/rate-cards', rateCardRoutes);
router.use('/reports', reportsRoutes);
router.use('/tasks', taskRoutes);
router.use('/revenue', revenueRoutes);
router.use('/time-entries', timeEntryRoutes);
router.use('/work-sessions', workSessionRoutes);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/ai', aiRoutes);
router.use('/partner-profiles', partnerProfileRoutes);
router.use('/lawyer-profiles', lawyerProfileRoutes);
router.use('/intern-profiles', internProfileRoutes);
router.use('/associate-profiles', associateProfileRoutes);
router.use('/integrations/zoho', zohoAuthRoutes);
router.use('/integrations/zoho-sync', zohoSyncRoutes);

export default router;
