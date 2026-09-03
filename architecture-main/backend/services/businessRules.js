export const STATUSES = {
  NEW: 'NEW',
  IN_REVIEW: 'IN_REVIEW',
  WAITING_FOR_VALIDATION: 'WAITING_FOR_VALIDATION',
  IN_RESTORATION: 'IN_RESTORATION',
  RESTORATION_COMPLETED: 'RESTORATION_COMPLETED'
};

export const ALL_STATUSES = Object.values(STATUSES);

export const STATUS_LABELS = {
  [STATUSES.NEW]: 'חדש',
  [STATUSES.IN_REVIEW]: 'בטיפול',
  [STATUSES.WAITING_FOR_VALIDATION]: 'בהמתנה לאישור',
  [STATUSES.IN_RESTORATION]: 'מבנה בתהליך שיקום',
  [STATUSES.RESTORATION_COMPLETED]: 'תהליך שיקום הסתיים'
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function getSocialApprovalDisplay(report) {
  const apartmentCount = Number(report.apartmentCount) || 0;
  if (apartmentCount <= 24) {
    return 'לא נדרש';
  }
  return report.socialApproval ? 'קיים' : 'חסר';
}

export function getBudgetRequestEligibility(report) {
  const missing = [];

  if (!report.hasDamagePhotos) {
    missing.push('חסרות תמונות נזק');
  }
  if (!report.hasEngineerReport) {
    missing.push('חסר דוח מהנדס');
  }
  if (!report.eligibilityCheckCompleted) {
    missing.push('טרם בוצעה בדיקת זכאות');
  }
  if ((Number(report.apartmentCount) || 0) > 24 && !report.socialApproval) {
    missing.push('חסר אישור חברתי (מבנה עם מעל 24 דירות)');
  }

  return {
    canOpen: missing.length === 0,
    missing
  };
}

export function getRestorationStatus(report) {
  const canStartRestoration = report.hasDamagePhotos
    && report.hasEngineerReport
    && report.eligibilityCheckCompleted;

  return {
    canStartRestoration,
    message: canStartRestoration
      ? 'ניתן להתחיל שיקום'
      : 'חסר מידע להתחלת שיקום'
  };
}

export function canGenerateReturnHomePackage(report) {
  const missing = [];

  if (!report.hasEngineerReport) {
    missing.push('חסר דוח מהנדס');
  }
  if (!report.eligibilityCheckCompleted) {
    missing.push('טרם בוצעה בדיקת זכאות');
  }
  if (!report.hasBudgetRequest) {
    missing.push('חסרה בקשת תקציב');
  }
  if (report.status !== STATUSES.RESTORATION_COMPLETED) {
    missing.push('תהליך השיקום טרם הסתיים');
  }

  return {
    eligible: missing.length === 0,
    missing
  };
}

export function canReopenLocality(report) {
  // תנאי מערכת קיימים
  if (!report.hasDamagePhotos)          return false;
  if (!report.hasEngineerReport)        return false;
  if (!report.eligibilityCheckCompleted) return false;
  if ((Number(report.apartmentCount) || 0) > 24 && !report.socialApproval) return false;
  if (!report.hasBudgetRequest)         return false;

  // תיק חזרה לבית הופק — נבדק ע"י canGenerateReturnHomePackage (status + תנאים)
  const returnHome = canGenerateReturnHomePackage(report);
  if (!returnHome.eligible)             return false;

  // תנאים חדשים — פלטפורמה לאומית
  if (!report.assessment)               return false;
  if (!['low', 'medium'].includes(report.assessment.severity)) return false;
  if (!report.authorityApproval?.approved) return false;

  return true;
}

export function enrichReport(report) {
  const budgetEligibility = getBudgetRequestEligibility(report);
  const restorationStatus = getRestorationStatus(report);
  const returnHomeEligibility = canGenerateReturnHomePackage(report);

  return {
    ...report,
    statusLabel: getStatusLabel(report.status),
    socialApprovalDisplay: getSocialApprovalDisplay(report),
    canOpenBudgetRequest: budgetEligibility.canOpen,
    budgetRequestMissing: budgetEligibility.missing,
    canStartRestoration: restorationStatus.canStartRestoration,
    restorationMessage: restorationStatus.message,
    canGenerateReturnHomePackage: returnHomeEligibility.eligible,
    returnHomePackageMissing: returnHomeEligibility.missing,
    localityEligible: canReopenLocality(report)
  };
}
