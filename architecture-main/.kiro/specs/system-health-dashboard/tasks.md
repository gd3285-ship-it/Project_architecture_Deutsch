# Implementation Plan

- [ ] 1. Add `GET /system-health` backend route
  - Add `SETTLEMENT_API` and `NOTIFICATION_API_HEALTH` constants after the existing `MUNICIPAL_API` constant
  - Add the `GET /system-health` route handler inline after the audit-log routes, using `Promise.all` + `AbortController` (5s timeout)
  - Implement all 6 metric calculations: completed, processing, successful, failed, retryCount, averageSettlementDurationSeconds
  - Return 503 with appropriate message if either upstream call fails
  - **Files:** `backend/server.js`
  - **Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 6.1, 6.2, 6.4

- [ ] 2. Add System Health tab button to frontend navigation
  - Add `<button class="tab-btn" data-tab="system-health">בריאות המערכת</button>` as the last button in the `.nav-tabs` div
  - Add `else if (tabName === 'system-health') { loadSystemHealth(); }` to the existing tab-click event listener
  - **Files:** `frontend/index.html`
  - **Requirements:** 1.1, 1.2, 1.3, 1.4, 5.1, 6.3

- [ ] 3. Add System Health section HTML
  - Add `<div id="system-health" class="section">` with three `.locality-summary-card` groups:
    - Card 1 "תהליכי אכלוס": spans `sh-completed`, `sh-processing`
    - Card 2 "הודעות": spans `sh-notif-success`, `sh-notif-failed`, `sh-retry-count`
    - Card 3 "ביצועים": span `sh-avg-duration`
  - Add loading div (`id="sh-loading"`) and error div (`id="sh-error"`) inside the section
  - **Files:** `frontend/index.html`
  - **Requirements:** 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 6.3

- [ ] 4. Implement `loadSystemHealth()` JavaScript function
  - Add the `loadSystemHealth()` async function to the script block
  - On activation: show loading, hide cards and error, clear metric spans
  - Fetch `GET ${API_BASE}/system-health`
  - On success: populate all 7 span IDs, format duration as `X שניות` or `N/A` when null
  - On error: hide cards, show Hebrew error message in `#sh-error`
  - **Files:** `frontend/index.html`
  - **Requirements:** 4.4, 5.1, 5.2, 5.3, 5.4, 6.3
