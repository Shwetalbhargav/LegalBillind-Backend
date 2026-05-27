//src/controllers/billableController.js

import Billable, {
  billableStatusQuery,
  normalizeBillableStatus,
} from '../models/Billable.js';
import {EmailEntry} from '../../emailEntries/models/EmailEntry.js';
import {Case} from '../../cases/models/Case.js';
import { resolveBillingRate } from '../../rates/services/rateResolver.js';
import {
  convertEmailEntryToBillingRecords,
  runEmailEntryTransaction,
} from '../../emailEntries/services/emailEntryConversionService.js';

// Map from activityCode → category (fallbacks to keep data consistent)
const CATEGORY_BY_CODE = {
  EMAIL: 'Email drafting/review',
  CALL: 'Client consultation (calls/meetings)',
  MEETING: 'Client consultation (calls/meetings)',
  DOC_REVIEW: 'Case preparation/documentation',
  RESEARCH: 'Legal research',
  NEGOTIATION: 'Negotiation/settlement discussions',
  ADMIN: 'Miscellaneous administrative legal work',
  OTHER: 'Miscellaneous administrative legal work'
};

function roundToIncrement(mins, increment = 6) {
  return Math.max(increment, Math.ceil(Number(mins || 0) / increment) * increment);
}

// ——— Manual create ————————————————————————————————————————————————
export const createBillable = async (req, res) => {
  try {
    const {
      userId, clientId, caseId,
      description, date,
      // either durationHours or durationMinutes is acceptable:
      durationHours, durationMinutes,
      rate, // optional; will fallback to user/firm
      activityCode, category, subject,
      status // optional; defaults to 'pending'
    } = req.body;

    const finalActivityCode = activityCode || 'OTHER';
    const workDate = date ? new Date(date) : new Date();

    // Resolve from RateCard/profile/firm defaults if not explicitly provided.
    let finalRate = rate;
    if (finalRate == null) {
      const resolved = await resolveBillingRate({
        userId,
        caseId,
        activityCode: finalActivityCode,
        at: workDate,
      });
      finalRate = resolved.ratePerHour ?? 0;
    }

    const mins =
      typeof durationMinutes === 'number'
        ? durationMinutes
        : Math.round((Number(durationHours || 0) * 60));

    const durationMinsRounded = roundToIncrement(mins, 6);
    const amount = Number(((durationMinsRounded / 60) * finalRate).toFixed(2));

    const finalCategory = category || CATEGORY_BY_CODE[finalActivityCode] || 'Miscellaneous administrative legal work';

    const doc = await Billable.create({
      userId, clientId, caseId,
      subject,
      description,
      date: workDate,
      durationMinutes: durationMinsRounded,
      rate: finalRate,
      amount,
      activityCode: finalActivityCode,
      category: finalCategory,
      status: normalizeBillableStatus(status)
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ——— EmailEntry → Billable ————————————————————————————————
export const createFromEmail = async (req, res) => {
  try {
    const { emailEntryId } = req.params;
    const result = await runEmailEntryTransaction(async (session) => {
      const email = await EmailEntry.findById(emailEntryId).session(session);
      if (!email) {
        const error = new Error('EmailEntry not found');
        error.statusCode = 404;
        throw error;
      }
      if (!email.clientId || !email.caseId) {
        const error = new Error('Email entry must be mapped to a client and case before creating a billable');
        error.statusCode = 422;
        throw error;
      }
      return convertEmailEntryToBillingRecords(email, {
        body: req.body || {},
        actorId: req.user?.id,
        session,
      });
    });

    res.status(201).json(result.billable);
  } catch (e) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
};

// ——— Reads ————————————————————————————————————————————————
export const getAllBillables = async (req, res) => {
  try {
    const filters = {};
    if (req.query.clientId)  filters.clientId = req.query.clientId;
    if (req.query.caseId)    filters.caseId = req.query.caseId;
    if (req.query.category)  filters.category = req.query.category;
    if (req.query.userId)    filters.userId = req.query.userId;
    if (req.query.status)    filters.status = billableStatusQuery(req.query.status);

    
    
    const { caseType, caseTypeId } = req.query;
     if (caseType || caseTypeId) {
     const q = {};
     if (caseType)   q.case_type = caseType;
     if (caseTypeId) q.case_type_id = caseTypeId;
    const caseIds = await Case.find(q).distinct('_id');
     filters.caseId = { $in: caseIds };
    }

    // optional date range
    const { from, to } = req.query;
    if (from || to) {
      filters.date = {};
      if (from) filters.date.$gte = new Date(from);
      if (to)   filters.date.$lte = new Date(to);
    }

    
    const docs = await Billable.find(filters)
      .populate('clientId caseId userId')
      .sort({ date: -1 });

    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billables' });
  }
};

export const getBillableById = async (req, res) => {
  try {
    const billable = await Billable.findById(req.params.id).populate('clientId caseId userId');
    if (!billable) return res.status(404).json({ error: 'Billable not found' });
    res.json(billable);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billable' });
  }
};

// ——— Update/Delete ————————————————————————————————————————————
export const approveBillable = async (req, res) => {
  try {
    const billable = await Billable.findById(req.params.id);
    if (!billable) return res.status(404).json({ error: 'Billable not found' });
    if (billable.status === 'billed' || billable.invoiceId) {
      return res.status(409).json({ error: 'Billed entries cannot be approved again' });
    }

    billable.status = 'approved';
    billable.approvedAt = new Date();
    billable.approvedBy = req.user.id;
    billable.rejectedAt = undefined;
    billable.rejectedBy = undefined;
    billable.rejectionReason = undefined;

    await billable.save();
    res.json(billable);
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve billable' });
  }
};

export const rejectBillable = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
    if (reason.length > 500) {
      return res.status(400).json({ error: 'Rejection reason must be at most 500 characters' });
    }

    const billable = await Billable.findById(req.params.id);
    if (!billable) return res.status(404).json({ error: 'Billable not found' });
    if (billable.status === 'billed' || billable.invoiceId) {
      return res.status(409).json({ error: 'Billed entries cannot be rejected' });
    }

    billable.status = 'rejected';
    billable.rejectedAt = new Date();
    billable.rejectedBy = req.user.id;
    billable.rejectionReason = reason;
    billable.approvedAt = undefined;
    billable.approvedBy = undefined;

    await billable.save();
    res.json(billable);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject billable' });
  }
};

export const updateBillable = async (req, res) => {
  try {
    const patch = { ...req.body };
    if (patch.status) patch.status = normalizeBillableStatus(patch.status);

    // allow hours or minutes in updates; keep amount consistent
    let minutes = patch.durationMinutes;
    if (typeof patch.durationHours === 'number') {
      minutes = Math.round(patch.durationHours * 60);
    }
    if (typeof minutes === 'number') {
      patch.durationMinutes = roundToIncrement(minutes, 6);
    }

    const rateResolutionFields = ['userId', 'caseId', 'activityCode', 'date'];
    const shouldResolveRate = patch.rate == null && rateResolutionFields.some((field) => field in patch);
    let current = null;
    if (typeof patch.rate === 'number' || typeof patch.durationMinutes === 'number' || shouldResolveRate) {
      // need current or patched values to compute amount
      current = await Billable.findById(req.params.id).select('rate durationMinutes userId caseId activityCode date');
      if (shouldResolveRate) {
        const resolved = await resolveBillingRate({
          userId: patch.userId ?? current?.userId,
          caseId: patch.caseId ?? current?.caseId,
          activityCode: patch.activityCode ?? current?.activityCode,
          at: patch.date ?? current?.date,
        });
        if (resolved.ratePerHour != null) patch.rate = resolved.ratePerHour;
      }
      const useRate = typeof patch.rate === 'number' ? patch.rate : current?.rate;
      const useMinutes = typeof patch.durationMinutes === 'number' ? patch.durationMinutes : current?.durationMinutes;
      if (typeof useRate === 'number' && typeof useMinutes === 'number') {
        patch.amount = Number(((useMinutes / 60) * useRate).toFixed(2));
      }
    }

    const billable = await Billable.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!billable) return res.status(404).json({ error: 'Billable not found' });
    res.json(billable);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update billable' });
  }
};

export const deleteBillable = async (req, res) => {
  try {
    const billable = await Billable.findByIdAndDelete(req.params.id);
    if (!billable) return res.status(404).json({ error: 'Billable not found' });
    res.json({ message: 'Billable deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete billable' });
  }
};
