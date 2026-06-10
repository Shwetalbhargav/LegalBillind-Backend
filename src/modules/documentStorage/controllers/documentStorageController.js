import { StoredDocument } from '../models/StoredDocument.js';
import { Case } from '../../cases/models/Case.js';

const idString = (value) => (value === undefined || value === null ? '' : String(value._id || value));
const managerRoles = ['admin', 'partner'];

const canManageAll = (req) => managerRoles.includes(String(req.user?.role || '').toLowerCase());

const caseHasAssignedUser = (caseDoc, userId) => {
  const assignedUsers = Array.isArray(caseDoc?.assignedUsers) ? caseDoc.assignedUsers : [];
  if (assignedUsers.some((assignedUserId) => idString(assignedUserId) === String(userId))) return true;
  return ['leadPartnerId', 'managingLawyerId', 'primaryLawyerId']
    .some((field) => idString(caseDoc?.[field]) === String(userId));
};

const populateDocument = (query) =>
  query
    .populate('caseId', 'title name status')
    .populate('clientId', 'displayName name')
    .populate('uploadedBy', 'name email role');

const audit = (action, req, changes, note) => ({
  action,
  actorId: req.user?.id,
  at: new Date(),
  ...(changes ? { changes } : {}),
  ...(note ? { note } : {}),
});

const cleanTags = (tags = []) => (
  Array.isArray(tags)
    ? tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 20)
    : []
);

async function assertMatterAccess({ caseId, clientId }, req, res) {
  const caseDoc = await Case.findById(caseId).select('clientId assignedUsers leadPartnerId managingLawyerId primaryLawyerId');
  if (!caseDoc) {
    res.status(400).json({ ok: false, message: 'caseId does not reference an existing matter' });
    return null;
  }
  if (String(caseDoc.clientId) !== String(clientId)) {
    res.status(400).json({ ok: false, message: 'clientId must match the selected matter client' });
    return null;
  }
  if (!canManageAll(req) && !caseHasAssignedUser(caseDoc, req.user?.id)) {
    res.status(403).json({ ok: false, message: 'You can only access documents for assigned matters' });
    return null;
  }
  return caseDoc;
}

const allowedPatchFields = [
  'title',
  'documentType',
  'provider',
  'storageKey',
  'originalFileName',
  'mimeType',
  'sizeBytes',
  'checksumSha256',
  'externalUrl',
  'status',
  'description',
];

export const DocumentStorageController = {
  async list(req, res) {
    try {
      const q = {};
      for (const field of ['caseId', 'clientId', 'provider', 'status', 'documentType', 'uploadedBy']) {
        if (req.query[field]) q[field] = req.query[field];
      }
      if (req.query.from || req.query.to) {
        q.createdAt = {};
        if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
        if (req.query.to) q.createdAt.$lte = new Date(req.query.to);
      }
      if (!canManageAll(req) && !req.query.caseId) q.uploadedBy = req.user?.id;
      if (req.query.caseId) {
        const caseDoc = await Case.findById(req.query.caseId).select('clientId assignedUsers leadPartnerId managingLawyerId primaryLawyerId');
        if (caseDoc && !canManageAll(req) && !caseHasAssignedUser(caseDoc, req.user?.id)) {
          return res.status(403).json({ ok: false, message: 'You can only access documents for assigned matters' });
        }
      }
      const rows = await populateDocument(StoredDocument.find(q))
        .sort({ createdAt: -1 })
        .limit(200);
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async create(req, res) {
    try {
      const caseDoc = await assertMatterAccess(req.body, req, res);
      if (!caseDoc) return;

      const doc = await StoredDocument.create({
        title: req.body.title,
        caseId: req.body.caseId,
        clientId: req.body.clientId,
        documentType: req.body.documentType || 'other',
        provider: req.body.provider || 'local',
        storageKey: req.body.storageKey,
        originalFileName: req.body.originalFileName,
        mimeType: req.body.mimeType,
        sizeBytes: req.body.sizeBytes,
        checksumSha256: req.body.checksumSha256,
        externalUrl: req.body.externalUrl,
        status: req.body.provider && req.body.provider !== 'local' ? 'linked' : 'stored',
        tags: cleanTags(req.body.tags),
        description: req.body.description,
        uploadedBy: req.user.id,
        auditTrail: [audit('created', req, { provider: req.body.provider || 'local', storageKey: req.body.storageKey })],
      });

      const populated = await populateDocument(StoredDocument.findById(doc._id));
      res.status(201).json({ ok: true, data: populated });
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ ok: false, message: 'A document with this provider/storageKey already exists' });
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async getById(req, res) {
    try {
      const doc = await populateDocument(StoredDocument.findById(req.params.documentId));
      if (!doc) return res.status(404).json({ ok: false, message: 'Document not found' });
      const caseDoc = await assertMatterAccess({ caseId: doc.caseId, clientId: doc.clientId }, req, res);
      if (!caseDoc) return;
      doc.lastAccessedAt = new Date();
      await doc.save();
      res.json({ ok: true, data: doc });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const doc = await StoredDocument.findById(req.params.documentId);
      if (!doc) return res.status(404).json({ ok: false, message: 'Document not found' });
      const caseDoc = await assertMatterAccess({ caseId: doc.caseId, clientId: doc.clientId }, req, res);
      if (!caseDoc) return;
      if (!canManageAll(req) && idString(doc.uploadedBy) !== req.user?.id) {
        return res.status(403).json({ ok: false, message: 'Only managers or the uploader can edit document metadata' });
      }

      const changes = {};
      for (const field of allowedPatchFields) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          changes[field] = req.body[field] || undefined;
          doc[field] = req.body[field] || undefined;
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'tags')) doc.tags = cleanTags(req.body.tags);
      if (doc.status === 'archived' && !doc.archivedAt) doc.archivedAt = new Date();
      if (doc.status === 'deleted' && !doc.deletedAt) doc.deletedAt = new Date();
      doc.auditTrail.push(audit('updated', req, changes));
      await doc.save();

      const populated = await populateDocument(StoredDocument.findById(doc._id));
      res.json({ ok: true, data: populated });
    } catch (err) {
      if (err?.code === 11000) return res.status(409).json({ ok: false, message: 'A document with this provider/storageKey already exists' });
      res.status(400).json({ ok: false, message: err.message });
    }
  },

  async setStatus(req, res) {
    try {
      const doc = await StoredDocument.findById(req.params.documentId);
      if (!doc) return res.status(404).json({ ok: false, message: 'Document not found' });
      const caseDoc = await assertMatterAccess({ caseId: doc.caseId, clientId: doc.clientId }, req, res);
      if (!caseDoc) return;
      doc.status = req.body.status;
      if (doc.status === 'archived') doc.archivedAt = new Date();
      if (doc.status === 'deleted') doc.deletedAt = new Date();
      doc.auditTrail.push(audit(`status:${req.body.status}`, req, { status: req.body.status }, req.body.note));
      await doc.save();
      const populated = await populateDocument(StoredDocument.findById(doc._id));
      res.json({ ok: true, data: populated });
    } catch (err) {
      res.status(400).json({ ok: false, message: err.message });
    }
  },
};
