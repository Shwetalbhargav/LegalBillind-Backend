import axios from 'axios';
import { Types } from 'mongoose';
import ClioToken from '../models/clioToken.js';

const {
  CLIO_CLIENT_ID,
  CLIO_CLIENT_SECRET,
} = process.env;

/**
 * Upsert Clio token information for a user.
 * Supports optional defaultMatterId so it can be used later when creating time entries.
 */
export async function saveOrUpdateToken(
  userId,
  { access_token, refresh_token, expires_in, defaultMatterId }
) {
  const id = new Types.ObjectId(userId);

  // Refresh a little before the actual expiry to avoid race conditions.
  const now = Date.now();
  const ttlSeconds = Math.max((expires_in ?? 0) - 60, 0);
  const expiresAt = new Date(now + ttlSeconds * 1000);

  const update = {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt,
  };

  // Persist defaultMatterId if provided (ensure your ClioToken schema has this field)
  if (defaultMatterId) {
    update.defaultMatterId = defaultMatterId;
  }

  await ClioToken.findOneAndUpdate(
    { userId: id },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Get a valid Clio access token for the given user.
 * - Returns existing token if not expired.
 * - Otherwise refreshes using the refresh token and updates the DB.
 * - Throws specific error codes so callers can react (no token vs invalid/expired token).
 */
export async function getAccessToken(userId) {
  const id = new Types.ObjectId(userId);
  const tokenDoc = await ClioToken.findOne({ userId: id });

  if (!tokenDoc) {
    const err = new Error(`No token found for user ${userId}`);
    err.code = 'CLIO_NO_TOKEN';
    throw err;
  }

  if (tokenDoc.expiresAt && new Date() < tokenDoc.expiresAt) {
    return tokenDoc.accessToken;
  }

  // Token expired — refresh using refresh_token
  try {
    const res = await axios.post(
      'https://app.clio.com/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenDoc.refreshToken,
        client_id: CLIO_CLIENT_ID,
        client_secret: CLIO_CLIENT_SECRET,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    // Again refresh slightly early
    const ttlSeconds = Math.max((res.data.expires_in ?? 0) - 60, 0);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await ClioToken.findOneAndUpdate(
      { userId: id },
      {
        accessToken: res.data.access_token,
        // Some OAuth servers don't rotate refresh tokens every time; fall back if missing
        refreshToken: res.data.refresh_token ?? tokenDoc.refreshToken,
        expiresAt,
      }
    );

    return res.data.access_token;
  } catch (err) {
    // Map Clio's "invalid_grant" to a clear error code for callers
    if (err.response?.data?.error === 'invalid_grant') {
      const invalidErr = new Error('Clio refresh token invalid or revoked');
      invalidErr.code = 'CLIO_INVALID_REFRESH_TOKEN';
      throw invalidErr;
    }

    throw err;
  }
}
