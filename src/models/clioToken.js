// src/models/clioToken.js

import mongoose , { Schema, Types }from 'mongoose';

const clioTokenSchema = new mongoose.Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  defaultMatterId: { type: String }
}, {
  timestamps: true
});

const ClioToken = mongoose.model('ClioToken', clioTokenSchema);
export default ClioToken;