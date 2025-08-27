// controllers/teamAssignmentController.js
import TeamAssignment from '../models/TeamAssignment.js';
import User from '../models/User.js';
import Case from '../models/Case.js';

export const assignUserToCase = async (req, res) => {
  try {
    const { caseId, userId, role } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) return res.status(404).json({ error: 'Case not found' });

    const assignment = new TeamAssignment({ caseId, userId, role });
    await assignment.save();
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCaseTeam = async (req, res) => {
  try {
    const { caseId } = req.params;
    const team = await TeamAssignment.find({ caseId }).populate('userId');
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case team' });
  }
};

export const removeUserFromCase = async (req, res) => {
  try {
    const { caseId, userId } = req.body;
    await TeamAssignment.findOneAndDelete({ caseId, userId });
    res.json({ message: 'User removed from case' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove user from case' });
  }
};
