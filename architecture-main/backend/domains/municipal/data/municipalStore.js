// Municipal Domain — owned exclusively by the Local Authorities team
// No other domain may read or write this store directly.

// Seed approvals for buildings that already completed restoration.
// Keys mirror the symbolic seed IDs used in assessmentsStore so the UI
// shows real data on first boot without needing prior API calls.
const SEED_APPROVALS = [
  { id: 'seed-bld-01', waterSupply: true,  electricitySupply: true,  accessRoads: true,  hazardsCleared: true,  notes: 'כל מערכות התשתית שוקמו במלואן', approved: true  },
  { id: 'seed-bld-02', waterSupply: true,  electricitySupply: true,  accessRoads: true,  hazardsCleared: false, notes: 'נדרש פינוי ממדבקות סיכון לפני חזרה', approved: false },
  { id: 'seed-bld-03', waterSupply: true,  electricitySupply: true,  accessRoads: true,  hazardsCleared: true,  notes: 'אושר לאכלוס מחדש', approved: true  },
  { id: 'seed-bld-04', waterSupply: false, electricitySupply: false, accessRoads: true,  hazardsCleared: false, notes: 'מים וחשמל עדיין מנותקים', approved: false },
  { id: 'seed-bld-05', waterSupply: true,  electricitySupply: true,  accessRoads: true,  hazardsCleared: true,  notes: 'בדיקה אחרונה עברה בהצלחה', approved: true  },
  { id: 'seed-bld-06', waterSupply: true,  electricitySupply: true,  accessRoads: false, hazardsCleared: true,  notes: 'כביש הגישה עדיין חסום — בהמתנה לעירייה', approved: false },
  { id: 'seed-bld-07', waterSupply: true,  electricitySupply: true,  accessRoads: true,  hazardsCleared: true,  notes: 'כל סכנות הבטיחות טופלו', approved: true  },
  { id: 'seed-bld-08', waterSupply: true,  electricitySupply: false, accessRoads: true,  hazardsCleared: true,  notes: 'ממתין לחיבור מחדש לרשת החשמל', approved: false },
  { id: 'seed-bld-09', waterSupply: true,  electricitySupply: true,  accessRoads: true,  hazardsCleared: true,  notes: 'אושר ללא הסתייגויות', approved: true  },
  { id: 'seed-bld-10', waterSupply: true,  electricitySupply: true,  accessRoads: true,  hazardsCleared: false, notes: 'יש להסיר פסולת בניין מהמדרכה לפני אכלוס', approved: false },
];

const approvals = new Map(
  SEED_APPROVALS.map(({ id, ...data }) => [
    id,
    { ...data, createdAt: new Date('2025-05-30T10:00:00.000Z').toISOString() }
  ])
);

export function getApproval(buildingId) {
  return approvals.get(buildingId) || null;
}

export function saveApproval(buildingId, approval) {
  approvals.set(buildingId, approval);
  return approval;
}
