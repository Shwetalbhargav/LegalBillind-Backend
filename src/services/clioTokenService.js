import axios from 'axios';
import { Types } from 'mongoose';
import ClioToken from '../models/clioToken.js';

export async function saveOrUpdateToken(userId, { access_token, refresh_token, expires_in }) {
  const id = new Types.ObjectId(userId);
  const expiresAt = new Date(Date.now() + Math.max((expires_in ?? 0) - 60, 0) * 1000);
  await ClioToken.findOneAndUpdate(
    { userId: id },
    { accessToken: access_token, refreshToken: refresh_token, expiresAt },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function getAccessToken(userId) {
  const id = new Types.ObjectId(userId);
  const tokenDoc = await ClioToken.findOne({ userId: id });
  if (!tokenDoc) throw new Error(`No token found for user ${userId}`);

  if (new Date() < tokenDoc.expiresAt) return tokenDoc.accessToken;

  // refresh
  const res = await axios.post(
    'https://app.clio.com/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenDoc.refreshToken,
      client_id: process.env.CLIO_CLIENT_ID,
      client_secret: process.env.CLIO_CLIENT_SECRET,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const expiresAt = new Date(Date.now() + (res.data.expires_in ?? 0) * 1000);
  await ClioToken.findOneAndUpdate(
    { userId: id },
    { accessToken: res.data.access_token, refreshToken: res.data.refresh_token, expiresAt }
  );

  return res.data.access_token;
}
