import 'dotenv/config.js';
import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import inviteRoutes from './routes/invites.js';
import { inviteDb } from './database.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key, ngrok-skip-browser-warning');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(express.json());

// Routes
app.use('/api', inviteRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  const stats = inviteDb.getInviteStats();
  res.json({
    status: 'ok',
    invites: {
      total: stats.total,
      used: stats.used,
      pending: stats.pending,
      available: stats.available,
    },
  });
});

// Start HTTPS server
const certPath = path.join(process.cwd(), 'selfsigned.crt');
const keyPath = path.join(process.cwd(), 'selfsigned.key');

try {
  const cert = fs.readFileSync(certPath, 'utf8');
  const key = fs.readFileSync(keyPath, 'utf8');

  const httpsOptions = {
    cert,
    key,
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Invitation Service running on https://localhost:${PORT}`);
    console.log(`API endpoints:`);
    console.log(`  POST /api/addInvite - Add new invite (secret + address, verified on-chain)`);
    console.log(`  GET  /api/getInvite - Get next available invite`);
    console.log(`  POST /api/checkInvite - Check and mark invite as used`);
  });
} catch (error) {
  console.error('Error loading SSL certificates:', error);
  console.log('Falling back to HTTP server...');

  app.listen(PORT, () => {
    console.log(`Invitation Service running on http://localhost:${PORT}`);
    console.log(`API endpoints:`);
    console.log(`  POST /api/addInvite - Add new invite (secret + address, verified on-chain)`);
    console.log(`  GET  /api/getInvite - Get next available invite`);
    console.log(`  POST /api/checkInvite - Check and mark invite as used`);
  });
}
