// Assessments Domain — business rules owned by the Appraisers team

export const VALID_SEVERITIES = ['low', 'medium', 'severe'];

export function validateAssessment({ severity, inspectionDate }) {
  if (!severity || !VALID_SEVERITIES.includes(severity)) {
    return { valid: false, error: 'Invalid severity. Must be low, medium, or severe.' };
  }
  if (!inspectionDate) {
    return { valid: false, error: 'inspectionDate is required.' };
  }
  return { valid: true };
}
