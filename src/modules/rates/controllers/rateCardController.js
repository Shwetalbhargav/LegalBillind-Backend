// src/controllers/rateCardController.js
import { Case } from '../../cases/models/Case.js';
import User from '../../users/models/User.js';
import { RateCard } from '../models/RateCard.js';
import { resolveBillingRate } from '../services/rateResolver.js';

const isBlank = (value) => value === undefined || value === null || value === '';

const cleanActivityCode = (value) => {
  if (isBlank(value)) return undefined;
  const cleaned = String(value).trim();
  return cleaned || undefined;
};

const cleanDate = (value) => (isBlank(value) ? undefined : new Date(value));

const missingObjectIdClause = (field) => ({
  $or: [{ [field]: { $exists: false } }, { [field]: null }],
});

const missingStringClause = (field) => ({
  $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: '' }],
});

const normalizeCreatePayload = (body) => {
  const payload = {
    userId: body.userId,
    ratePerHour: body.ratePerHour,
    effectiveFrom: cleanDate(body.effectiveFrom),
  };
  if (!isBlank(body.caseId)) payload.caseId = body.caseId;
  const activityCode = cleanActivityCode(body.activityCode);
  if (activityCode) payload.activityCode = activityCode;
  const effectiveTo = cleanDate(body.effectiveTo);
  if (effectiveTo) payload.effectiveTo = effectiveTo;
  return payload;
};

const normalizeUpdatePayload = (body) => {
  const set = {};
  const unset = {};

  if ('userId' in body && !isBlank(body.userId)) set.userId = body.userId;
  if ('caseId' in body) {
    if (isBlank(body.caseId)) unset.caseId = 1;
    else set.caseId = body.caseId;
  }
  if ('activityCode' in body) {
    const activityCode = cleanActivityCode(body.activityCode);
    if (activityCode) set.activityCode = activityCode;
    else unset.activityCode = 1;
  }
  if ('ratePerHour' in body && !isBlank(body.ratePerHour)) set.ratePerHour = body.ratePerHour;
  if ('effectiveFrom' in body && !isBlank(body.effectiveFrom)) {
    set.effectiveFrom = cleanDate(body.effectiveFrom);
  }
  if ('effectiveTo' in body) {
    const effectiveTo = cleanDate(body.effectiveTo);
    if (effectiveTo) set.effectiveTo = effectiveTo;
    else unset.effectiveTo = 1;
  }

  return { set, unset };
};

const toComparisonDoc = (doc, { set = {}, unset = {} } = {}) => {
  const base = doc?.toObject ? doc.toObject() : { ...doc };
  const merged = { ...base, ...set };
  Object.keys(unset).forEach((field) => delete merged[field]);
  return merged;
};

const validateEffectiveWindow = (payload, res) => {
  const from = payload.effectiveFrom ? new Date(payload.effectiveFrom) : null;
  const to = payload.effectiveTo ? new Date(payload.effectiveTo) : null;
  if (!from || Number.isNaN(from.getTime())) {
    res.status(400).json({ error: 'effectiveFrom must be a valid date' });
    return false;
  }
  if (to && Number.isNaN(to.getTime())) {
    res.status(400).json({ error: 'effectiveTo must be a valid date' });
    return false;
  }
  if (to && to < from) {
    res.status(400).json({ error: 'effectiveTo must be greater than or equal to effectiveFrom' });
    return false;
  }
  return true;
};

const assertReferencesExist = async (payload, res) => {
  const user = await User.exists({ _id: payload.userId });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return false;
  }

  if (payload.caseId) {
    const caseDoc = await Case.exists({ _id: payload.caseId });
    if (!caseDoc) {
      res.status(404).json({ error: 'Case not found' });
      return false;
    }
  }

  return true;
};

const specificityClauses = ({ caseId, activityCode }) => {
  const clauses = [];
  const query = {};

  if (caseId) query.caseId = caseId;
  else clauses.push(missingObjectIdClause('caseId'));

  if (activityCode) query.activityCode = activityCode;
  else clauses.push(missingStringClause('activityCode'));

  return { query, clauses };
};

