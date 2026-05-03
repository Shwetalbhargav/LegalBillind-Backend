# API Route Inventory

This inventory captures the current public route surface before the feature-based module migration. Legacy non-`/api` aliases are intentionally preserved during migration unless noted.

## Health

- `GET /healthz`

## Absolute Routers

These routers currently define absolute paths internally and are mounted at both `/` and `/api`.

### Activities

- `POST /activities`
- `GET /activities`
- `POST /api/activities`
- `GET /api/activities`

### Analytics

- `GET /analytics/billables`
- `GET /analytics/invoices`
- `GET /analytics/unbilled`
- `GET /analytics/billables-by-case-type`
- `GET /analytics/unbilled-by-client`
- `GET /analytics/unbilled-by-user`
- `GET /analytics/billed-by-client`
- `GET /analytics/billed-by-user`
- `GET /api/analytics/billables`
- `GET /api/analytics/invoices`
- `GET /api/analytics/unbilled`
- `GET /api/analytics/billables-by-case-type`
- `GET /api/analytics/unbilled-by-client`
- `GET /api/analytics/unbilled-by-user`
- `GET /api/analytics/billed-by-client`
- `GET /api/analytics/billed-by-user`

### Accounts Receivable

- `GET /ar/aging`
- `GET /ar/aging/by-client`
- `GET /api/ar/aging`
- `GET /api/ar/aging/by-client`

### Case Assignments

- `POST /case-assignments`
- `DELETE /case-assignments/:id`
- `GET /case-assignments`
- `GET /case-assignments/timeline/:caseId`
- `POST /api/case-assignments`
- `DELETE /api/case-assignments/:id`
- `GET /api/case-assignments`
- `GET /api/case-assignments/timeline/:caseId`

### Cases

- `POST /cases`
- `GET /cases`
- `GET /cases/:caseId`
- `PUT /cases/:caseId`
- `DELETE /cases/:caseId`
- `PATCH /cases/:caseId/status`
- `GET /cases/:caseId/time-entries`
- `GET /cases/:caseId/invoices`
- `GET /cases/:caseId/payments`
- `GET /cases/:caseId/rollup`
- `GET /cases/by-client/:clientId`
- `POST /api/cases`
- `GET /api/cases`
- `GET /api/cases/:caseId`
- `PUT /api/cases/:caseId`
- `DELETE /api/cases/:caseId`
- `PATCH /api/cases/:caseId/status`
- `GET /api/cases/:caseId/time-entries`
- `GET /api/cases/:caseId/invoices`
- `GET /api/cases/:caseId/payments`
- `GET /api/cases/:caseId/rollup`
- `GET /api/cases/by-client/:clientId`

### Clients

- `GET /clients`
- `GET /clients/:clientId`
- `POST /clients`
- `PUT /clients/:clientId`
- `DELETE /clients/:clientId`
- `PATCH /clients/:clientId/assign-owner`
- `GET /clients/:clientId/cases`
- `GET /clients/:clientId/invoices`
- `GET /clients/:clientId/payments`
- `GET /clients/:clientId/summary`
- `GET /api/clients`
- `GET /api/clients/:clientId`
- `POST /api/clients`
- `PUT /api/clients/:clientId`
- `DELETE /api/clients/:clientId`
- `PATCH /api/clients/:clientId/assign-owner`
- `GET /api/clients/:clientId/cases`
- `GET /api/clients/:clientId/invoices`
- `GET /api/clients/:clientId/payments`
- `GET /api/clients/:clientId/summary`

### Email Entries

- `POST /email-entries`
- `GET /email-entries`
- `GET /email-entries/:id`
- `PATCH /email-entries/:id`
- `DELETE /email-entries/:id`
- `POST /email-entries/:id/map`
- `POST /email-entries/:id/gpt-narrative`
- `POST /email-entries/:id/activity`
- `POST /email-entries/:id/time-entry`
- `POST /email-entries/:id/sync-zoho`
- `POST /email-entries/bulk`
- `POST /api/email-entries`
- `GET /api/email-entries`
- `GET /api/email-entries/:id`
- `PATCH /api/email-entries/:id`
- `DELETE /api/email-entries/:id`
- `POST /api/email-entries/:id/map`
- `POST /api/email-entries/:id/gpt-narrative`
- `POST /api/email-entries/:id/activity`
- `POST /api/email-entries/:id/time-entry`
- `POST /api/email-entries/:id/sync-zoho`
- `POST /api/email-entries/bulk`

