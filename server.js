import dotenv from 'dotenv';
dotenv.config();

import http from 'http';

// 🔎 PROVE which app is loaded at runtime
console.log('BOOT: importing ./src/app.js from', process.cwd());

import app from './src/app.js';

const PORT = process.env.PORT || 5000;
http.createServer(app).listen(PORT, () => {
  console.log(`🚀 HTTP server listening on :${PORT}`);
});
