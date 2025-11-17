// src/controllers/firmController.js
import mongoose from 'mongoose';
import { Firm } from '../models/Firm.js';

const pick = (obj, keys) =>
  keys.reduce((o, k) => (obj[k] !== undefined ? (o[k] = obj[k], o) : o), {});

// ---- CRUD ----
export const createFirm = async (req, res) => {
  try {
    const doc = await Firm.create(req.body);
    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const listFirms = async (req, res) => {
  try {
    const items = await Firm.find().sort({ createdAt: -1 });
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch firms' });
  }
};

export const getFirmById = async (req, res) => {
  try {
    const doc = await Firm.findById(req.params.firmId);
    if (!doc) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: doc });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to fetch firm' });
  }
};

export const updateFirm = async (req, res) => {
  try {
    const updated = await Firm.findByIdAndUpdate(req.params.firmId, req.body, { new: true });
    if (!updated) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const deleteFirm = async (req, res) => {
  try {
    const del = await Firm.findByIdAndDelete(req.params.firmId);
    if (!del) return res.status(404).json({ ok: false, message: 'Firm not found' });
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
    res.json({ ok: true, data: doc });
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
      { new: true, fields: { currency: 1, taxSettings: 1, billingPreferences: 1 } }
    );
    if (!doc) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const updateTaxSettings = async (req, res) => {
  try {
    const allowed = ['taxName', 'taxRatePct', 'inclusive'];
    const patch = { 'taxSettings': pick(req.body, allowed) };
    const doc = await Firm.findByIdAndUpdate(
      req.params.firmId,
      patch,
      { new: true, fields: { currency: 1, taxSettings: 1 } }
    );
    if (!doc) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

export const updateBillingPreferences = async (req, res) => {
  try {
    const allowed = ['defaultRate', 'autoSync'];
    const patch = { 'billingPreferences': pick(req.body, allowed) };
    const doc = await Firm.findByIdAndUpdate(
      req.params.firmId,
      patch,
      { new: true, fields: { billingPreferences: 1 } }
    );
    if (!doc) return res.status(404).json({ ok: false, message: 'Firm not found' });
    res.json({ ok: true, data: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};
