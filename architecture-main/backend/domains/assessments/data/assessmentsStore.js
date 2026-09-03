// Assessments Domain — owned exclusively by the Appraisers team
// No other domain may read or write this store directly.

// Seed assessments are keyed by a stable placeholder buildingId that matches
// the report IDs seeded in reportsStore.  Because report IDs are generated with
// uuidv4() at module-load time they differ on every restart; the seed data here
// uses symbolic keys that the main server can map at startup if needed.
// For demo purposes we pre-populate with a fixed set of known-looking IDs
// so the UI shows assessments immediately after first boot.

const SEED_ASSESSMENTS = [
  { id: 'seed-bld-01', severity: 'severe',  notes: 'קריסת תקרה חלקית בקומה ראשונה — נדרש טיפול דחוף', inspectionDate: '2025-05-10', followUpRequired: true  },
  { id: 'seed-bld-02', severity: 'medium',  notes: 'סדקים בקירות חיצוניים, מצריך ניטור', inspectionDate: '2025-05-12', followUpRequired: true  },
  { id: 'seed-bld-03', severity: 'low',     notes: 'נזקי רטיבות מינוריים בקומה עליונה', inspectionDate: '2025-05-14', followUpRequired: false },
  { id: 'seed-bld-04', severity: 'severe',  notes: 'פגיעה ביסודות המבנה — אסור לאכלוס', inspectionDate: '2025-05-16', followUpRequired: true  },
  { id: 'seed-bld-05', severity: 'medium',  notes: 'נזקי שריפה בקומה שלישית, תיקון אפשרי', inspectionDate: '2025-05-18', followUpRequired: false },
  { id: 'seed-bld-06', severity: 'low',     notes: 'נזקי סערה בגג — ניתן לתיקון מהיר', inspectionDate: '2025-05-20', followUpRequired: false },
  { id: 'seed-bld-07', severity: 'severe',  notes: 'פיצוץ צינורות ונזקי מים נרחבים בכל הקומות', inspectionDate: '2025-05-22', followUpRequired: true  },
  { id: 'seed-bld-08', severity: 'medium',  notes: 'שקיעת רצפות בקומה תחתונה', inspectionDate: '2025-05-24', followUpRequired: true  },
  { id: 'seed-bld-09', severity: 'low',     notes: 'נזקי עשן בחדר מדרגות בלבד', inspectionDate: '2025-05-26', followUpRequired: false },
  { id: 'seed-bld-10', severity: 'medium',  notes: 'נפילת עצים על גג — נדרש תיקון מבני', inspectionDate: '2025-05-28', followUpRequired: true  },
];

const assessments = new Map(
  SEED_ASSESSMENTS.map(({ id, ...data }) => [
    id,
    { ...data, createdAt: new Date(`${data.inspectionDate}T09:00:00.000Z`).toISOString() }
  ])
);

export function getAssessment(buildingId) {
  return assessments.get(buildingId) || null;
}

export function saveAssessment(buildingId, assessment) {
  assessments.set(buildingId, assessment);
  return assessment;
}
