import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'settlement-process.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Write a structured log entry to the log file.
 *
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} event
 * @param {{
 *   settlementName?: string|null,
 *   buildingId?:     string|null,
 *   attemptNumber?:  number|null,
 *   errorMessage?:   string|null,
 * }} fields
 */
export function log(level, event, fields = {}) {
  try {
    ensureLogDir();

    const entry = {
      timestamp:      new Date().toISOString(),
      level,
      event,
      settlementName: fields.settlementName ?? null,
      buildingId:     fields.buildingId     ?? null,
      attemptNumber:  fields.attemptNumber  ?? null,
      errorMessage:   fields.errorMessage   ?? null,
    };

    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // silently swallow — logging must never break callers
  }
}
