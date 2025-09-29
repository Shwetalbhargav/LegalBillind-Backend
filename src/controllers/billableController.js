// controllers/billable.controller.js
import Billable from '../models/Billable.js';
import EmailEntry from '../models/EmailEntry.js';
import User from '../models/User.js';
import Firm from '../models/Firm.js';
import Case from '../models/Case.js';

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
  return Math.max(increment, Math.ceil(mins / increment) * increment);
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
      status // optional; defaults to 'Pending'
    } = req.body;

    // resolve user/firm rate if not provided
    let finalRate = rate;
    if (!finalRate) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const firm = await Firm.findById(user.firmId);
      if (!firm) return res.status(404).json({ error: 'Firm not found' });
      finalRate = user.billingRate || firm.billingPreferences?.defaultRate || 0;
    }

    const mins =
      typeof durationMinutes === 'number'
        ? durationMinutes
        : Math.round((Number(durationHours || 0) * 60));

    const durationMinsRounded = roundToIncrement(mins, 6);
    const amount = Number(((durationMinsRounded / 60) * finalRate).toFixed(2));

    const finalActivityCode = activityCode || 'OTHER';
    const finalCategory = category || CATEGORY_BY_CODE[finalActivityCode] || 'Miscellaneous administrative legal work';

    const doc = await Billable.create({
      userId, clientId, caseId,
      subject,
      description,
      date: date ? new Date(date) : new Date(),
      durationMinutes: durationMinsRounded,
      rate: finalRate,
      amount,
      activityCode: finalActivityCode,
      category: finalCategory,
      status: status || 'Pending'
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ——— EmailEntry → Billable ————————————————————————————————
async function resolveClientCaseByRecipient(req, recipient) {
  // Replace with your real mapping or PracticePanther/Clio search
  return {
    clientId: req.app.locals.demoClientId,
    caseId:   req.app.locals.demoCaseId,
    rate:     300
  };
}

export const createFromEmail = async (req, res) => {
  try {
    const { emailEntryId } = req.params;
    const email = await EmailEntry.findById(emailEntryId);
    if (!email) return res.status(404).json({ error: 'EmailEntry not found' });

    const { clientId, caseId, rate } = await resolveClientCaseByRecipient(req, email.recipient);
    if (!clientId || !caseId) {
      return res.status(422).json({ error: 'Unable to resolve client/case from recipient' });
    }

    const durationMinutes = roundToIncrement(email.typingTimeMinutes, 6);
    const amount = Number(((durationMinutes / 60) * rate).toFixed(2));

    const billable = await Billable.create({
      caseId,
      clientId,
      userId: email.userId,
      subject: email.subject,
      activityCode: 'EMAIL',
      category: CATEGORY_BY_CODE.EMAIL,
      description: email.billableSummary || `Email: ${email.subject}`,
      durationMinutes,
      rate,
      amount,
      date: email.createdAt,
      status: 'Pending'
    });

    res.status(201).json(billable);
  } catch (e) {
    res.status(400).json({ error: e.message });
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
    if (req.query.status)    filters.status = req.query.status;

    
    
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

export const createBillableFromEmail = async (req, res, next) => {
  try {
    const { emailEntryId } = req.params;
    const entry = await EmailEntry.findById(emailEntryId);
    if (!entry) return res.status(404).json({ success:false, message:'Email entry not found' });
    // Example mapping; adjust fields to your schema
    const billable = await Billable.create({
      client: entry.client,
      case: entry.case,
      description: entry.subject || 'Email work',
      minutes: entry.estimatedMinutes ?? 6,
      source: { type: 'email', id: entry._id }
    });
    res.status(201).json({ success:true, billable });
  } catch (err) { next(err); }
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
export const updateBillable = async (req, res) => {
  try {
    const patch = { ...req.body };

    // allow hours or minutes in updates; keep amount consistent
    let minutes = patch.durationMinutes;
    if (typeof patch.durationHours === 'number') {
      minutes = Math.round(patch.durationHours * 60);
    }
    if (typeof minutes === 'number') {
      patch.durationMinutes = roundToIncrement(minutes, 6);
    }

    if (typeof patch.rate === 'number' || typeof patch.durationMinutes === 'number') {
      // need current or patched values to compute amount
      const current = await Billable.findById(req.params.id).select('rate durationMinutes');
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
