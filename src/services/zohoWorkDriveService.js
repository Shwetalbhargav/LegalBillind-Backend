import { Case } from '../models/Case.js';
import { getValidZohoConnection } from './zohoAuthService.js';

export async function linkCaseToWorkDrive(userId, caseId, { folderId, folderUrl }) {
  await getValidZohoConnection(userId);
  const matter = await Case.findById(caseId);
  if (!matter) {
    throw new Error('Case not found');
  }

  matter.integrations = {
    ...(matter.integrations || {}),
    zoho: {
      ...(matter.integrations?.zoho || {}),
      workdriveFolderId: folderId || matter.integrations?.zoho?.workdriveFolderId,
      workdriveFolderUrl: folderUrl || matter.integrations?.zoho?.workdriveFolderUrl,
      lastSyncedAt: new Date(),
    },
  };
  await matter.save();
  return matter.integrations.zoho;
}
