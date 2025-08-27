
import fs from 'fs';
import dotenv from 'dotenv';
import app from './src/app.js';
import http from 'http';  

dotenv.config();

const PORT = process.env.PORT || 5000;


http.createServer(app).listen(PORT, () => {
  console.log(`🚀 HTTP Server running at http://127.0.0.1:${PORT}`);
});
