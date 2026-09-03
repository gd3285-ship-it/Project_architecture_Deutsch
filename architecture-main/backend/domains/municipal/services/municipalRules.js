// Municipal Domain — business rules owned by the Local Authorities team

export function buildApproval({ waterSupply, electricitySupply, accessRoads, hazardsCleared, notes, approved }) {
  return {
    waterSupply:       !!waterSupply,
    electricitySupply: !!electricitySupply,
    accessRoads:       !!accessRoads,
    hazardsCleared:    !!hazardsCleared,
    notes:             notes || '',
    approved:          !!approved,
    createdAt:         new Date().toISOString()
  };
}
