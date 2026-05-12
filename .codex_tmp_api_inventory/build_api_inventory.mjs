import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = 'D:/BillBot Legal/docs/outputs';
const outputPath = path.join(outputDir, 'BillBot_Backend_API_Inventory.xlsx');

const rows = [
  ['Auth', 'POST', '/api/auth/login', 'Public', 'Sets HTTP-only auth cookie on success.'],
  ['Auth', 'POST', '/api/auth/register', 'Public', 'Creates user account.'],
  ['Auth', 'POST', '/api/auth/logout', 'Public', 'Clears HTTP-only auth cookie.'],
  ['Admin', 'POST', '/api/admin/login', 'Public', 'Admin login; sets HTTP-only auth cookie.'],
  ['Admin', 'POST', '/api/admin/register', 'Public', 'Creates admin user/profile.'],
  ['Admin', 'POST', '/api/admin/logout', 'Public', 'Clears auth cookie.'],
  ['Admin', 'GET', '/api/admin/me', 'Admin', 'Get current admin profile.'],
  ['Admin', 'PATCH', '/api/admin/me', 'Admin', 'Update current admin profile.'],
  ['Admin', 'GET', '/api/admin/dashboard', 'Admin', 'Admin dashboard summary.'],
  ['Admin', 'POST', '/api/admin', 'Admin', 'Create admin.'],
  ['Admin', 'GET', '/api/admin', 'Admin', 'List admins.'],
  ['Admin', 'GET', '/api/admin/:id', 'Admin', 'Get admin by id.'],
  ['Admin', 'PATCH', '/api/admin/:id', 'Admin', 'Update admin by id.'],
  ['Admin', 'DELETE', '/api/admin/:id', 'Admin', 'Delete admin by id.'],
  ['Clients', 'GET', '/api/clients', 'Authenticated', 'List clients.'],
  ['Clients', 'POST', '/api/clients', 'Authenticated', 'Create client.'],
  ['Clients', 'GET', '/api/clients/:clientId', 'Authenticated', 'Get client by id.'],
  ['Clients', 'PUT', '/api/clients/:clientId', 'Authenticated', 'Update client.'],
  ['Clients', 'DELETE', '/api/clients/:clientId', 'Authenticated', 'Delete client.'],
  ['Clients', 'PATCH', '/api/clients/:clientId/assign-owner', 'Authenticated', 'Assign owner/payment terms.'],
  ['Clients', 'GET', '/api/clients/:clientId/cases', 'Authenticated', 'List client cases.'],
  ['Clients', 'GET', '/api/clients/:clientId/invoices', 'Authenticated', 'List client invoices.'],
  ['Clients', 'GET', '/api/clients/:clientId/payments', 'Authenticated', 'List client payments.'],
  ['Clients', 'GET', '/api/clients/:clientId/summary', 'Authenticated', 'Client financial summary.'],
  ['Cases', 'GET', '/api/cases', 'Authenticated', 'List cases.'],
  ['Cases', 'POST', '/api/cases', 'Authenticated', 'Create case.'],
  ['Cases', 'GET', '/api/cases/by-client/:clientId', 'Authenticated', 'List cases for client.'],
  ['Cases', 'GET', '/api/cases/:caseId', 'Authenticated', 'Get case by id.'],
  ['Cases', 'PUT', '/api/cases/:caseId', 'Authenticated', 'Update case.'],
  ['Cases', 'DELETE', '/api/cases/:caseId', 'Authenticated', 'Delete case.'],
  ['Cases', 'PATCH', '/api/cases/:caseId/status', 'Authenticated', 'Transition case status.'],
  ['Cases', 'GET', '/api/cases/:caseId/time-entries', 'Authenticated', 'List case time entries.'],
  ['Cases', 'GET', '/api/cases/:caseId/invoices', 'Authenticated', 'List case invoices.'],
  ['Cases', 'GET', '/api/cases/:caseId/payments', 'Authenticated', 'List case payments.'],
  ['Cases', 'GET', '/api/cases/:caseId/rollup', 'Authenticated', 'Case WIP/billed/AR rollup.'],
  ['Case Assignments', 'GET', '/api/case-assignments', 'Authenticated', 'List case assignments.'],
  ['Case Assignments', 'POST', '/api/case-assignments', 'Authenticated', 'Assign user to case.'],
  ['Case Assignments', 'GET', '/api/case-assignments/timeline/:caseId', 'Authenticated', 'Case staffing timeline.'],
  ['Case Assignments', 'DELETE', '/api/case-assignments/:id', 'Authenticated', 'Remove case assignment.'],
  ['Activities', 'GET', '/api/activities', 'Authenticated', 'List activities.'],
  ['Activities', 'POST', '/api/activities', 'Authenticated', 'Create activity.'],
  ['Time Entries', 'GET', '/api/time-entries', 'Authenticated', 'List time entries.'],
  ['Time Entries', 'POST', '/api/time-entries', 'Authenticated', 'Create time entry.'],
  ['Time Entries', 'POST', '/api/time-entries/from-activity/:activityId', 'Authenticated', 'Create time entry from activity.'],
  ['Time Entries', 'PATCH', '/api/time-entries/:id', 'Authenticated', 'Update time entry.'],
  ['Time Entries', 'POST', '/api/time-entries/:id/submit', 'Authenticated', 'Submit time entry.'],
  ['Time Entries', 'POST', '/api/time-entries/:id/approve', 'Authenticated', 'Approve time entry.'],
  ['Time Entries', 'POST', '/api/time-entries/:id/reject', 'Authenticated', 'Reject time entry.'],
  ['Billables', 'GET', '/api/billables', 'Authenticated', 'List billables.'],
  ['Billables', 'POST', '/api/billables', 'Authenticated', 'Create billable.'],
  ['Billables', 'POST', '/api/billables/from-email/:emailEntryId', 'Authenticated', 'Create billable from email entry.'],
  ['Billables', 'GET', '/api/billables/:id', 'Authenticated', 'Get billable by id.'],
  ['Billables', 'PUT', '/api/billables/:id', 'Authenticated', 'Update billable.'],
  ['Billables', 'DELETE', '/api/billables/:id', 'Authenticated', 'Delete billable.'],
  ['Invoices', 'GET', '/api/invoices', 'Authenticated', 'List invoices.'],
  ['Invoices', 'POST', '/api/invoices/from-time', 'Authenticated', 'Generate invoice from approved time entries.'],
  ['Invoices', 'GET', '/api/invoices/__analytics/pending-by-client', 'Authenticated', 'Pending invoice summary by client.'],
  ['Invoices', 'GET', '/api/invoices/__pipeline', 'Authenticated', 'Invoice status pipeline.'],
  ['Invoices', 'GET', '/api/invoices/:id', 'Authenticated', 'Get invoice by id.'],
  ['Invoices', 'POST', '/api/invoices/:id/send', 'Authenticated', 'Mark/send invoice.'],
  ['Invoices', 'POST', '/api/invoices/:id/void', 'Authenticated', 'Void invoice.'],
  ['Invoice Lines', 'GET', '/api/invoices/:invoiceId/lines', 'Authenticated', 'List invoice lines.'],
  ['Invoice Lines', 'POST', '/api/invoices/:invoiceId/lines', 'Authenticated', 'Add invoice line.'],
  ['Invoice Lines', 'PUT', '/api/invoices/:invoiceId/lines/:lineId', 'Authenticated', 'Update invoice line.'],
  ['Invoice Lines', 'DELETE', '/api/invoices/:invoiceId/lines/:lineId', 'Authenticated', 'Delete invoice line.'],
  ['Payments', 'GET', '/api/payments', 'Authenticated', 'List payments.'],
  ['Payments', 'POST', '/api/payments', 'Authenticated', 'Create payment and recompute invoice status.'],
  ['Payments', 'POST', '/api/payments/:id/reconcile', 'Authenticated', 'Reconcile payment status.'],
  ['Payments', 'DELETE', '/api/payments/:id', 'Authenticated', 'Delete payment.'],
  ['AR', 'GET', '/api/ar/aging', 'Authenticated', 'AR aging totals.'],
  ['AR', 'GET', '/api/ar/aging/by-client', 'Authenticated', 'AR aging by client.'],
  ['Rates', 'GET', '/api/rate-cards', 'Authenticated', 'List rate cards.'],
  ['Rates', 'POST', '/api/rate-cards', 'Authenticated', 'Create rate card.'],
  ['Rates', 'GET', '/api/rate-cards/resolve', 'Authenticated', 'Resolve active rate.'],
  ['Rates', 'PUT', '/api/rate-cards/:id', 'Authenticated', 'Update rate card.'],
  ['Rates', 'DELETE', '/api/rate-cards/:id', 'Authenticated', 'Delete rate card.'],
  ['Firms', 'GET', '/api/firms', 'Authenticated', 'List firms.'],
  ['Firms', 'POST', '/api/firms', 'Admin/Partner', 'Create firm.'],
  ['Firms', 'GET', '/api/firms/:firmId', 'Authenticated', 'Get firm by id.'],
  ['Firms', 'PUT', '/api/firms/:firmId', 'Admin/Partner', 'Update firm.'],
  ['Firms', 'DELETE', '/api/firms/:firmId', 'Admin', 'Delete firm.'],
  ['Firms', 'GET', '/api/firms/:firmId/settings', 'Authenticated', 'Get firm settings.'],
  ['Firms', 'PATCH', '/api/firms/:firmId/currency', 'Admin/Partner', 'Update currency.'],
  ['Firms', 'PATCH', '/api/firms/:firmId/tax-settings', 'Admin/Partner', 'Update tax settings.'],
  ['Firms', 'PATCH', '/api/firms/:firmId/billing-preferences', 'Admin/Partner', 'Update billing preferences.'],
  ['Analytics', 'GET', '/api/analytics/billables', 'Authenticated', 'Billable analytics.'],
  ['Analytics', 'GET', '/api/analytics/invoices', 'Authenticated', 'Invoice analytics.'],
  ['Analytics', 'GET', '/api/analytics/unbilled', 'Authenticated', 'Unbilled analytics.'],
  ['Analytics', 'GET', '/api/analytics/billables-by-case-type', 'Authenticated', 'Billables by case type.'],
  ['Analytics', 'GET', '/api/analytics/unbilled-by-client', 'Authenticated', 'Unbilled by client.'],
  ['Analytics', 'GET', '/api/analytics/unbilled-by-user', 'Authenticated', 'Unbilled by user.'],
  ['Analytics', 'GET', '/api/analytics/billed-by-client', 'Authenticated', 'Billed by client.'],
  ['Analytics', 'GET', '/api/analytics/billed-by-user', 'Authenticated', 'Billed by user.'],
  ['Revenue', 'GET', '/api/revenue/breakdown', 'Authenticated', 'Revenue breakdown.'],
  ['Revenue', 'GET', '/api/revenue/monthly', 'Authenticated', 'Monthly revenue.'],
  ['KPI', 'GET', '/api/kpi/summary', 'Authenticated', 'KPI summary.'],
  ['KPI', 'GET', '/api/kpi/trend', 'Authenticated', 'KPI trend.'],
  ['KPI Snapshots', 'GET', '/api/kpi-snapshots', 'Authenticated', 'List KPI snapshots.'],
  ['KPI Snapshots', 'POST', '/api/kpi-snapshots/generate', 'Authenticated', 'Generate KPI snapshots.'],
  ['KPI Snapshots', 'POST', '/api/kpi-snapshots/compute-upsert', 'Authenticated', 'Compute/upsert KPI snapshot.'],
  ['Reports', 'GET', '/api/reports/time-entries.csv', 'Authenticated', 'Export time entries CSV.'],
  ['Reports', 'GET', '/api/reports/invoices.csv', 'Authenticated', 'Export invoices CSV.'],
  ['Reports', 'GET', '/api/reports/utilization.csv', 'Authenticated', 'Export utilization CSV.'],
  ['Reports', 'GET', '/api/reports/pdf', 'Authenticated', 'Export PDF report.'],
  ['Integration Logs', 'GET', '/api/integration-logs', 'Authenticated', 'List integration logs.'],
  ['Integration Logs', 'POST', '/api/integration-logs', 'Authenticated', 'Create integration log.'],
  ['Integration Logs', 'GET', '/api/integration-logs/stats', 'Authenticated', 'Integration log stats.'],
  ['Integration Logs', 'GET', '/api/integration-logs/:id', 'Authenticated', 'Get integration log.'],
  ['Integration Logs', 'DELETE', '/api/integration-logs/:id', 'Authenticated', 'Delete integration log.'],
  ['Integration Logs', 'GET', '/api/integration-logs/by-billable/:billableId', 'Authenticated', 'Logs by billable.'],
  ['Integration Logs', 'GET', '/api/integration-logs/by-invoice/:invoiceId', 'Authenticated', 'Logs by invoice.'],
  ['Zoho', 'GET', '/api/integrations/zoho/connect', 'Authenticated', 'Start Zoho OAuth.'],
  ['Zoho', 'GET', '/api/integrations/zoho/callback', 'Public callback', 'Zoho OAuth callback.'],
  ['Zoho', 'GET', '/api/integrations/zoho/status', 'Authenticated', 'Zoho connection status.'],
  ['Zoho Sync', 'GET', '/api/integrations/zoho-sync/modules', 'Authenticated', 'List Zoho modules.'],
  ['Zoho Sync', 'GET', '/api/integrations/zoho-sync/modules/:moduleApiName/fields', 'Authenticated', 'List Zoho module fields.'],
  ['Zoho Sync', 'POST', '/api/integrations/zoho-sync/sync/clients', 'Authenticated', 'Sync clients to Zoho.'],
  ['Zoho Sync', 'POST', '/api/integrations/zoho-sync/sync/clients/:clientId/contacts', 'Authenticated', 'Sync client contacts.'],
  ['Zoho Sync', 'POST', '/api/integrations/zoho-sync/sync/cases', 'Authenticated', 'Sync cases to Zoho.'],
  ['Zoho Sync', 'POST', '/api/integrations/zoho-sync/sync/invoices', 'Authenticated', 'Sync invoices to Zoho.'],
  ['Zoho Sync', 'GET', '/api/integrations/zoho-sync/:moduleApiName/:recordId/attachments', 'Authenticated', 'Get Zoho attachments.'],
  ['Zoho Sync', 'POST', '/api/integrations/zoho-sync/:moduleApiName/:recordId/attachments', 'Authenticated', 'Upload Zoho attachment.'],
  ['Zoho Sync', 'GET', '/api/integrations/zoho-sync/:moduleApiName/:recordId/related/:relatedListApiName', 'Authenticated', 'Get related Zoho records.'],
  ['Zoho Sync', 'GET', '/api/integrations/zoho-sync/activities/:moduleApiName', 'Authenticated', 'List Zoho activity records.'],
  ['Zoho Sync', 'POST', '/api/integrations/zoho-sync/activities/:moduleApiName', 'Authenticated', 'Create Zoho activity.'],
  ['Zoho Sync', 'POST', '/api/integrations/zoho-sync/workdrive/link', 'Authenticated', 'Link case to WorkDrive.'],
  ['AI', 'POST', '/api/ai/generate-email', 'Authenticated', 'Generate email draft.'],
  ['AI', 'POST', '/api/ai/email-to-billable', 'Authenticated', 'Create billable preview from email.'],
  ['Users', 'GET', '/api/users', 'Admin/Partner', 'List users.'],
  ['Users', 'POST', '/api/users', 'Admin/Partner', 'Create user.'],
  ['Users', 'GET', '/api/users/me/self', 'Authenticated', 'Get current user scopes.'],
  ['Users', 'GET', '/api/users/me', 'Authenticated', 'Get current user.'],
  ['Users', 'GET', '/api/users/:id', 'Authenticated', 'Get user by id.'],
  ['Users', 'PUT', '/api/users/:id', 'Admin/Partner', 'Update user.'],
  ['Users', 'DELETE', '/api/users/:id', 'Admin', 'Delete user.'],
  ['Users', 'GET', '/api/users/:id/profile', 'Authenticated', 'Get user profile.'],
  ['Users', 'PUT', '/api/users/:id/profile', 'Admin/Partner', 'Upsert user profile.'],
  ['Users', 'GET', '/api/users/:id/default-rate', 'Authenticated', 'Get user default rate.'],
  ['Profiles', 'GET/POST/PATCH/DELETE', '/api/partner-profiles/*', 'Role-based', 'Partner profile endpoints.'],
  ['Profiles', 'GET/POST/PATCH/DELETE', '/api/lawyer-profiles/*', 'Role-based', 'Lawyer profile endpoints.'],
  ['Profiles', 'GET/POST/PATCH/DELETE', '/api/intern-profiles/*', 'Role-based', 'Intern profile endpoints.'],
  ['Profiles', 'GET/POST/PATCH/DELETE', '/api/associate-profiles/*', 'Role-based', 'Associate profile endpoints.'],
];

