// Municipal Domain Server — port 3005
// Owned by the Local Authorities team.
// External domains must use this API — direct data access is prohibited.

import express from 'express';
import cors from 'cors';
import { getApproval, saveApproval } from './data/municipalStore.js';
import { buildApproval } from './services/municipalRules.js';

const app = express();
const PORT = 3005;

app.use(cors());
app.use(express.json());

// GET /municipal/:buildingId — fetch authority approval for a building
app.get('/municipal/:buildingId', (req, res) => {
  const approval = getApproval(req.params.buildingId);
  res.json({ success: true, data: approval });
});

// POST /municipal/:buildingId — save/update authority approval for a building
app.post('/municipal/:buildingId', (req, res) => {
  const approval = buildApproval(req.body);
  saveApproval(req.params.buildingId, approval);
  res.status(201).json({ success: true, data: approval });
});

app.get('/health', (req, res) => {
  res.json({ status: 'Municipal Domain Server is running' });
});

app.listen(PORT, () => {
  console.log(`✅ Municipal Domain Server running on http://localhost:${PORT}`);
  console.log(`   GET  /municipal/:buildingId`);
  console.log(`   POST /municipal/:buildingId`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error('❌ Municipal Domain Server failed to start:', err.message);
  }
  process.exit(1);
});