### Firms

- `POST /firms`
- `GET /firms`
- `GET /firms/:firmId`
- `PUT /firms/:firmId`
- `DELETE /firms/:firmId`
- `GET /firms/:firmId/settings`
- `PATCH /firms/:firmId/currency`
- `PATCH /firms/:firmId/tax-settings`
- `PATCH /firms/:firmId/billing-preferences`
- `POST /api/firms`
- `GET /api/firms`
- `GET /api/firms/:firmId`
- `PUT /api/firms/:firmId`
- `DELETE /api/firms/:firmId`
- `GET /api/firms/:firmId/settings`
- `PATCH /api/firms/:firmId/currency`
- `PATCH /api/firms/:firmId/tax-settings`
- `PATCH /api/firms/:firmId/billing-preferences`

### Integration Logs

- `POST /integration-logs`
- `GET /integration-logs`
- `GET /integration-logs/stats`
- `GET /integration-logs/by-billable/:billableId`
- `GET /integration-logs/by-invoice/:invoiceId`
- `GET /integration-logs/:id`
- `DELETE /integration-logs/:id`
- `DELETE /integration-logs`
- `POST /api/integration-logs`
- `GET /api/integration-logs`
- `GET /api/integration-logs/stats`
- `GET /api/integration-logs/by-billable/:billableId`
- `GET /api/integration-logs/by-invoice/:invoiceId`
- `GET /api/integration-logs/:id`
- `DELETE /api/integration-logs/:id`
- `DELETE /api/integration-logs`

## Resource-Relative Routers

These routers currently define resource-relative paths and are mounted at both `/<resource>` and `/api/<resource>`.

### Billables

- `POST /billables`
- `GET /billables`
- `POST /billables/from-email/:emailEntryId`
- `GET /billables/:id`
- `PUT /billables/:id`
- `DELETE /billables/:id`
- `POST /api/billables`
- `GET /api/billables`
- `POST /api/billables/from-email/:emailEntryId`
- `GET /api/billables/:id`
- `PUT /api/billables/:id`
- `DELETE /api/billables/:id`

### Invoices

- `GET /invoices`
- `POST /invoices/from-time`
- `GET /invoices/__analytics/pending-by-client`
- `GET /invoices/__pipeline`
- `GET /invoices/:id`
- `POST /invoices/:id/send`
- `POST /invoices/:id/void`
- `GET /invoices/:invoiceId/lines`
- `POST /invoices/:invoiceId/lines`
- `PUT /invoices/:invoiceId/lines/:lineId`
- `DELETE /invoices/:invoiceId/lines/:lineId`
- `GET /api/invoices`
- `POST /api/invoices/from-time`
- `GET /api/invoices/__analytics/pending-by-client`
- `GET /api/invoices/__pipeline`
- `GET /api/invoices/:id`
- `POST /api/invoices/:id/send`
- `POST /api/invoices/:id/void`
- `GET /api/invoices/:invoiceId/lines`
- `POST /api/invoices/:invoiceId/lines`
- `PUT /api/invoices/:invoiceId/lines/:lineId`
- `DELETE /api/invoices/:invoiceId/lines/:lineId`

### KPI

- `GET /kpi/summary`
- `GET /kpi/trend`
- `GET /api/kpi/summary`
- `GET /api/kpi/trend`

### KPI Snapshots

- `POST /kpi-snapshots/generate`
- `POST /kpi-snapshots/compute-upsert`
- `GET /kpi-snapshots`
- `GET /kpi-snapshots/:id`
- `POST /api/kpi-snapshots/generate`
- `POST /api/kpi-snapshots/compute-upsert`
- `GET /api/kpi-snapshots`
- `GET /api/kpi-snapshots/:id`

### Payments

- `GET /payments`
- `POST /payments`
- `POST /payments/:id/reconcile`
- `DELETE /payments/:id`
- `GET /api/payments`
- `POST /api/payments`
- `POST /api/payments/:id/reconcile`
- `DELETE /api/payments/:id`

### Rate Cards

