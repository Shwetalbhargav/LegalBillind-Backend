import Case from '../models/Case.js';

// CREATE
export const createCase = async (req, res) => {
  try {
    const newCase = new Case(req.body);
    const saved = await newCase.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case' });
  }
};

// READ
export const getAllCases = async (req, res) => {
  try {
    const cases = await Case.find()
    .populate('clientId', 'name')
    .populate('assignedUsers', 'name')
     .populate('primaryLawyerId', 'name');
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
};

// DASHBOARD-LIKE SINGLE FETCH
export const getCaseById = async (req, res) => {
  try {
    const caseItem = await Case.findById(req.params.caseId).populate('clientId');
    if (!caseItem) return res.status(404).json({ error: 'Case not found' });
    res.json(caseItem);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
};

// UPDATE
export const updateCase = async (req, res) => {
  try {
    const updated = await Case.findByIdAndUpdate(req.params.caseId, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update case' });
  }
};

// DELETE
export const deleteCase = async (req, res) => {
  try {
    const removed = await Case.findByIdAndDelete(req.params.caseId);
    if (!removed) return res.status(404).json({ error: 'Case not found' });
    res.json({ message: 'Case deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete case' });
  }
};
