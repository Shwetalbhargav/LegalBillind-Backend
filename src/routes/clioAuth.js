// src/routes/clioAuth.js

import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import qs from 'qs';
import { saveOrUpdateToken, getAccessToken  } from '../services/clioTokenService.js';

dotenv.config();

const router = express.Router();

const {
  CLIO_CLIENT_ID,
  CLIO_CLIENT_SECRET,
  CLIO_REDIRECT_URI,
  CLIO_MATTER_ID
} = process.env;

// Step 1: Start OAuth flow — redirect to Clio
router.get('/connect-clio', (req, res) => {
  if (!req.user?._id) {
    return res.status(401).send('User must be logged in to connect Clio.');
  }

  const redirectUri = encodeURIComponent(CLIO_REDIRECT_URI);
  const state = encodeURIComponent(req.user._id.toString()); // pass Mongo userId

  const authUrl =
    `https://app.clio.com/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${CLIO_CLIENT_ID}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=all` +
    `&state=${state}`;

  res.redirect(authUrl);
});

// Step 2: OAuth callback from Clio
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  const userId = req.query.state; // Mongo _id passed from /connect-clio

  if (!code || !userId) {
    return res.status(400).send('Missing code or userId.');
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://app.clio.com/oauth/token',
      qs.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: CLIO_CLIENT_ID,
        client_secret: CLIO_CLIENT_SECRET,
        redirect_uri: CLIO_REDIRECT_URI
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Save tokens for this user
    await saveOrUpdateToken(userId, {
      access_token,
      refresh_token,
      expires_in
    });

    // Optional: set default matter id for this user
    if (CLIO_MATTER_ID) {
      await saveOrUpdateToken(userId, {
        access_token,
        refresh_token,
        expires_in,
        defaultMatterId: CLIO_MATTER_ID
      });
    }

    res.send(`
      <h3>✅ Clio connected successfully for user ${userId}</h3>
      <pre>${JSON.stringify(tokenResponse.data, null, 2)}</pre>
    `);
  } catch (err) {
    console.error('❌ Token exchange failed:', err.response?.status, err.response?.statusText, err.response?.data || err.message);
    res.status(500).send(`
      <h3>❌ Token exchange failed</h3>
      <pre>Status: ${err.response?.status} ${err.response?.statusText}</pre>
      <pre>${JSON.stringify(err.response?.data || err.message, null, 2)}</pre>
      <pre>${err.stack}</pre>
    `);
  }
});

// GET /clio/status
router.get('/status', async (req, res) => {
  try {
    // Ensure the user is logged in
    if (!req.user?._id) {
      return res.status(401).json({
        connected: false,
        reason: 'not_logged_in'
      });
    }

    const userId = req.user._id.toString();

    let accessToken;
    try {
      // This will also refresh the token if expired
      accessToken = await getAccessToken(userId);
    } catch (err) {
      console.error('Error getting Clio access token:', err.message);
      return res.status(200).json({
        connected: false,
        reason: 'no_token'
      });
    }

    if (!accessToken) {
      return res.status(200).json({
        connected: false,
        reason: 'no_token'
      });
    }

    // Simple test call: who am I in Clio
    const whoRes = await axios.get(
      'https://app.clio.com/api/v4/users/who_am_i',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const data = whoRes.data?.data || whoRes.data || {};

    return res.json({
      connected: true,
      clioUser: {
        id: data.id,
        name: data.name,
        email: data.email,
        // these may or may not exist, so we guard them
        tenant: data.tenant?.name ?? null,
        account_type: data.account_type ?? null
      },
      raw: data // keep for debugging in UI; remove later if you want
    });
  } catch (err) {
    console.error('Error checking Clio status:', err?.response?.data || err.message);

    // Clio token invalid / revoked
    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(200).json({
        connected: false,
        reason: 'invalid_or_revoked_token'
      });
    }

    return res.status(500).json({
      connected: false,
      reason: 'server_error'
    });
  }
});


export default router;