const assertNoOverlappingRateCard = async (payload, res, excludeId) => {
  const effectiveFrom = new Date(payload.effectiveFrom);
  const effectiveTo = payload.effectiveTo ? new Date(payload.effectiveTo) : null;
  const activityCode = cleanActivityCode(payload.activityCode);
  const { query: specificityQuery, clauses } = specificityClauses({
    caseId: payload.caseId,
    activityCode,
  });

  const overlapClauses = [
    ...clauses,
    {
      $or: [
        { effectiveTo: { $exists: false } },
        { effectiveTo: null },
        { effectiveTo: { $gte: effectiveFrom } },
      ],
    },
  ];
  if (effectiveTo) {
    overlapClauses.push({ effectiveFrom: { $lte: effectiveTo } });
  }

  const query = {
    userId: payload.userId,
    ...specificityQuery,
    $and: overlapClauses,
  };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await RateCard.findOne(query).select('_id');
  if (existing) {
    res.status(409).json({
      error: 'A rate card already exists for this user, scope, and effective date window',
    });
    return false;
  }
  return true;
};

/**
 * GET /api/rate-cards
 * Query: userId?, caseId?, activityCode?, activeOn? (YYYY-MM-DD)
 */
export const listRateCards = async (req, res) => {
  try {
    const { userId, caseId, activityCode, activeOn } = req.query;
    const q = {};
    if (userId) q.userId = userId;
    if (caseId) q.caseId = caseId;
    if (activityCode) q.activityCode = activityCode;
    if (activeOn) {
      const at = new Date(activeOn);
      q.effectiveFrom = { $lte: at };
      q.$or = [{ effectiveTo: null }, { effectiveTo: { $gte: at } }];
    }
    const rows = await RateCard.find(q).sort({ effectiveFrom: -1 });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list rate cards' });
  }
};

/**
 * GET /api/rate-cards/:id
 */
export const getRateCardById = async (req, res) => {
  try {
    const doc = await RateCard.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Rate card not found' });
    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch rate card' });
  }
};

/**
 * POST /api/rate-cards
 * Body: { userId, caseId?, activityCode?, ratePerHour, effectiveFrom, effectiveTo? }
 */
export const createRateCard = async (req, res) => {
  try {
    const payload = normalizeCreatePayload(req.body);
    if (!validateEffectiveWindow(payload, res)) return;
    if (!(await assertReferencesExist(payload, res))) return;
    if (!(await assertNoOverlappingRateCard(payload, res))) return;
    const doc = await RateCard.create(payload);
    res.status(201).json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to create rate card' });
  }
};

/**
 * PUT /api/rate-cards/:id
 */
export const updateRateCard = async (req, res) => {
  try {
    const existing = await RateCard.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Rate card not found' });

    const updateParts = normalizeUpdatePayload(req.body);
    const finalPayload = toComparisonDoc(existing, updateParts);
    if (!validateEffectiveWindow(finalPayload, res)) return;
    if (!(await assertReferencesExist(finalPayload, res))) return;
    if (!(await assertNoOverlappingRateCard(finalPayload, res, existing._id))) return;

    const update = {};
    if (Object.keys(updateParts.set).length) update.$set = updateParts.set;
    if (Object.keys(updateParts.unset).length) update.$unset = updateParts.unset;

    if (!Object.keys(update).length) return res.json(existing);

    const doc = await RateCard.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to update rate card' });
  }
};

/**
 * DELETE /api/rate-cards/:id
 */
export const deleteRateCard = async (req, res) => {
  try {
    const doc = await RateCard.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Rate card not found' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete rate card' });
  }
};

/**
 * GET /api/rate-cards/resolve
 * Query: userId(required), caseId?, activityCode?, at? (default: now)
 * Returns the most specific, active rate at 'at':
 *   1) Match on (userId + caseId + activityCode)
 *   2) Fallback to (userId + caseId)
 *   3) Fallback to (userId + activityCode)
 *   4) Fallback to (userId only)
 */
export const resolveRate = async (req, res) => {
  try {
    const { userId, caseId, activityCode } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const requesterRole = String(req.user?.role || '').toLowerCase();
    const canResolveAny = ['admin', 'partner'].includes(requesterRole);
    if (!canResolveAny && String(userId) !== String(req.user?.id)) {
      return res.status(403).json({ error: 'You can only resolve your own billing rate' });
    }

    const result = await resolveBillingRate({
      userId,
      caseId,
      activityCode,
      at: req.query.at,
    });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to resolve rate' });
  }
};
