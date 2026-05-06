export const generateBillableSummary = async ({ subject, body }) => {
  if (!body || typeof body !== 'string') return 'Drafted and sent an email.';
  return `Drafted and sent an email regarding "${subject}". Preview: ${body.substring(0, 60)}...`;
};