const workbook = Workbook.create();
const summary = workbook.worksheets.add('Summary');
const api = workbook.worksheets.add('API Inventory');

summary.showGridLines = false;
api.showGridLines = false;

summary.getRange('A1:F1').merge();
summary.getRange('A1').values = [['BillBot Backend API Inventory']];
summary.getRange('A1').format = {
  fill: '#0F172A',
  font: { bold: true, color: '#FFFFFF', size: 16 },
  horizontalAlignment: 'center',
};

summary.getRange('A3:B8').values = [
  ['Base URL', '/api'],
  ['Total endpoints listed', rows.length],
  ['Auth model', 'HTTP-only cookie JWT'],
  ['Bearer token support', 'No'],
  ['Primary testing requirement', 'Login first, preserve cookies / credentials'],
  ['Generated for', 'API testing handoff'],
];
summary.getRange('A3:A8').format = { font: { bold: true }, fill: '#E2E8F0' };
summary.getRange('B3:B8').format = { fill: '#F8FAFC' };
summary.getRange('A10:F10').values = [['Testing Notes', '', '', '', '', '']];
summary.getRange('A10:F10').merge();
summary.getRange('A10').format = { fill: '#1E3A8A', font: { bold: true, color: '#FFFFFF' } };
summary.getRange('A11:F15').values = [
  ['1. Use the deployed backend base URL plus the endpoint path.'],
  ['2. Login with /api/auth/login or /api/admin/login before testing protected APIs.'],
  ['3. Because auth is HTTP-only cookie based, API clients must preserve cookies.'],
  ['4. In browser/frontend requests, use credentials: "include".'],
  ['5. Validate create/update routes with both valid and invalid payloads.'],
];
summary.getRange('A11:F15').merge(true);

