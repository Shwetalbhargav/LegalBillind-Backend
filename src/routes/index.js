import { Router } from 'express';

import activityRoutes from './activityRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import arRoutes from './arRoutes.js';
import authRoutes from './authRoutes.js';
import billableRoutes from './billableRoutes.js';
import caseAssignmentRoutes from './caseAssignmentRoutes.js';
import caseRoutes from './caseRoutes.js';
import clientRoutes from './clientRoutes.js';
import emailEntryRoutes from './emailEntry.js';
import firmRoutes from './firmRoutes.js';
import integrationLogRoutes from './integrationLogRoutes.js';
import kpiRoutes from './kpiRoutes.js';
import kpiSnapshotRoutes from './kpiSnapshotRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import rateCardRoutes from './rateCardRoutes.js';
import reportsRoutes from './reportsRoutes.js';
import revenueRoutes from './revenueRoutes.js';
import timeEntryRoutes from './timeEntryRoutes.js';
import zohoAuthRoutes from './zohoAuth.js';
import zohoSyncRoutes from './zohoSync.js';
import aiRoutes from './aiRoutes.js';
import {
  invoiceLineRoutes,
  invoiceRoutes,
} from '../modules/invoices/index.js';
import {
  adminRoutes,
  associateProfileRoutes,
  internProfileRoutes,
  lawyerProfileRoutes,
  partnerProfileRoutes,
  userRoutes,
} from '../modules/users/index.js';

const router = Router();

// Current routers that already define absolute resource paths internally.
router.use('/', activityRoutes);
router.use('/', analyticsRoutes);
router.use('/', arRoutes);
router.use('/', caseAssignmentRoutes);
router.use('/', caseRoutes);
router.use('/', clientRoutes);
router.use('/', emailEntryRoutes);
router.use('/', firmRoutes);
router.use('/', integrationLogRoutes);

// Current routers that define paths relative to their resource.
router.use('/billables', billableRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/invoices/:invoiceId/lines', invoiceLineRoutes);
router.use('/kpi-snapshots', kpiSnapshotRoutes);
router.use('/kpi', kpiRoutes);
router.use('/payments', paymentRoutes);
router.use('/rate-cards', rateCardRoutes);
router.use('/reports', reportsRoutes);
router.use('/revenue', revenueRoutes);
router.use('/time-entries', timeEntryRoutes);
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
