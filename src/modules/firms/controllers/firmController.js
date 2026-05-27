// src/controllers/firmController.js
import Admin from '../../users/models/admin.js';
import User from '../../users/models/User.js';
import { CaseAssignment } from '../../cases/models/CaseAssignment.js';
import { Client } from '../../clients/models/Client.js';
import { Firm } from '../models/Firm.js';

const FIRM_MUTABLE_FIELDS = ['name', 'currency', 'taxSettings', 'address', 'billingPreferences'];
const TAX_SETTINGS_FIELDS = ['taxName', 'taxRatePct', 'inclusive'];
const ADDRESS_FIELDS = ['line1', 'line2', 'city', 'state', 'postalCode', 'country'];
const BILLING_PREFERENCES_FIELDS = ['defaultRate', 'autoSync'];

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const pick = (obj, keys) =>
  keys.reduce((o, k) => (hasOwn(obj, k) ? (o[k] = obj[k], o) : o), {});

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeId = (value) => {
  if (!value) return null;
  if (value._id && value._id !== value) return normalizeId(value._id);
  return typeof value.toString === 'function' ? value.toString() : value;
};

const serializeFirm = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    ...obj,
    id: normalizeId(obj._id ?? obj.id),
  };
};

const validationFailed = (res, errors) =>
  res.status(400).json({
    ok: false,
    message: 'Validation failed',
    errors,
  });

const buildSetPatch = (payload = {}) => {
  const $set = {};

  for (const field of ['name', 'currency']) {
    if (hasOwn(payload, field)) $set[field] = payload[field];
  }

  for (const [prefix, allowedFields] of [
    ['taxSettings', TAX_SETTINGS_FIELDS],
    ['address', ADDRESS_FIELDS],
    ['billingPreferences', BILLING_PREFERENCES_FIELDS],
  ]) {
    const value = payload[prefix];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    for (const field of allowedFields) {
      if (hasOwn(value, field)) $set[`${prefix}.${field}`] = value[field];
    }
  }

  return Object.keys($set).length ? { $set } : null;
};

const buildFlatPatch = (prefix, payload = {}, allowedFields = []) => {
  const $set = {};
  for (const field of allowedFields) {
    if (hasOwn(payload, field)) $set[`${prefix}.${field}`] = payload[field];
  }
  return Object.keys($set).length ? { $set } : null;
};

const findNameConflict = async (name, excludeId) => {
  if (!name) return null;
  const filter = {
    name: { $regex: `^${escapeRegExp(name.trim())}$`, $options: 'i' },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Firm.findOne(filter).select('_id name');
};

// ---- CRUD ----
export const createFirm = async (req, res) => {
  try {
    const payload = pick(req.body, FIRM_MUTABLE_FIELDS);
    const duplicate = await findNameConflict(payload.name);
    if (duplicate) {
      return validationFailed(res, [{ field: 'name', message: 'A firm with this name already exists' }]);
    }

    const doc = await Firm.create(payload);
    res.status(201).json({ ok: true, data: serializeFirm(doc) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const listFirms = async (req, res) => {
  try {
    const items = await Firm.find().sort({ createdAt: -1 });
    res.json({ ok: true, data: items.map(serializeFirm) });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch firms' });
  }
};

export const listFirmOptions = async (_req, res) => {
  try {
    const items = await Firm.find({}, { name: 1 }).sort({ name: 1 });

    res.json({ ok: true, data: items.map(serializeFirm) });

    res.json({ ok: true, data: items });

  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch firm options' });
  }
};

export const getFirmById = async (req, res) => {
  try {
    const doc = await Firm.findById(req.params.firmId);
    if (!doc) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: serializeFirm(doc) });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch firm' });
  }
};

export const updateFirm = async (req, res) => {
  try {
    const payload = pick(req.body, FIRM_MUTABLE_FIELDS);
    if (payload.name) {
      const duplicate = await findNameConflict(payload.name, req.params.firmId);
      if (duplicate) {
        return validationFailed(res, [{ field: 'name', message: 'A firm with this name already exists' }]);
      }
    }

    const update = buildSetPatch(payload);
    if (!update) {
      return validationFailed(res, [{ field: 'body', message: 'At least one field is required' }]);
    }

    const updated = await Firm.findByIdAndUpdate(req.params.firmId, update, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: serializeFirm(updated) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const deleteFirm = async (req, res) => {
  try {
    const firm = await Firm.findById(req.params.firmId).select('_id');
    if (!firm) return res.status(404).json({ ok: false, message: 'Firm not found' });

    const [users, admins, clients, caseAssignments] = await Promise.all([
      User.countDocuments({ firmId: req.params.firmId }),
      Admin.countDocuments({ firmId: req.params.firmId }),
      Client.countDocuments({ firmId: req.params.firmId }),
      CaseAssignment.countDocuments({ firmId: req.params.firmId }),
    ]);

    if (users || admins || clients || caseAssignments) {
      return res.status(409).json({
        ok: false,
        message: 'Firm has related records and cannot be deleted',
        details: { users, admins, clients, caseAssignments },
      });
    }

    await Firm.findByIdAndDelete(req.params.firmId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to delete firm' });
  }
};

// ---- Settings helpers ----
export const getFirmSettings = async (req, res) => {
  try {
    const doc = await Firm.findById(req.params.firmId)
      .select('currency taxSettings billingPreferences');
    if (!doc) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: serializeFirm(doc) });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch settings' });
  }
};

export const updateCurrency = async (req, res) => {
  try {
    const { currency } = req.body;
    if (!currency) return res.status(400).json({ ok: false, message: 'currency is required' });
    const doc = await Firm.findByIdAndUpdate(
      req.params.firmId,
      { currency },
      {
        new: true,
        runValidators: true,
        projection: { currency: 1, taxSettings: 1, billingPreferences: 1 },
      }
    );
    if (!doc) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: serializeFirm(doc) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const updateTaxSettings = async (req, res) => {
  try {
    const patch = buildFlatPatch('taxSettings', req.body, TAX_SETTINGS_FIELDS);
    if (!patch) {
      return validationFailed(res, [{ field: 'body', message: 'At least one field is required' }]);
    }

    const doc = await Firm.findByIdAndUpdate(
      req.params.firmId,
      patch,
      {
        new: true,
        runValidators: true,
        projection: { currency: 1, taxSettings: 1 },
      }
    );
    if (!doc) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: serializeFirm(doc) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const updateBillingPreferences = async (req, res) => {
  try {
    const patch = buildFlatPatch('billingPreferences', req.body, BILLING_PREFERENCES_FIELDS);
    if (!patch) {
      return validationFailed(res, [{ field: 'body', message: 'At least one field is required' }]);
    }

    const doc = await Firm.findByIdAndUpdate(
      req.params.firmId,
      patch,
      {
        new: true,
        runValidators: true,
        projection: { billingPreferences: 1 },
      }
    );
    if (!doc) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: serializeFirm(doc) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};
