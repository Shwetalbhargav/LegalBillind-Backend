// src/controllers/rateCardController.js
import mongoose from 'mongoose';
import { RateCard } from '../models/RateCard.js';

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
 * POST /api/rate-cards
 * Body: { userId, caseId?, activityCode?, ratePerHour, effectiveFrom, effectiveTo? }
 */
export const createRateCard = async (req, res) => {
  try {
    const doc = await RateCard.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create rate card' });
  }
};

/**
 * PUT /api/rate-cards/:id
 */
export const updateRateCard = async (req, res) => {
  try {
    const doc = await RateCard.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Rate card not found' });
    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update rate card' });
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
    const at = req.query.at ? new Date(req.query.at) : new Date();
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const windowMatch = {
      effectiveFrom: { $lte: at },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: at } }],
    };

    const combos = [
      { userId, caseId, activityCode },
      { userId, caseId },
      { userId, activityCode },
      { userId },
    ];

    for (const combo of combos) {
      const q = { ...windowMatch };
      for (const [k, v] of Object.entries(combo)) {
        if (v == null) continue;
        q[k] = k.endsWith('Id') ? new mongoose.Types.ObjectId(v) : v;
      }
      const hit = await RateCard.findOne(q).sort({ effectiveFrom: -1 });
      if (hit) return res.json({ ratePerHour: hit.ratePerHour, source: hit });
    }
    res.json({ ratePerHour: null, source: null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to resolve rate' });
  }
};