- `GET /rate-cards`
- `POST /rate-cards`
- `GET /rate-cards/resolve`
- `PUT /rate-cards/:id`
- `DELETE /rate-cards/:id`
- `GET /api/rate-cards`
- `POST /api/rate-cards`
- `GET /api/rate-cards/resolve`
- `PUT /api/rate-cards/:id`
- `DELETE /api/rate-cards/:id`

### Reports

- `GET /reports/time-entries.csv`
- `GET /reports/invoices.csv`
- `GET /reports/utilization.csv`
- `GET /reports/pdf`
- `GET /api/reports/time-entries.csv`
- `GET /api/reports/invoices.csv`
- `GET /api/reports/utilization.csv`
- `GET /api/reports/pdf`

### Revenue

- `GET /revenue/breakdown`
- `GET /revenue/monthly`
- `GET /api/revenue/breakdown`
- `GET /api/revenue/monthly`

### Time Entries

- `POST /time-entries`
- `POST /time-entries/from-activity/:activityId`
- `GET /time-entries`
- `PATCH /time-entries/:id`
- `POST /time-entries/:id/submit`
- `POST /time-entries/:id/approve`
- `POST /time-entries/:id/reject`
- `POST /api/time-entries`
- `POST /api/time-entries/from-activity/:activityId`
- `GET /api/time-entries`
- `PATCH /api/time-entries/:id`
- `POST /api/time-entries/:id/submit`
- `POST /api/time-entries/:id/approve`
- `POST /api/time-entries/:id/reject`

### Users

- `POST /users`
- `GET /users`
- `GET /users/me/self`
- `GET /users/me`
- `GET /users/:id/profile`
- `PUT /users/:id/profile`
- `GET /users/:id/default-rate`
- `GET /users/:id`
- `PUT /users/:id`
- `DELETE /users/:id`
- `POST /api/users`
- `GET /api/users`
- `GET /api/users/me/self`
- `GET /api/users/me`
- `GET /api/users/:id/profile`
- `PUT /api/users/:id/profile`
- `GET /api/users/:id/default-rate`
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Auth

- `POST /auth/login`
- `POST /auth/register`
- `POST /api/auth/login`
- `POST /api/auth/register`

### Admin

- `POST /admin/login`
- `POST /admin/register`
- `PATCH /admin/me`
- `GET /admin/me`
- `GET /admin/dashboard`
- `POST /admin`
- `GET /admin`
- `GET /admin/:id`
- `PATCH /admin/:id`
- `DELETE /admin/:id`
- `POST /api/admin/login`
- `POST /api/admin/register`
- `PATCH /api/admin/me`
- `GET /api/admin/me`
- `GET /api/admin/dashboard`
- `POST /api/admin`
- `GET /api/admin`
- `GET /api/admin/:id`
- `PATCH /api/admin/:id`
- `DELETE /api/admin/:id`

### AI

- `POST /ai/generate-email`
- `POST /ai/email-to-billable`
- `POST /api/ai/generate-email`
- `POST /api/ai/email-to-billable`

### Profiles

