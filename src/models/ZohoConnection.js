import mongoose from 'mongoose';

const ZohoConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    location: { type: String, default: 'us' },
    accountsServer: { type: String, required: true },
    apiDomain: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    tokenType: { type: String, default: 'Bearer' },
    accessTokenExpiresAt: { type: Date, required: true },
    scopes: { type: [String], default: [] },
    teamFolderId: { type: String },
    teamFolderUrl: { type: String },
    crmModules: {
      clients: { type: String, default: 'Accounts' },
      matters: { type: String, default: 'Deals' },
    },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const ZohoConnection = mongoose.model('ZohoConnection', ZohoConnectionSchema);

export default ZohoConnection;
