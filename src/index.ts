import 'dotenv/config.js';
import express from 'express';
import inviteRoutes from './routes/invites.js';
import { inviteDb } from './database.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');

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

// Start server
app.listen(PORT, () => {
  console.log(`Invitation Service running on port ${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  POST /api/addInvite - Add new invite (requires x-api-key header)`);
  console.log(`  GET  /api/getInvite - Get next available invite`);
  console.log(`  POST /api/checkInvite - Check and mark invite as used`);
});
