// Assessments Domain Server — port 3004
// Owned by the Appraisers team.
// External domains must use this API — direct data access is prohibited.

import express from 'express';
import cors from 'cors';
import { getAssessment, saveAssessment } from './data/assessmentsStore.js';
import { validateAssessment } from './services/assessmentRules.js';

const app = express();
const PORT = 3004;

app.use(cors());
app.use(express.json());

// GET /assessments/:buildingId — fetch assessment for a building
app.get('/assessments/:buildingId', (req, res) => {
  const assessment = getAssessment(req.params.buildingId);
  res.json({ success: true, data: assessment });
});

// POST /assessments/:buildingId — save/update assessment for a building
app.post('/assessments/:buildingId', (req, res) => {
  const { severity, notes, inspectionDate, followUpRequired } = req.body;

  const validation = validateAssessment({ severity, inspectionDate });
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const assessment = {
    severity,
    notes: notes || '',
    inspectionDate,
    followUpRequired: !!followUpRequired,
    createdAt: new Date().toISOString()
  };

  saveAssessment(req.params.buildingId, assessment);
  res.status(201).json({ success: true, data: assessment });
});

app.get('/health', (req, res) => {
  res.json({ status: 'Assessments Domain Server is running' });
});

app.listen(PORT, () => {
  console.log(`✅ Assessments Domain Server running on http://localhost:${PORT}`);
  console.log(`   GET  /assessments/:buildingId`);
  console.log(`   POST /assessments/:buildingId`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error('❌ Assessments Domain Server failed to start:', err.message);
  }
  process.exit(1);
});
