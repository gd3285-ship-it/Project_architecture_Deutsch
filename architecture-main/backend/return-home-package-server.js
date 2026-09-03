import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { generateReturnHomePackage } from './services/returnHomePackageService.js';
import { createProcess, completeProcess, getAllProcesses } from './data/settlementProcessStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;
const MAIN_API_BASE = process.env.MAIN_API_BASE || 'http://localhost:3001';
const NOTIFICATION_API_BASE = process.env.NOTIFICATION_API_BASE || 'http://localhost:3003';

app.use(cors());
app.use(express.json());
app.use('/generated', express.static(path.join(__dirname, 'generated')));

async function fetchBuildingReport(buildingId) {
  const response = await fetch(`${MAIN_API_BASE}/reports/${buildingId}`);
  if (!response.ok) return null;
  const result = await response.json();
  return result.success ? result.data : null;
}

const MAX_ATTEMPTS = 3;

async function sendNotification(report) {
  if (!report.familyEmail) return;

  const idempotencyKey = uuidv4(); // מזהה ייחודי לכל הפקת תיק — אחד לכל הניסיונות

  const payload = {
    idempotencyKey,
    buildingId: report.id,
    email: report.familyEmail,
    subject: `אישור חזרה לבית ${report.address}`,
    body: `שלום,\nאנו שמחים לעדכן כי המבנה שלכם אושר לחזרה לבית.\nתיק האכלוס הוכן בהצלחה.\nבברכה,\nמשרד הבינוי והשיכון`
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${NOTIFICATION_API_BASE}/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.data?.status === 'SENT') {
        return; // הצליח — עוצר מיד
      }
    } catch {
      // קישור נסגר או timeout — ממשיך לניסיון הבא
    }
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'Return Home Package Service is running' });
});

// GET /settlement-processes — list all settlement re-occupancy processes (newest first)
app.get('/settlement-processes', (req, res) => {
  try {
    res.json({ success: true, data: getAllProcesses() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// הפקה מרוכזת עבור מספר מבנים לפי רשימת IDs
app.post('/buildings/batch/return-home-packages', async (req, res) => {
  const { ids, settlementName, startedBy } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'יש לספק רשימת מזהים' });
  }

  if (!settlementName || !settlementName.trim()) {
    return res.status(400).json({ success: false, error: 'שדה settlementName חסר או ריק' });
  }
  if (!startedBy || !startedBy.trim()) {
    return res.status(400).json({ success: false, error: 'שדה startedBy חסר או ריק' });
  }

  // --- Process Initiation ---
  const process = createProcess(settlementName, startedBy);

  const results = [];
  const errors = [];

  for (const id of ids) {
    let report;
    try {
      report = await fetchBuildingReport(id);
    } catch {
      errors.push({ id, error: 'לא ניתן להתחבר לשירות הדיווחים' });
      continue;
    }

    if (!report) {
      errors.push({ id, error: 'מבנה לא נמצא' });
      continue;
    }

    try {
      const result = await generateReturnHomePackage(report);
      results.push({
        id,
        url: `http://localhost:${PORT}${result.url}`,
        fileName: result.fileName
      });
      await sendNotification(report);
    } catch (error) {
      errors.push({ id, error: error.message });
    }
  }

  // --- Process Completion ---
  completeProcess(process.id);

  res.status(200).json({
    success: true,
    generated: results,
    errors,
    count: results.length
  });
});

app.post('/buildings/:id/return-home-package', async (req, res) => {
  let report;

  try {
    report = await fetchBuildingReport(req.params.id);
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: 'Unable to reach main reports service'
    });
  }

  if (!report) {
    return res.status(404).json({
      success: false,
      error: 'Building not found'
    });
  }

  try {
    const result = await generateReturnHomePackage(report);

    await sendNotification(report);

    res.status(201).json({
      success: true,
      data: {
        url: `http://localhost:${PORT}${result.url}`,
        fileName: result.fileName
      },
      message: 'Return home package generated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ שרות תיק אכלוס running on http://localhost:${PORT}`);
  console.log(`   POST /buildings/:id/return-home-package`);
  console.log(`   GET  /generated/:fileName`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Stop the other service or change the port.`);
  } else {
    console.error('❌ Return Home Package Service failed to start:', err.message);
  }
  process.exit(1);
});
