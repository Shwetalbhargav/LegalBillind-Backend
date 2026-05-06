import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './src/app.js';
import connectDB from './src/config/db.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  http.createServer(app).listen(PORT, () => {
    console.log(`HTTP server listening on :${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
