// Settlement Process Store — tracks each execution of the
// "Generate Settlement Re-Occupancy Files" process.
import { v4 as uuidv4 } from 'uuid';

export const PROCESS_STATUS = {
  PROCESSING: 'PROCESSING',
  COMPLETED:  'COMPLETED'
};

const processes = [
  {
    id:             'proc-seed-001',
    settlementName: 'ירושלים',
    startedBy:      'אדמין ראשי',
    startedAt:      '2025-06-01T07:00:00.000Z',
    completedAt:    '2025-06-01T07:04:33.000Z',
    status:         PROCESS_STATUS.COMPLETED
  },
  {
    id:             'proc-seed-002',
    settlementName: 'ירושלים',
    startedBy:      'מיכל אברהם',
    startedAt:      '2025-06-10T09:15:00.000Z',
    completedAt:    '2025-06-10T09:19:47.000Z',
    status:         PROCESS_STATUS.COMPLETED
  },
  {
    id:             'proc-seed-003',
    settlementName: 'תל אביב',
    startedBy:      'דנה כהן',
    startedAt:      '2025-06-18T11:30:00.000Z',
    completedAt:    null,
    status:         PROCESS_STATUS.PROCESSING
  },
];

/**
 * Create a new SettlementProcess record with status PROCESSING.
 * @param {string} settlementName  - display name of the settlement
 * @param {string} startedBy       - full name of the user who triggered the process
 * @returns {object} the created process record
 */
export function createProcess(settlementName, startedBy) {
  const record = {
    id:             uuidv4(),
    settlementName,
    startedBy,
    startedAt:      new Date().toISOString(),
    completedAt:    null,
    status:         PROCESS_STATUS.PROCESSING
  };
  processes.push(record);
  return record;
}

/**
 * Mark a process as COMPLETED and set completedAt to now.
 * @param {string} id - process id
 * @returns {object|null} the updated record, or null if not found
 */
export function completeProcess(id) {
  const record = processes.find(p => p.id === id);
  if (!record) return null;
  record.status      = PROCESS_STATUS.COMPLETED;
  record.completedAt = new Date().toISOString();
  return record;
}

/**
 * Get all processes sorted newest-first.
 */
export function getAllProcesses() {
  return [...processes].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}
