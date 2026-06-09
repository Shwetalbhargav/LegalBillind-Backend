import nodemailer from 'nodemailer';
import { InvoiceLine } from '../models/InvoiceLine.js';

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function money(value, currency = 'INR') {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function clientName(invoice) {
  return invoice.clientId?.displayName || invoice.clientId?.name || 'Client';
}

function invoiceNumber(invoice) {
  return invoice.invoiceNumber || String(invoice._id);
}

async function invoiceLines(invoice) {
  return InvoiceLine.find({ invoiceId: invoice._id }).sort({ createdAt: 1 }).lean();
}

export async function buildInvoiceHtml(invoice) {
  const lines = await invoiceLines(invoice);
  const rows = lines.map((line) => `
    <tr>
      <td>${line.description || 'Professional services'}</td>
      <td class="num">${Number(line.qtyHours || 0).toFixed(2)}</td>
      <td class="num">${money(line.rate, invoice.currency)}</td>
      <td class="num">${money(line.amount, invoice.currency)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${invoiceNumber(invoice)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
    h1 { margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f9fafb; }
    .meta, .totals { margin-top: 16px; }
    .num { text-align: right; }
    .totals { margin-left: auto; width: 320px; }
  </style>
</head>
<body>
  <h1>Invoice ${invoiceNumber(invoice)}</h1>
  <div class="meta">
    <strong>Bill To:</strong> ${clientName(invoice)}<br />
    <strong>Issue Date:</strong> ${invoice.issueDate ? invoice.issueDate.toISOString().slice(0, 10) : ''}<br />
    <strong>Due Date:</strong> ${invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : ''}
  </div>
  <table>
    <thead><tr><th>Description</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No line items</td></tr>'}</tbody>
  </table>
  <table class="totals">
    <tr><td>Taxable subtotal</td><td class="num">${money(invoice.subtotal, invoice.currency)}</td></tr>
    <tr><td>${invoice.taxName || 'GST'} (${Number(invoice.taxRatePct || 0).toFixed(2)}%)</td><td class="num">${money(invoice.tax, invoice.currency)}</td></tr>
    <tr><th>Total</th><th class="num">${money(invoice.total, invoice.currency)}</th></tr>
  </table>
</body>
</html>`;
}

export async function buildInvoicePdfBuffer(invoice) {
  const lines = await invoiceLines(invoice);
  const pageLines = [
    `Invoice ${invoiceNumber(invoice)}`,
    `Bill To: ${clientName(invoice)}`,
    `Issue Date: ${invoice.issueDate ? invoice.issueDate.toISOString().slice(0, 10) : ''}`,
    `Due Date: ${invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : ''}`,
    '',
    'Description                         Hours      Rate       Amount',
    ...lines.slice(0, 24).map((line) => {
      const description = String(line.description || 'Professional services').slice(0, 32).padEnd(34);
      return `${description}${Number(line.qtyHours || 0).toFixed(2).padStart(7)} ${Number(line.rate || 0).toFixed(2).padStart(10)} ${Number(line.amount || 0).toFixed(2).padStart(11)}`;
    }),
    '',
    `Taxable subtotal: ${money(invoice.subtotal, invoice.currency)}`,
    `${invoice.taxName || 'GST'} (${Number(invoice.taxRatePct || 0).toFixed(2)}%): ${money(invoice.tax, invoice.currency)}`,
    `Total: ${money(invoice.total, invoice.currency)}`,
  ];
  const textOps = pageLines.map((line, index) => `BT /F1 10 Tf 50 ${760 - index * 18} Td (${escapeText(line)}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(textOps)} >>\nstream\n${textOps}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function createTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return nodemailer.createTransport({ jsonTransport: true });
}

export async function emailInvoice(invoice, { to, subject, message } = {}) {
  const recipient = to || invoice.clientId?.email;
  if (!recipient) throw new Error('Invoice recipient email is required');

  const pdf = await buildInvoicePdfBuffer(invoice);
  const html = await buildInvoiceHtml(invoice);
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: process.env.INVOICE_FROM_EMAIL || process.env.SMTP_FROM || 'billing@billsync.local',
    to: recipient,
    subject: subject || `Invoice ${invoiceNumber(invoice)}`,
    text: message || `Please find attached invoice ${invoiceNumber(invoice)}.`,
    html,
    attachments: [
      {
        filename: `invoice-${invoiceNumber(invoice)}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      },
    ],
  });

  return {
    to: recipient,
    messageId: info.messageId || null,
    preview: info.message ? JSON.parse(info.message) : undefined,
  };
}
