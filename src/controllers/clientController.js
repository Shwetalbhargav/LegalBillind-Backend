import Client from '../models/Client.js';
import Case from '../models/Case.js';
import Billable from '../models/Billable.js';
import Invoice from '../models/Invoice.js';

// GET /clients  -> list for dashboard table
export const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find()
      .select('name email phone contactInfo createdAt accountManagerId')
      .populate('accountManagerId', 'name email'); // <— populate for UI
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
};

// GET /clients/:clientId/dashboard  -> single client + related objects
export const getClientDashboard = async (req, res) => {
  const { clientId } = req.params;
  try {
    const [client, cases, billables, invoices] = await Promise.all([
      Client.findById(clientId)
        .populate('accountManagerId', 'name email')
        .lean(),

      // Case list for this client (include case type fields)
      Case.find({ clientId })
        .select('name case_type case_type_id status createdAt')
        .sort({ createdAt: -1 })
        .lean(),

      // Billables (include case info so FE can show/filter by type)
      Billable.find({ clientId })
        .populate({ path: 'caseId', select: 'name case_type case_type_id status' })
        .populate('userId', 'name email')
        .sort({ date: -1 })
        .lean(),

      // Invoices (include case info so FE can show/filter by type)
      Invoice.find({ clientId })
        .populate({ path: 'caseId', select: 'name case_type case_type_id status' })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    if (!client) return res.status(404).json({ error: 'Client not found' });

    res.json({ client, cases, billables, invoices });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load client dashboard' });
  }
};


// POST /clients/create
export const createClient = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      contactInfo,        // optional legacy field — keep if you still use it anywhere
      firmId,
      accountManagerId,   // optional
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    // If contactInfo wasn’t sent but email was, keep them aligned for backwards-compat
    const doc = new Client({
      name,
      email: email ?? null,
      phone: phone ?? null,
      contactInfo: contactInfo ?? email ?? null,
      firmId: firmId || undefined,
      accountManagerId: accountManagerId || undefined,
    });

    await doc.save();
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create client' });
  }
};

// PUT /clients/:clientId/update
export const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Whitelist allowed fields so we don’t accidentally set unknown keys
    const allowed = ['name', 'email', 'phone', 'contactInfo', 'firmId', 'accountManagerId'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    // Keep contactInfo aligned if only email changed
    if (updates.email !== undefined && updates.contactInfo === undefined) {
      updates.contactInfo = updates.email;
    }

    const client = await Client.findByIdAndUpdate(clientId, updates, { new: true });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update client' });
  }
};

// DELETE /clients/:clientId/delete
export const deleteClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const deleted = await Client.findByIdAndDelete(clientId);
    if (!deleted) return res.status(404).json({ error: 'Client not found' });

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
};
