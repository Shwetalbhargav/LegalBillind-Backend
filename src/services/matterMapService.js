// services/matterMapService.js

/**
 * Map a recipient's email to a Clio Matter ID
 * For MVP, this is a static map. Later, we can fetch from DB or Clio API.
 */
export async function mapRecipientToMatter(recipientEmail, userId) {
  // Trim and lowercase for consistent matching
  const cleanEmail = recipientEmail.trim().toLowerCase();

  // Example static mapping for MVP
  const matterMap = {
    'bhargavkshah@yahoo.com': '1722348233',          // example matter id
    'purav1510@gmail.com': '1722348233',
    'shwetal_gandhi@yahoo.co.in': '1722348233'
  };
  if (matterMap[cleanEmail]) return matterMap[cleanEmail];
  if (process.env.CLIO_MATTER_ID) return process.env.CLIO_MATTER_ID;
  console.warn('[Clio mapping] No matter found for', cleanEmail);
  return null;

}
