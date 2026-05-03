// src/controllers/invoiceLineController.js
import { Invoice } from '../models/Invoice.js';
import { InvoiceLine } from '../models/InvoiceLine.js';

async function recalc(invoiceId) {
  const lines = await InvoiceLine.find({ invoiceId });
  const subtotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const tax = 0;
  const total = Number((subtotal + tax).toFixed(2));
  await Invoice.findByIdAndUpdate(invoiceId, { subtotal, tax, total });
  return { subtotal, tax, total };
}

export const listLines = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const lines = await InvoiceLine.find({ invoiceId }).populate('timeEntryId');
    res.json(lines);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch invoice lines' });
  }
};

export const addLine = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { description, qtyHours = 0, rate = 0, amount, timeEntryId } = req.body;

    const computed = amount != null ? Number(amount) : Number((Number(qtyHours) * Number(rate)).toFixed(2));
    const line = await InvoiceLine.create({ invoiceId, description, qtyHours, rate, amount: computed, timeEntryId });
    const totals = await recalc(invoiceId);
    res.status(201).json({ line, totals });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add invoice line' });
  }
};

export const updateLine = async (req, res) => {
  try {
    const { invoiceId, lineId } = req.params;
    const { description, qtyHours, rate, amount } = req.body;

    const patch = {};
    if (description != null) patch.description = description;
    if (qtyHours != null) patch.qtyHours = qtyHours;
    if (rate != null) patch.rate = rate;
    if (amount != null) patch.amount = amount;
    if ((qtyHours != null || rate != null) && amount == null) {
      const q = qtyHours != null ? qtyHours : undefined;
      const r = rate != null ? rate : undefined;
      const existing = await InvoiceLine.findById(lineId);
      const finalQty = q != null ? Number(q) : Number(existing.qtyHours || 0);
      const finalRate = r != null ? Number(r) : Number(existing.rate || 0);
      patch.amount = Number((finalQty * finalRate).toFixed(2));
    }

    const line = await InvoiceLine.findOneAndUpdate({ _id: lineId, invoiceId }, patch, { new: true });
    if (!line) return res.status(404).json({ error: 'Line not found' });
    const totals = await recalc(invoiceId);
    res.json({ line, totals });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update invoice line' });
  }
};

export const deleteLine = async (req, res) => {
  try {
    const { invoiceId, lineId } = req.params;
    const del = await InvoiceLine.findOneAndDelete({ _id: lineId, invoiceId });
    if (!del) return res.status(404).json({ error: 'Line not found' });
    const totals = await recalc(invoiceId);
    res.json({ success: true, totals });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete invoice line' });
  }
};