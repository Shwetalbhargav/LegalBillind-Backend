// controllers/caseController.js
import mongoose from 'mongoose';
import Case from '../models/Case.js';

// --- helpers ---------------------------------------------------------------

function toObjectId(id) {
  try { return new mongoose.Types.ObjectId(id); }
  catch { return null; }
}

async function getCaseTypesCollection() {
  // Ensure connection is ready; returns the raw Mongo collection
  return mongoose.connection.db.collection('case_types');
}

/**
 * Resolve and/or validate case type.
 * Accepts payload with case_type (string) and/or case_type_id (ObjectId/string).
 * Returns { case_type, case_type_id } with both fields set and consistent.
 */
async function resolveCaseType({ case_type, case_type_id }) {
  const col = await getCaseTypesCollection();

  // Normalize case_type_id to ObjectId if present
  let typeId = case_type_id ? (typeof case_type_id === 'string' ? toObjectId(case_type_id) : case_type_id) : null;

  if (typeId && !case_type) {
    const doc = await col.findOne({ _id: typeId }, { projection: { name: 1 } });
    if (!doc) throw new Error(`Invalid case_type_id: ${case_type_id}`);
    return { case_type: doc.name, case_type_id: doc._id };
  }

  if (!typeId && case_type) {
    const doc = await col.findOne({ name: case_type.trim() }, { projection: { name: 1 } });
    if (!doc) throw new Error(`Unknown case_type: "${case_type}"`);
    return { case_type: doc.name, case_type_id: doc._id };
  }

  if (typeId && case_type) {
    const doc = await col.findOne({ _id: typeId }, { projection: { name: 1 } });
    if (!doc) throw new Error(`Invalid case_type_id: ${case_type_id}`);
    if (doc.name !== case_type.trim()) {
      throw new Error(`case_type ("${case_type}") does not match case_type_id (${case_type_id})`);
    }
    return { case_type: doc.name, case_type_id: doc._id };
  }

  throw new Error('Either case_type or case_type_id is required');
}

// --- controllers -----------------------------------------------------------

export const createCase = async (req, res) => {
  try {
    // resolve & validate the case type
    const { case_type, case_type_id } = await resolveCaseType({
      case_type: req.body.case_type,
      case_type_id: req.body.case_type_id,
    });

    const payload = { ...req.body, case_type, case_type_id };
    const created = await new Case(payload).save();

    // return as-is (we already include both fields)
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create case' });
  }
};

export const getAllCases = async (_req, res) => {
  try {
    const cases = await Case.find()
      .populate('clientId', 'name')
      .populate('assignedUsers', 'name')
      .populate('primaryLawyerId', 'name'); // no CaseType model/populate needed
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
};

export const getCaseById = async (req, res) => {
  try {
    const item = await Case.findById(req.params.caseId)
      .populate('clientId', 'name')
      .populate('assignedUsers', 'name')
      .populate('primaryLawyerId', 'name');
    if (!item) return res.status(404).json({ error: 'Case not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
};

export const updateCase = async (req, res) => {
  try {
    let update = { ...req.body };

    // if either field is present, resolve/validate to keep them consistent
    if ('case_type' in update || 'case_type_id' in update) {
      const { case_type, case_type_id } = await resolveCaseType({
        case_type: update.case_type,
        case_type_id: update.case_type_id,
      });
      update.case_type = case_type;
      update.case_type_id = case_type_id;
    }

    const updated = await Case.findByIdAndUpdate(req.params.caseId, update, { new: true });
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update case' });
  }
};

export const deleteCase = async (req, res) => {
  try {
    const deleted = await Case.findByIdAndDelete(req.params.caseId);
    if (!deleted) return res.status(404).json({ error: 'Case not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete case' });
  }
};

// (Optional) Give FE a list of types for dropdown (no extra model file)
export const listCaseTypes = async (_req, res) => {
  try {
    const col = await getCaseTypesCollection();
    const types = await col.find({}, { projection: { name: 1 } }).sort({ name: 1 }).toArray();
    res.json(types.map(t => ({ _id: t._id, name: t.name })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case types' });
  }
};

export const getCasesByClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const cases = await Case.find({ client: clientId }).sort({ createdAt: -1 });
    res.json({ success: true, cases });
  } catch (err) { next(err); }
};
