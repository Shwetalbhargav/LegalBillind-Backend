import express from 'express';
import { Case } from '../models/Case.js';
import { Client } from '../models/Client.js';
import { Invoice } from '../models/Invoice.js';
import {
  createZohoActivity,
  ensureCaseInZoho,
  ensureClientContactsInZoho,
  ensureClientInZoho,
  ensureInvoiceInZoho,
  getZohoAttachments,
  getZohoModuleFields,
  getZohoModules,
  getZohoRelatedRecords,
  listZohoActivityRecords,
  uploadZohoAttachment,
} from '../services/zohoCrmService.js';
import { linkCaseToWorkDrive } from '../services/zohoWorkDriveService.js';

const router = express.Router();

function resolveUserId(req) {
  return req.user?._id?.toString() || req.body.userId || req.query.userId;
}

router.get('/modules', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });
  try {
    const modules = await getZohoModules(userId);
    res.json({ ok: true, data: modules });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/modules/:moduleApiName/fields', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });
  try {
    const fields = await getZohoModuleFields(userId, req.params.moduleApiName);
    res.json({ ok: true, data: fields });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post('/sync/clients', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });

  const ids = Array.isArray(req.body.clientIds) && req.body.clientIds.length
    ? req.body.clientIds
    : await Client.find({}).distinct('_id');

  const results = [];
  for (const id of ids) {
    try {
      const client = await Client.findById(id);
      if (!client) continue;
      const synced = await ensureClientInZoho(userId, client);
      results.push({ ok: true, clientId: String(id), recordId: synced.recordId });
    } catch (error) {
      results.push({ ok: false, clientId: String(id), error: error.message });
    }
  }

  res.json({ ok: true, results });
});

router.post('/sync/clients/:clientId/contacts', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });
  try {
    const client = await Client.findById(req.params.clientId);
    if (!client) return res.status(404).json({ ok: false, message: 'Client not found' });
    const syncedClient = await ensureClientInZoho(userId, client);
    const contacts = await ensureClientContactsInZoho(userId, client, syncedClient.recordId);
    res.json({ ok: true, data: contacts, accountRecordId: syncedClient.recordId });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post('/sync/cases', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });

  const ids = Array.isArray(req.body.caseIds) && req.body.caseIds.length
    ? req.body.caseIds
    : await Case.find({}).distinct('_id');

  const results = [];
  for (const id of ids) {
    try {
      const matter = await Case.findById(id);
      if (!matter) continue;
      const client = await Client.findById(matter.clientId);
      const syncedClient = await ensureClientInZoho(userId, client);
      await ensureClientContactsInZoho(userId, client, syncedClient.recordId);
      const syncedMatter = await ensureCaseInZoho(userId, matter, client, syncedClient.recordId);
      results.push({
        ok: true,
        caseId: String(id),
        clientRecordId: syncedClient.recordId,
        matterRecordId: syncedMatter.recordId,
      });
    } catch (error) {
      results.push({ ok: false, caseId: String(id), error: error.message });
    }
  }

  res.json({ ok: true, results });
});

router.post('/sync/invoices', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });

  const ids = Array.isArray(req.body.invoiceIds) && req.body.invoiceIds.length
    ? req.body.invoiceIds
    : await Invoice.find({}).distinct('_id');

  const results = [];
  for (const id of ids) {
    try {
      const invoice = await Invoice.findById(id);
      if (!invoice) continue;
      const synced = await ensureInvoiceInZoho(userId, invoice);
      results.push({ ok: true, invoiceId: String(id), ...synced });
    } catch (error) {
      results.push({ ok: false, invoiceId: String(id), error: error.message });
    }
  }

  res.json({ ok: true, results });
});

router.get('/:moduleApiName/:recordId/attachments', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });
  try {
    const data = await getZohoAttachments(userId, req.params.moduleApiName, req.params.recordId);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post('/:moduleApiName/:recordId/attachments', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });
  try {
    const data = await uploadZohoAttachment(userId, req.params.moduleApiName, req.params.recordId, req.body || {});
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/:moduleApiName/:recordId/related/:relatedListApiName', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });
  try {
    const data = await getZohoRelatedRecords(
      userId,
      req.params.moduleApiName,
      req.params.recordId,
      req.params.relatedListApiName
    );
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get('/activities/:moduleApiName', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });
  try {
    const data = await listZohoActivityRecords(userId, req.params.moduleApiName, req.query || {});
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post('/activities/:moduleApiName', async (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ message: 'userId is required' });
  try {
    const data = await createZohoActivity(userId, req.params.moduleApiName, req.body || {});
    res.status(201).json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post('/workdrive/link', async (req, res) => {
  const userId = resolveUserId(req);
  const { caseId, folderId, folderUrl } = req.body || {};
  if (!userId) return res.status(401).json({ message: 'userId is required' });
  if (!caseId) return res.status(400).json({ message: 'caseId is required' });

  try {
    const linked = await linkCaseToWorkDrive(userId, caseId, { folderId, folderUrl });
    res.json({ ok: true, data: linked });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

export default router;
