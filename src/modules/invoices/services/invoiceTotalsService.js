import { Client } from '../../clients/models/Client.js';
import { Firm } from '../../firms/models/Firm.js';
import { Invoice } from '../models/Invoice.js';
import { InvoiceLine } from '../models/InvoiceLine.js';

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeTaxSettings(settings = {}) {
  return {
    taxName: settings.taxName || 'GST',
    taxRatePct: Number(settings.taxRatePct) || 0,
    inclusive: Boolean(settings.inclusive),
  };
}

export async function getInvoiceTaxSettings(invoice, session) {
  if (invoice?.taxRatePct != null || invoice?.taxName || invoice?.taxInclusive != null) {
    return normalizeTaxSettings({
      taxName: invoice.taxName,
      taxRatePct: invoice.taxRatePct,
      inclusive: invoice.taxInclusive,
    });
  }

  const client = invoice?.clientId
    ? await Client.findById(invoice.clientId).select('firmId').session(session || null)
    : null;
  const firm = client?.firmId
    ? await Firm.findById(client.firmId).select('taxSettings').session(session || null)
    : await Firm.findOne({}).select('taxSettings').session(session || null);

  return normalizeTaxSettings(firm?.taxSettings);
}

export function computeTotalsFromLines(lines = [], taxSettings = {}) {
  const settings = normalizeTaxSettings(taxSettings);
  const lineTotal = roundMoney(lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0));
  const rate = settings.taxRatePct / 100;
  const taxableAmount = settings.inclusive && rate > 0 ? roundMoney(lineTotal / (1 + rate)) : lineTotal;
  const tax = rate > 0 ? roundMoney(settings.inclusive ? lineTotal - taxableAmount : taxableAmount * rate) : 0;
  const total = settings.inclusive ? lineTotal : roundMoney(taxableAmount + tax);

  return {
    subtotal: taxableAmount,
    tax,
    total,
    taxName: settings.taxName,
    taxRatePct: settings.taxRatePct,
    taxInclusive: settings.inclusive,
    taxDetails: {
      taxName: settings.taxName,
      taxRatePct: settings.taxRatePct,
      inclusive: settings.inclusive,
      taxableAmount,
      taxAmount: tax,
      grossAmount: total,
    },
  };
}

export async function recalcInvoiceTotals(invoiceId, { session } = {}) {
  const invoice = await Invoice.findById(invoiceId).session(session || null);
  if (!invoice) return null;

  const lines = await InvoiceLine.find({ invoiceId }).session(session || null);
  const taxSettings = await getInvoiceTaxSettings(invoice, session);
  const totals = computeTotalsFromLines(lines, taxSettings);
  const items = lines.map((line) => ({
    billableId: line.billableId,
    timeEntryId: line.timeEntryId,
    description: line.description,
    durationMinutes: roundMoney((Number(line.qtyHours) || 0) * 60),
    qtyHours: line.qtyHours,
    rate: line.rate,
    amount: line.amount,
  }));

  await Invoice.findByIdAndUpdate(invoiceId, { ...totals, items }, { session });
  return totals;
}
