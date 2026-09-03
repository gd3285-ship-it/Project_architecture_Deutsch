import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3003;
const CSV_PATH = path.join(__dirname, 'data', 'notifications.csv');

app.use(cors());
app.use(express.json());

// --- Idempotency ---
// שומר idempotency keys של הודעות שנשלחו בהצלחה
const sentKeys = new Set();


// Modes: 'success' | 'always_fail' | 'fail_first' | 'random_fail' | 'response_lost'
let serverMode = 'success';
let isFirstAttempt = true;

function shouldFail() {
  switch (serverMode) {
    case 'always_fail':   return true;
    case 'fail_first':    { const fail = isFirstAttempt; isFirstAttempt = false; return fail; }
    case 'random_fail':   return Math.random() < 0.3;
    default:              return false; // 'success', 'response_lost'
  }
}

// --- CSV helpers ---
function ensureCsv() {
  const dir = path.dirname(CSV_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, 'messageId,buildingId,email,subject,dateTime,status\n', 'utf8');
  }
}

function appendToCsv(row) {
  ensureCsv();
  const line = [
    row.messageId,
    row.buildingId,
    `"${row.email}"`,
    `"${row.subject}"`,
    row.dateTime,
    row.status
  ].join(',') + '\n';
  fs.appendFileSync(CSV_PATH, line, 'utf8');
}

function readAllNotifications() {
  ensureCsv();
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.trim().split('\n');
  if (lines.length <= 1) return [];
  return lines.slice(1).map(line => {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { cols.push(current); current = ''; }
      else { current += ch; }
    }
    cols.push(current);
    return {
      messageId: cols[0],
      buildingId: cols[1],
      email: cols[2],
      subject: cols[3],
      dateTime: cols[4],
      status: cols[5]
    };
  });
}

// --- Routes ---
app.get('/health', (req, res) => {
  res.json({ status: 'Notification Server is running', mode: serverMode });
});

// Get current mode
app.get('/notifications/mode', (req, res) => {
  res.json({ success: true, mode: serverMode });
});

// Set mode
app.post('/notifications/mode', (req, res) => {
  const { mode } = req.body;
  const valid = ['success', 'always_fail', 'fail_first', 'random_fail', 'response_lost'];
  if (!valid.includes(mode)) {
    return res.status(400).json({ success: false, error: `Invalid mode. Must be one of: ${valid.join(', ')}` });
  }
  serverMode = mode;
  isFirstAttempt = true; // reset fail_first counter on mode change
  console.log(`🔄 Notification server mode changed to: ${mode}`);
  res.json({ success: true, mode: serverMode });
});

// Send notification — always logs, status depends on mode
app.post('/notifications/send', (req, res) => {
  const { idempotencyKey, buildingId, email, subject, body } = req.body;

  if (!buildingId || !email || !subject || !body) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // אם כבר נשלחה הודעה מוצלחת עם אותו key — חוסם כפילות
  if (idempotencyKey && sentKeys.has(idempotencyKey)) {
    return res.status(201).json({
      success: true,
      data: { messageId: 'duplicate-blocked', status: 'SENT' }
    });
  }

  const messageId = uuidv4();
  const dateTime = new Date().toISOString();
  const failed = shouldFail();
  const status = failed ? 'FAILED' : 'SENT';

  appendToCsv({ messageId, buildingId, email, subject, dateTime, status });

  // רושם key רק אחרי שליחה מוצלחת
  if (status === 'SENT' && idempotencyKey) {
    sentKeys.add(idempotencyKey);
  }

  // response_lost: נשלח ונרשם כ-SENT, אבל הקישור נסגר ללא תגובה
  if (serverMode === 'response_lost') {
    res.socket.destroy();
    return;
  }

  res.status(201).json({
    success: true,
    data: { messageId, status }
  });
});

// Get all notifications
app.get('/notifications', (req, res) => {
  const notifications = readAllNotifications();
  res.json({ success: true, data: notifications });
});

app.listen(PORT, () => {
  console.log(`✅ Notification Server (mock) running on http://localhost:${PORT}`);
  console.log(`   GET  /notifications/mode`);
  console.log(`   POST /notifications/mode`);
  console.log(`   POST /notifications/send`);
  console.log(`   GET  /notifications`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error('❌ Notification Server failed to start:', err.message);
  }
  process.exit(1);
});
