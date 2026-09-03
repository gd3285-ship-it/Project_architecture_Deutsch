// Buildings Domain Server — port 3001
// Owned by the Ministry of Housing.
// Cross-domain data (assessments, municipal approvals) is fetched via domain APIs.

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllReports,
  findReportById,
  addReport,
  updateReport
} from './data/reportsStore.js';
import {
  ALL_STATUSES,
  enrichReport,
  getBudgetRequestEligibility,
  getStatusLabel,
  canReopenLocality
} from './services/businessRules.js';
import { appendAuditLog, getAuditLogsForEntity, getAllAuditLogs } from './data/auditStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Domain API base URLs — cross-domain communication via HTTP
const ASSESSMENTS_API = process.env.ASSESSMENTS_API || 'http://localhost:3004';
const MUNICIPAL_API   = process.env.MUNICIPAL_API   || 'http://localhost:3005';
const AUDIT_API       = process.env.AUDIT_API       || 'http://localhost:3001';

app.use(cors());
app.use(express.json());

// --- Cross-domain fetchers (API contracts) ---

async function fetchAssessment(buildingId) {
  try {
    const res = await fetch(`${ASSESSMENTS_API}/assessments/${buildingId}`);
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

async function fetchAuthorityApproval(buildingId) {
  try {
    const res = await fetch(`${MUNICIPAL_API}/municipal/${buildingId}`);
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

// Enrich a building report with cross-domain data fetched via APIs
async function enrichReportFull(report) {
  const [assessment, authorityApproval] = await Promise.all([
    fetchAssessment(report.id),
    fetchAuthorityApproval(report.id)
  ]);

  const enriched = enrichReport(report);
  enriched.assessment        = assessment;
  enriched.authorityApproval = authorityApproval;
  enriched.localityEligible  = canReopenLocality({ ...report, assessment, authorityApproval });

  return enriched;
}

// --- Buildings Routes ---

app.get('/reports', async (req, res) => {
  const reports = getAllReports();
  const enriched = await Promise.all(reports.map(enrichReportFull));
  res.json({ success: true, data: enriched, count: enriched.length });
});

app.post('/reports', (req, res) => {
  const { reporterName, address, damageType, description, familyEmail } = req.body;

  if (!reporterName || !address || !damageType || !description) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: reporterName, address, damageType, description'
    });
  }

  const newReport = addReport({
    id: uuidv4(),
    reporterName,
    address,
    damageType,
    description,
    status: 'NEW',
    hasDamagePhotos: false,
    hasEngineerReport: false,
    eligibilityCheckCompleted: false,
    hasBudgetRequest: false,
    apartmentCount: 0,
    socialApproval: false,
    familyEmail: familyEmail || '',
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    data: enrichReport(newReport),
    message: 'Report created successfully'
  });
});

app.get('/reports/:id', async (req, res) => {
  const report = findReportById(req.params.id);
  if (!report) {
    return res.status(404).json({ success: false, error: 'Report not found' });
  }
  const enriched = await enrichReportFull(report);
  res.json({ success: true, data: enriched });
});

app.patch('/reports/:id/status', (req, res) => {
  const { status, userId, userName } = req.body;

  if (!status || !ALL_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${ALL_STATUSES.join(', ')}`
    });
  }

  const report = updateReport(req.params.id, { status });
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

  // Audit log — only if user context provided
  if (userId && userName) {
    const statusLabel = getStatusLabel(status);
    appendAuditLog({
      userId,
      userName,
      action: `עדכון סטטוס מבנה ל: ${statusLabel}`,
      entityType: 'building',
      entityId: req.params.id
    });
  }

  res.json({ success: true, data: enrichReport(report), message: 'Status updated successfully' });
});

app.post('/reports/:id/budget-request', (req, res) => {
  const report = findReportById(req.params.id);
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

  const eligibility = getBudgetRequestEligibility(report);
  if (!eligibility.canOpen) {
    return res.status(400).json({
      success: false,
      error: `לא ניתן לפתוח בקשת תקציב: ${eligibility.missing.join(' · ')}`
    });
  }

  const updated = updateReport(req.params.id, { hasBudgetRequest: true });

  // Audit log — only if user context provided
  const { userId, userName } = req.body || {};
  if (userId && userName) {
    appendAuditLog({
      userId,
      userName,
      action: 'פתיחת בקשת תקציב',
      entityType: 'budget-request',
      entityId: req.params.id
    });
  }

  res.json({ success: true, data: enrichReport(updated), message: 'Budget request opened successfully' });
});

// --- Assessment proxy — delegates to Assessments Domain ---

app.get('/reports/:id/assessment', async (req, res) => {
  const assessment = await fetchAssessment(req.params.id);
  res.json({ success: true, data: assessment });
});

app.post('/reports/:id/assessment', async (req, res) => {
  try {
    const response = await fetch(`${ASSESSMENTS_API}/assessments/${req.params.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const result = await response.json();

    // Audit log on success — only if user context provided
    if (result.success && req.body.userId && req.body.userName) {
      appendAuditLog({
        userId: req.body.userId,
        userName: req.body.userName,
        action: `עדכון הערכת שמאי — חומרה: ${req.body.severity || ''}`,
        entityType: 'assessment',
        entityId: req.params.id
      });
    }

    res.status(response.status).json(result);
  } catch {
    res.status(503).json({ success: false, error: 'Assessments domain unavailable' });
  }
});

// --- Authority approval proxy — delegates to Municipal Domain ---

app.get('/reports/:id/authority-approval', async (req, res) => {
  const approval = await fetchAuthorityApproval(req.params.id);
  res.json({ success: true, data: approval });
});

app.post('/reports/:id/authority-approval', async (req, res) => {
  try {
    const response = await fetch(`${MUNICIPAL_API}/municipal/${req.params.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const result = await response.json();

    // Audit log on success — only if user context provided
    if (result.success && req.body.userId && req.body.userName) {
      const approvedLabel = req.body.approved ? 'אושר' : 'לא אושר';
      appendAuditLog({
        userId: req.body.userId,
        userName: req.body.userName,
        action: `אישור רשות מקומית — ${approvedLabel}`,
        entityType: 'authority-approval',
        entityId: req.params.id
      });
    }

    res.status(response.status).json(result);
  } catch {
    res.status(503).json({ success: false, error: 'Municipal domain unavailable' });
  }
});

// --- Audit Log Routes ---

// GET /audit/:entityId — get audit logs for a specific building
app.get('/audit/:entityId', (req, res) => {
  const logs = getAuditLogsForEntity(req.params.entityId);
  res.json({ success: true, data: logs });
});

// GET /audit — get all audit logs
app.get('/audit', (req, res) => {
  const logs = getAllAuditLogs();
  res.json({ success: true, data: logs });
});

app.get('/health', (req, res) => {
  res.json({ status: 'Buildings Domain Server is running' });
});

app.use(express.static(path.join(__dirname, '../frontend')));

app.listen(PORT, () => {
  console.log(`✅ Buildings Domain Server (Ministry of Housing) running on http://localhost:${PORT}`);
  console.log(`   Cross-domain: Assessments → ${ASSESSMENTS_API}`);
  console.log(`   Cross-domain: Municipal   → ${MUNICIPAL_API}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error('❌ Buildings Domain Server failed to start:', err.message);
  }
  process.exit(1);
});
