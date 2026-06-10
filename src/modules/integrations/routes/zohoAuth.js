import express from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { buildZohoAuthUrl, decodeZohoState, exchangeZohoCode, getZohoConfig, getValidZohoConnection, saveZohoConnection } from '../services/zohoAuthService.js';
import { fetchZohoCurrentUser } from '../services/zohoCrmService.js';

const router = express.Router();

export function zohoConnectHandler(req, res) {
  const userId = req.user?.id || req.user?._id?.toString();
  if (!userId) {
    return res.status(401).send('User must be logged in to connect Zoho.');
  }
  res.redirect(buildZohoAuthUrl(userId));
}

export function zohoConnectUrlHandler(req, res) {
  const userId = req.user?.id || req.user?._id?.toString();
  if (!userId) {
    return res.status(401).json({ ok: false, message: 'User must be logged in to connect Zoho.' });
  }
  res.json({ ok: true, url: buildZohoAuthUrl(userId) });
}

export async function zohoCallbackHandler(req, res) {
  const { code, state, location, 'accounts-server': accountsServer } = req.query;
  if (!code || !state || !accountsServer) {
    return res.status(400).send('Missing code, state, or accounts-server.');
  }

  try {
    const userId = decodeZohoState(state);
    const tokenData = await exchangeZohoCode({
      code,
      accountsServer,
    });
    await saveZohoConnection(userId, {
      ...tokenData,
      location,
      accountsServer,
    });
    res.send('<h3>Zoho connected successfully</h3><p>You can close this window and return to BillSync.</p>');
  } catch (error) {
    console.error('[Zoho callback]', error.response?.data || error.message);
    res.status(500).send('<h3>Zoho connection failed</h3><p>Check the server logs for the full error details.</p>');
  }
}

export async function zohoStatusHandler(req, res) {
  const userId = req.user?.id || req.user?._id?.toString();
  if (!userId) {
    return res.status(401).json({ connected: false, reason: 'not_logged_in' });
  }

  try {
    const connection = await getValidZohoConnection(userId);
    const me = await fetchZohoCurrentUser(userId).catch(() => null);
    res.json({
      connected: true,
      accountsServer: connection.accountsServer,
      apiDomain: connection.apiDomain,
      scopes: connection.scopes,
      zohoUser: me,
    });
  } catch (error) {
    const code = error.code === 'ZOHO_NOT_CONNECTED' ? 404 : 500;
    res.status(code).json({
      connected: false,
      reason: error.code || 'unknown_error',
      message: error.message,
      connectUrl: `${getZohoConfig().accountsServer}/oauth/v2/auth`,
    });
  }
}

router.get('/connect', authenticate, zohoConnectHandler);
router.get('/connect-url', authenticate, zohoConnectUrlHandler);
router.get('/callback', zohoCallbackHandler);
router.get('/status', authenticate, zohoStatusHandler);

export default router;