api.getRange('A1:E1').values = [['Module', 'Method', 'Endpoint', 'Auth', 'Testing Notes']];
api.getRange('A2:E' + (rows.length + 1)).values = rows;
api.getRange('A1:E1').format = {
  fill: '#0F172A',
  font: { bold: true, color: '#FFFFFF' },
};
api.getRange('A1:E' + (rows.length + 1)).format = {
  wrapText: true,
  verticalAlignment: 'top',
};
api.freezePanes.freezeRows(1);
api.tables.add(`A1:E${rows.length + 1}`, true, 'ApiInventoryTable');
api.getRange('A:A').format.columnWidthPx = 150;
api.getRange('B:B').format.columnWidthPx = 90;
api.getRange('C:C').format.columnWidthPx = 390;
api.getRange('D:D').format.columnWidthPx = 140;
api.getRange('E:E').format.columnWidthPx = 360;

summary.getRange('A:A').format.columnWidthPx = 210;
summary.getRange('B:B').format.columnWidthPx = 420;

await fs.mkdir(outputDir, { recursive: true });

const inspect = await workbook.inspect({
  kind: 'table',
  range: `API Inventory!A1:E${Math.min(rows.length + 1, 12)}`,
  include: 'values',
  tableMaxRows: 12,
  tableMaxCols: 5,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 50 },
});
console.log(errors.ndjson);

await workbook.render({ sheetName: 'Summary', autoCrop: 'all', scale: 1, format: 'png' });
await workbook.render({ sheetName: 'API Inventory', range: 'A1:E20', scale: 1, format: 'png' });

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(outputPath);