- `POST /partner-profiles`
- `GET /partner-profiles/me`
- `PUT /partner-profiles/me`
- `POST /partner-profiles/me/delete`
- `GET /partner-profiles`
- `GET /partner-profiles/by-user`
- `GET /partner-profiles/by-id`
- `PUT /partner-profiles/update`
- `POST /partner-profiles/remove`
- `GET /partner-profiles/dashboard`
- `POST /api/partner-profiles`
- `GET /api/partner-profiles/me`
- `PUT /api/partner-profiles/me`
- `POST /api/partner-profiles/me/delete`
- `GET /api/partner-profiles`
- `GET /api/partner-profiles/by-user`
- `GET /api/partner-profiles/by-id`
- `PUT /api/partner-profiles/update`
- `POST /api/partner-profiles/remove`
- `GET /api/partner-profiles/dashboard`
- `POST /lawyer-profiles`
- `GET /lawyer-profiles`
- `GET /lawyer-profiles/by-id`
- `GET /lawyer-profiles/by-user`
- `PUT /lawyer-profiles`
- `DELETE /lawyer-profiles`
- `GET /lawyer-profiles/me`
- `PATCH /lawyer-profiles/me`
- `DELETE /lawyer-profiles/me`
- `GET /lawyer-profiles/dashboard`
- `POST /api/lawyer-profiles`
- `GET /api/lawyer-profiles`
- `GET /api/lawyer-profiles/by-id`
- `GET /api/lawyer-profiles/by-user`
- `PUT /api/lawyer-profiles`
- `DELETE /api/lawyer-profiles`
- `GET /api/lawyer-profiles/me`
- `PATCH /api/lawyer-profiles/me`
- `DELETE /api/lawyer-profiles/me`
- `GET /api/lawyer-profiles/dashboard`
- `POST /intern-profiles`
- `GET /intern-profiles`
- `GET /intern-profiles/view`
- `PUT /intern-profiles/update`
- `POST /intern-profiles/remove`
- `GET /intern-profiles/by-user`
- `GET /intern-profiles/me`
- `PATCH /intern-profiles/me`
- `DELETE /intern-profiles/me`
- `GET /intern-profiles/dashboard`
- `POST /api/intern-profiles`
- `GET /api/intern-profiles`
- `GET /api/intern-profiles/view`
- `PUT /api/intern-profiles/update`
- `POST /api/intern-profiles/remove`
- `GET /api/intern-profiles/by-user`
- `GET /api/intern-profiles/me`
- `PATCH /api/intern-profiles/me`
- `DELETE /api/intern-profiles/me`
- `GET /api/intern-profiles/dashboard`
- `POST /associate-profiles`
- `GET /associate-profiles`
- `GET /associate-profiles/by-id`
- `PATCH /associate-profiles`
- `DELETE /associate-profiles`
- `GET /associate-profiles/by-user`
- `GET /associate-profiles/me`
- `PATCH /associate-profiles/me`
- `DELETE /associate-profiles/me`
- `GET /associate-profiles/dashboard`
- `POST /api/associate-profiles`
- `GET /api/associate-profiles`
- `GET /api/associate-profiles/by-id`
- `PATCH /api/associate-profiles`
- `DELETE /api/associate-profiles`
- `GET /api/associate-profiles/by-user`
- `GET /api/associate-profiles/me`
- `PATCH /api/associate-profiles/me`
- `DELETE /api/associate-profiles/me`
- `GET /api/associate-profiles/dashboard`

### Zoho

- `GET /callback`
- `GET /integrations/zoho/connect`
- `GET /integrations/zoho/callback`
- `GET /integrations/zoho/status`
- `GET /api/integrations/zoho/connect`
- `GET /api/integrations/zoho/callback`
- `GET /api/integrations/zoho/status`
- `GET /integrations/zoho-sync/modules`
- `GET /integrations/zoho-sync/modules/:moduleApiName/fields`
- `POST /integrations/zoho-sync/sync/clients`
- `POST /integrations/zoho-sync/sync/clients/:clientId/contacts`
- `POST /integrations/zoho-sync/sync/cases`
- `POST /integrations/zoho-sync/sync/invoices`
- `GET /integrations/zoho-sync/activities/:moduleApiName`
- `POST /integrations/zoho-sync/activities/:moduleApiName`
- `POST /integrations/zoho-sync/workdrive/link`
- `GET /integrations/zoho-sync/:moduleApiName/:recordId/attachments`
- `POST /integrations/zoho-sync/:moduleApiName/:recordId/attachments`
- `GET /integrations/zoho-sync/:moduleApiName/:recordId/related/:relatedListApiName`
- `GET /api/integrations/zoho-sync/modules`
- `GET /api/integrations/zoho-sync/modules/:moduleApiName/fields`
- `POST /api/integrations/zoho-sync/sync/clients`
- `POST /api/integrations/zoho-sync/sync/clients/:clientId/contacts`
- `POST /api/integrations/zoho-sync/sync/cases`
- `POST /api/integrations/zoho-sync/sync/invoices`
- `GET /api/integrations/zoho-sync/activities/:moduleApiName`
- `POST /api/integrations/zoho-sync/activities/:moduleApiName`
- `POST /api/integrations/zoho-sync/workdrive/link`
- `GET /api/integrations/zoho-sync/:moduleApiName/:recordId/attachments`
- `POST /api/integrations/zoho-sync/:moduleApiName/:recordId/attachments`
- `GET /api/integrations/zoho-sync/:moduleApiName/:recordId/related/:relatedListApiName`
