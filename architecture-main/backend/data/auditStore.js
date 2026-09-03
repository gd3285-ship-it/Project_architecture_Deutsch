// Audit Log Store — immutable append-only log of user actions
import { v4 as uuidv4 } from 'uuid';

const auditLogs = [
  // ── ירושלים ── בניין seed-bld-01
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'עדכן דוח נזק',         entityType: 'building',            entityId: 'seed-bld-01', timestamp: '2025-05-01T08:10:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-01', timestamp: '2025-05-10T09:05:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'אישר אכלוס מחדש',       entityType: 'authority-approval',  entityId: 'seed-bld-01', timestamp: '2025-05-30T10:15:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'יואב לוי',   action: 'הגיש בקשת תקציב',       entityType: 'budget-request',      entityId: 'seed-bld-01', timestamp: '2025-05-31T11:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'מיכל אברהם', action: 'סימן שחזור כהושלם',     entityType: 'building',            entityId: 'seed-bld-01', timestamp: '2025-06-01T14:00:00.000Z' },

  // ── ירושלים ── בניין seed-bld-02
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'עדכן דוח נזק',         entityType: 'building',            entityId: 'seed-bld-02', timestamp: '2025-05-03T08:30:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-02', timestamp: '2025-05-12T09:20:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'דחה בקשת אכלוס',        entityType: 'authority-approval',  entityId: 'seed-bld-02', timestamp: '2025-05-30T10:30:00.000Z' },

  // ── ירושלים ── בניין seed-bld-03
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'יצר דוח נזק חדש',       entityType: 'building',            entityId: 'seed-bld-03', timestamp: '2025-05-05T07:45:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-03', timestamp: '2025-05-14T10:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'אישר אכלוס מחדש',       entityType: 'authority-approval',  entityId: 'seed-bld-03', timestamp: '2025-05-30T11:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'יואב לוי',   action: 'הגיש בקשת תקציב',       entityType: 'budget-request',      entityId: 'seed-bld-03', timestamp: '2025-06-01T09:00:00.000Z' },

  // ── ירושלים ── בניין seed-bld-04
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'עדכן דוח נזק',         entityType: 'building',            entityId: 'seed-bld-04', timestamp: '2025-05-07T09:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-04', timestamp: '2025-05-16T08:50:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'דחה בקשת אכלוס',        entityType: 'authority-approval',  entityId: 'seed-bld-04', timestamp: '2025-05-30T12:00:00.000Z' },

  // ── ירושלים ── בניין seed-bld-05
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'עדכן דוח נזק',         entityType: 'building',            entityId: 'seed-bld-05', timestamp: '2025-05-09T10:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-05', timestamp: '2025-05-18T09:30:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'אישר אכלוס מחדש',       entityType: 'authority-approval',  entityId: 'seed-bld-05', timestamp: '2025-05-30T13:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'יואב לוי',   action: 'הגיש בקשת תקציב',       entityType: 'budget-request',      entityId: 'seed-bld-05', timestamp: '2025-06-02T08:00:00.000Z' },

  // ── ירושלים ── בניין seed-bld-06
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'עדכן דוח נזק',         entityType: 'building',            entityId: 'seed-bld-06', timestamp: '2025-05-11T11:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-06', timestamp: '2025-05-20T10:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'דחה בקשת אכלוס',        entityType: 'authority-approval',  entityId: 'seed-bld-06', timestamp: '2025-05-30T14:00:00.000Z' },

  // ── ירושלים ── בניין seed-bld-07
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'עדכן דוח נזק',         entityType: 'building',            entityId: 'seed-bld-07', timestamp: '2025-05-13T08:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-07', timestamp: '2025-05-22T09:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'אישר אכלוס מחדש',       entityType: 'authority-approval',  entityId: 'seed-bld-07', timestamp: '2025-05-30T15:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'מיכל אברהם', action: 'סימן שחזור כהושלם',     entityType: 'building',            entityId: 'seed-bld-07', timestamp: '2025-06-03T10:00:00.000Z' },

  // ── ירושלים ── בניין seed-bld-08
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'עדכן דוח נזק',         entityType: 'building',            entityId: 'seed-bld-08', timestamp: '2025-05-15T09:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-08', timestamp: '2025-05-24T10:30:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'דחה בקשת אכלוס',        entityType: 'authority-approval',  entityId: 'seed-bld-08', timestamp: '2025-05-30T15:30:00.000Z' },

  // ── ירושלים ── בניין seed-bld-09
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'עדכן דוח נזק',         entityType: 'building',            entityId: 'seed-bld-09', timestamp: '2025-05-17T08:20:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-09', timestamp: '2025-05-26T09:15:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'אישר אכלוס מחדש',       entityType: 'authority-approval',  entityId: 'seed-bld-09', timestamp: '2025-05-30T16:00:00.000Z' },

  // ── ירושלים ── בניין seed-bld-10
  { id: uuidv4(), userId: 'system-seed', userName: 'דנה כהן',    action: 'עדכן דוח נזק',         entityType: 'building',            entityId: 'seed-bld-10', timestamp: '2025-05-19T10:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'רן שמאי',    action: 'הוסיף הערכת נזק',       entityType: 'assessment',          entityId: 'seed-bld-10', timestamp: '2025-05-28T11:00:00.000Z' },
  { id: uuidv4(), userId: 'system-seed', userName: 'נועה רשות',  action: 'דחה בקשת אכלוס',        entityType: 'authority-approval',  entityId: 'seed-bld-10', timestamp: '2025-05-30T16:30:00.000Z' },
];

/**
 * Append a new audit log entry. Records are immutable once written.
 * @param {object} entry
 * @param {string} entry.userId
 * @param {string} entry.userName
 * @param {string} entry.action      - human-readable action label (Hebrew)
 * @param {string} entry.entityType  - e.g. 'building', 'assessment', 'authority-approval', 'budget-request'
 * @param {string} entry.entityId    - the ID of the affected entity
 * @returns {object} the created log entry
 */
export function appendAuditLog({ userId, userName, action, entityType, entityId }) {
  const entry = {
    id: uuidv4(),
    userId,
    userName,
    action,
    entityType,
    entityId,
    timestamp: new Date().toISOString()
  };
  auditLogs.push(entry);
  return entry;
}

/**
 * Get all audit logs for a specific entityId, sorted newest-first.
 */
export function getAuditLogsForEntity(entityId) {
  return auditLogs
    .filter(e => e.entityId === entityId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Get all audit logs, sorted newest-first.
 */
export function getAllAuditLogs() {
  return [...auditLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
