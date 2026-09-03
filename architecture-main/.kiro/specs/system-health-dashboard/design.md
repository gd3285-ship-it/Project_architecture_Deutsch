# Design Document — System Health Dashboard

## Overview

This feature adds a read-only **System Health** administrative dashboard to the Damage Reports System. It consists of two coordinated changes:

1. **Backend** — a new `GET /system-health` aggregation endpoint added inline to `backend/server.js` (port 3001). It calls the Settlement Service (port 3002) and the Notification Service (port 3003) in parallel, computes six health metrics, and returns a single JSON object.

2. **Frontend** — a new tab button and section added to `frontend/index.html`. When the tab is activated, `loadSystemHealth()` fetches the aggregated metrics and populates Hebrew-labelled stat cards that reuse the existing CSS classes (`.locality-summary-card`, `.locality-stat`, `.loading`, `.message`).

No new files, npm packages, CSS classes, or data structures are introduced. No existing routes, data stores, or frontend sections are modified.

---

## Architecture

### Files Modified

| File | Change |
|---|---|
| `backend/server.js` | Add `GET /system-health` route inline, after audit-log routes |
| `frontend/index.html` | Add nav-tab button, section HTML, and `loadSystemHealth()` JS |

### Files NOT Modified

| File | Reason |
|---|---|
| `backend/return-home-package-server.js` | Upstream service — consumed read-only |
| `backend/notification-server.js` | Upstream service — consumed read-only |
| `backend/data/settlementProcessStore.js` | Data store — not touched |
| `backend/data/notifications.csv` | Data store — not touched |

### Data Flow

```
Browser
  └─► GET /system-health  (port 3001 — backend/server.js)
            │
            ├─► GET http://localhost:3002/settlement-processes
            │         └── returns { success, data: [ SettlementProcess, … ] }
            │
            └─► GET http://localhost:3003/notifications
                      └── returns { success, data: [ NotificationRecord, … ] }

        Both upstream calls are made in parallel (Promise.all).
        Each call has a 5-second AbortController timeout.
        Either call failing → HTTP 503.
        Both succeed → aggregated metrics returned as HTTP 200.
```

---

## Components and Interfaces

### 1. Backend — `GET /system-health` Route (backend/server.js)

The route is added **inline** in `backend/server.js`, after the existing audit-log routes and before the final `app.get('/health', …)` route, following the same pattern used throughout that file.

Two new environment-variable constants are declared at the top of the file alongside the existing `ASSESSMENTS_API` and `MUNICIPAL_API` constants:

```js
const SETTLEMENT_API        = process.env.SETTLEMENT_API        || 'http://localhost:3002';
const NOTIFICATION_API_HEALTH = process.env.NOTIFICATION_API_HEALTH || 'http://localhost:3003';
```

**Full route handler:**

```js
// GET /system-health — aggregate metrics from Settlement and Notification services
app.get('/system-health', async (req, res) => {
  // Helper: fetch with a 5-second timeout
  async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  let settlementData, notificationData;

  try {
    const [settlementRes, notificationRes] = await Promise.all([
      fetchWithTimeout(`${SETTLEMENT_API}/settlement-processes`),
      fetchWithTimeout(`${NOTIFICATION_API_HEALTH}/notifications`)
    ]);

    if (!settlementRes.ok) {
      return res.status(503).json({ success: false, error: 'Settlement service unavailable' });
    }
    const settlementJson = await settlementRes.json();
    settlementData = settlementJson.data; // array of SettlementProcess

    if (!notificationRes.ok) {
      return res.status(503).json({ success: false, error: 'Notification service unavailable' });
    }
    const notificationJson = await notificationRes.json();
    notificationData = notificationJson.data; // array of NotificationRecord

  } catch (err) {
    // AbortError (timeout) or network failure — Promise.all rejects on first failure.
    // Inspect error origin by URL substring, defaulting to notification service.
    const isSettlementError = err.message && err.message.includes('3002');
    if (isSettlementError) {
      return res.status(503).json({ success: false, error: 'Settlement service unavailable' });
    }
    return res.status(503).json({ success: false, error: 'Notification service unavailable' });
  }

  // --- Settlement Process Metrics ---
  const completed  = settlementData.filter(p => p.status === 'COMPLETED').length;
  const processing = settlementData.filter(p => p.status === 'PROCESSING').length;

  // --- Notification Metrics ---
  const successful = notificationData.filter(n => n.status === 'SENT').length;
  const failed     = notificationData.filter(n => n.status === 'FAILED').length;
  const retryCount = failed; // each failed attempt is a separate CSV row

  // --- Average Settlement Duration ---
  const completedWithDates = settlementData.filter(
    p => p.status === 'COMPLETED' && p.completedAt != null && p.startedAt != null
  );
  let averageSettlementDurationSeconds = null;
  if (completedWithDates.length > 0) {
    const totalSeconds = completedWithDates.reduce((sum, p) => {
      const durationMs = new Date(p.completedAt) - new Date(p.startedAt);
      return sum + Math.floor(durationMs / 1000);
    }, 0);
    averageSettlementDurationSeconds = Math.floor(totalSeconds / completedWithDates.length);
  }

  res.json({
    success: true,
    data: {
      settlementProcesses: { completed, processing },
      notifications:       { successful, failed, retryCount },
      performance:         { averageSettlementDurationSeconds }
    }
  });
});
```

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "settlementProcesses": { "completed": 2, "processing": 1 },
    "notifications":       { "successful": 18, "failed": 4, "retryCount": 4 },
    "performance":         { "averageSettlementDurationSeconds": 273 }
  }
}
```

**Error response (HTTP 503):**
```json
{ "success": false, "error": "Settlement service unavailable" }
```
or
```json
{ "success": false, "error": "Notification service unavailable" }
```

---

### 2. Frontend — "System Health" Tab (frontend/index.html)

#### 2a. Nav-tab button

Add as the last `<button>` inside the existing `.nav-tabs` div:

```html
<button class="tab-btn" data-tab="system-health">בריאות המערכת</button>
```

#### 2b. Section HTML

Add as the last `.section` div before `</body>`:

```html
<div id="system-health" class="section">
  <div class="container">
    <h2 style="font-size:22px; font-weight:700; margin-bottom:24px; color:var(--text-primary);">
      בריאות המערכת
    </h2>

    <!-- Loading indicator (reuses .loading class) -->
    <div id="sh-loading" class="loading" style="display:none;">טוען נתונים…</div>

    <!-- Error message (reuses .message .error pattern) -->
    <div id="sh-error" class="message error" style="display:none;"></div>

    <!-- Metric cards -->
    <div id="sh-cards" style="display:flex; gap:20px; flex-wrap:wrap;">

      <!-- Card 1: Settlement Processes -->
      <div class="locality-summary-card" style="flex:1; min-width:220px;">
        <h3>תהליכי אכלוס</h3>
        <div class="locality-summary-stats">
          <div class="locality-stat eligible">
            <span class="locality-stat-number" id="sh-completed">—</span>
            <span class="locality-stat-label">הושלמו</span>
          </div>
          <div class="locality-stat pending">
            <span class="locality-stat-number" id="sh-processing">—</span>
            <span class="locality-stat-label">בעיבוד</span>
          </div>
        </div>
      </div>

      <!-- Card 2: Notifications -->
      <div class="locality-summary-card" style="flex:1; min-width:280px;">
        <h3>הודעות</h3>
        <div class="locality-summary-stats">
          <div class="locality-stat eligible">
            <span class="locality-stat-number" id="sh-notif-success">—</span>
            <span class="locality-stat-label">נשלחו בהצלחה</span>
          </div>
          <div class="locality-stat ineligible">
            <span class="locality-stat-number" id="sh-notif-failed">—</span>
            <span class="locality-stat-label">נכשלו</span>
          </div>
          <div class="locality-stat pending">
            <span class="locality-stat-number" id="sh-retry-count">—</span>
            <span class="locality-stat-label">ניסיונות חוזרים</span>
          </div>
        </div>
      </div>

      <!-- Card 3: Performance -->
      <div class="locality-summary-card" style="flex:1; min-width:200px;">
        <h3>ביצועים</h3>
        <div class="locality-summary-stats">
          <div class="locality-stat">
            <span class="locality-stat-number" id="sh-avg-duration" style="font-size:20px;">—</span>
            <span class="locality-stat-label">משך ממוצע</span>
          </div>
        </div>
      </div>

    </div><!-- /#sh-cards -->
  </div><!-- /.container -->
</div><!-- /#system-health -->
```

**CSS class reuse:**

| Class | Purpose |
|---|---|
| `.locality-summary-card` | White card with border — matches existing locality cards |
| `.locality-stat.eligible` | Green number — used for completed / successful counts |
| `.locality-stat.ineligible` | Red number — used for failed counts |
| `.locality-stat.pending` | Orange number — used for processing / retry counts |
| `.loading` | Centered grey loading box with border |
| `.message.error` | Red bordered error box (hidden by default, shown by JS) |

#### 2c. `loadSystemHealth()` JS function

Add alongside the other loader functions in the `<script>` block:

```js
async function loadSystemHealth() {
  const loading  = document.getElementById('sh-loading');
  const errorDiv = document.getElementById('sh-error');
  const cards    = document.getElementById('sh-cards');

  // Span IDs cleared at the start of each load cycle
  const metricIds = [
    'sh-completed', 'sh-processing',
    'sh-notif-success', 'sh-notif-failed', 'sh-retry-count',
    'sh-avg-duration'
  ];

  // Reset state
  loading.style.display  = 'block';
  errorDiv.style.display = 'none';
  cards.style.display    = 'none';
  metricIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  try {
    const res  = await fetch(`${API_BASE}/system-health`);
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || 'שגיאה בטעינת נתוני בריאות המערכת');
    }

    const { settlementProcesses, notifications, performance } = json.data;

    // Populate Settlement Process metrics
    document.getElementById('sh-completed').textContent  = settlementProcesses.completed;
    document.getElementById('sh-processing').textContent = settlementProcesses.processing;

    // Populate Notification metrics
    document.getElementById('sh-notif-success').textContent = notifications.successful;
    document.getElementById('sh-notif-failed').textContent  = notifications.failed;
    document.getElementById('sh-retry-count').textContent   = notifications.retryCount;

    // Populate Performance metric — format as Hebrew seconds or N/A
    const avgDuration = performance.averageSettlementDurationSeconds;
    document.getElementById('sh-avg-duration').textContent =
      avgDuration !== null && avgDuration !== undefined
        ? `${avgDuration} שניות`
        : 'N/A';

    // Reveal cards, hide loading
    loading.style.display = 'none';
    cards.style.display   = 'flex';

  } catch (err) {
    loading.style.display  = 'none';
    cards.style.display    = 'none';
    errorDiv.textContent   = `שגיאה בטעינת נתוני בריאות המערכת: ${err.message}`;
    errorDiv.style.display = 'block';
  }
}
```

`API_BASE` is already defined at the top of the `<script>` block as `const API_BASE = 'http://localhost:3001';` — no redefinition needed.

#### 2d. Tab handler addition

In the existing tab-click event listener, add at the end of the `else if` chain:

```js
else if (tabName === 'system-health') { loadSystemHealth(); }
```

Surrounding context for insertion:
```js
if      (tabName === 'reports')               { loadReports(); }
else if (tabName === 'settlement-processes')  { loadSettlementProcesses(); }
else if (tabName === 'notifications')         { loadNotifications(); }
else if (tabName === 'system-health')         { loadSystemHealth(); }   // ← ADD
```

---

## Data Models

### SettlementProcess (from `backend/data/settlementProcessStore.js`)

```js
{
  id:             string,          // UUID v4, unique
  settlementName: string,          // non-blank display name
  startedBy:      string,          // non-blank user name
  startedAt:      string,          // ISO 8601 date-time
  completedAt:    string | null,   // null while PROCESSING; ISO 8601 when COMPLETED
  status:         'PROCESSING' | 'COMPLETED'
}
```

`GET http://localhost:3002/settlement-processes` response envelope:
```json
{ "success": true, "data": [ /* SettlementProcess[], newest first */ ] }
```

### NotificationRecord (from `backend/data/notifications.csv`)

```js
{
  messageId:  string,   // UUID v4
  buildingId: string,
  email:      string,
  subject:    string,
  dateTime:   string,   // ISO 8601
  status:     'SENT' | 'FAILED'
}
```

`GET http://localhost:3003/notifications` response envelope:
```json
{ "success": true, "data": [ /* NotificationRecord[] */ ] }
```

### Aggregated Health Metrics (GET /system-health response)

```js
{
  success: true,
  data: {
    settlementProcesses: {
      completed:  number,   // count of records with status === 'COMPLETED'
      processing: number    // count of records with status === 'PROCESSING'
    },
    notifications: {
      successful: number,   // count of records with status === 'SENT'
      failed:     number,   // count of records with status === 'FAILED'
      retryCount: number    // same value as failed
    },
    performance: {
      averageSettlementDurationSeconds: number | null
      // null when no COMPLETED records with non-null completedAt exist
      // otherwise: floor(mean of (completedAt - startedAt) in seconds)
    }
  }
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do.*

---

### Property 1: All six metrics are non-negative integers

*For any* valid upstream data (including empty arrays), all six numeric values in the `data` object SHALL be non-negative integers: `completed ≥ 0`, `processing ≥ 0`, `successful ≥ 0`, `failed ≥ 0`, `retryCount ≥ 0`, and if `averageSettlementDurationSeconds` is not null then `averageSettlementDurationSeconds ≥ 0`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

---

### Property 2: retryCount always equals failed

*For any* set of NotificationRecord data, `retryCount` SHALL always equal `failed` exactly.

**Validates: Requirements 3.5**

---

### Property 3: averageSettlementDurationSeconds is null iff no qualifying records

`averageSettlementDurationSeconds` SHALL be `null` if and only if there are zero SettlementProcess records satisfying both `status === 'COMPLETED'` and `completedAt != null`.

**Validates: Requirements 3.6, 3.7**

---

### Property 4: Average duration is mathematically correct

*For any* set of qualifying COMPLETED records (non-null `completedAt`, non-null `startedAt`), `averageSettlementDurationSeconds` SHALL equal `floor(sum of floor((completedAt_i - startedAt_i) / 1000) / N)` where N is the count of qualifying records.

**Validates: Requirements 3.6**

---

### Property 5: Process count exhaustiveness

`completed + processing` SHALL equal the total number of SettlementProcess records returned by the Settlement Service (assuming all records have status `PROCESSING` or `COMPLETED`).

**Validates: Requirements 3.1, 3.2**

---

### Property 6: Notification count exhaustiveness

`successful + failed` SHALL equal the total number of NotificationRecord entries returned by the Notification Service (assuming all records have status `SENT` or `FAILED`).

**Validates: Requirements 3.3, 3.4**

---

### Property 7: Frontend displays N/A exactly when averageSettlementDurationSeconds is null

*For any* API response where `performance.averageSettlementDurationSeconds === null`, the `#sh-avg-duration` span SHALL contain exactly the string `'N/A'`. *For any* response where it is a non-null number `n`, the span SHALL contain exactly `'${n} שניות'`.

**Validates: Requirements 4.4**

---

## Error Handling

| Scenario | Layer | Behaviour |
|---|---|---|
| Settlement Service unreachable or times out (5 s) | Backend `GET /system-health` | `503 { success: false, error: "Settlement service unavailable" }` |
| Notification Service unreachable or times out (5 s) | Backend `GET /system-health` | `503 { success: false, error: "Notification service unavailable" }` |
| Both services unreachable simultaneously | Backend `GET /system-health` | `Promise.all` rejects on first failure; whichever rejects first determines the 503 message |
| Settlement Service returns non-2xx | Backend `GET /system-health` | `!settlementRes.ok` guard triggers 503 before reading body |
| Notification Service returns non-2xx | Backend `GET /system-health` | `!notificationRes.ok` guard triggers 503 before reading body |
| `GET /system-health` returns 503 | Frontend `loadSystemHealth()` | Cards hidden; `#sh-error` shown with Hebrew message; no stale data visible |
| `fetch()` throws (network error) in frontend | Frontend `loadSystemHealth()` | catch block: cards hidden, `#sh-error` shown with `err.message` |
| `averageSettlementDurationSeconds` is `null` | Frontend | `#sh-avg-duration` shows `'N/A'` |
| No settlement processes exist | Backend metric calculation | `completed=0`, `processing=0`, `averageSettlementDurationSeconds=null` |
| No notifications exist (empty CSV) | Backend metric calculation | `successful=0`, `failed=0`, `retryCount=0` |
| COMPLETED process has `completedAt=null` | Backend duration calculation | Record excluded from average; remaining valid records still contribute |

---

## Testing Strategy

### Unit / Example Tests

- **Empty upstream arrays** — feed `{ data: [] }` for both services; assert all counts are `0` and `averageSettlementDurationSeconds` is `null`.
- **All PROCESSING records** — no COMPLETED records; assert `averageSettlementDurationSeconds === null`.
- **Single COMPLETED record** — assert average equals that record's duration.
- **503 on Settlement failure** — mock Settlement Service to return 503; assert `GET /system-health` returns 503 with correct error string.
- **503 on Notification failure** — mock Notification Service to return 503; assert `GET /system-health` returns 503 with correct error string.
- **Frontend null duration** — simulate response with `averageSettlementDurationSeconds: null`; assert `#sh-avg-duration.textContent === 'N/A'`.
- **Frontend numeric duration** — simulate `averageSettlementDurationSeconds: 273`; assert `#sh-avg-duration.textContent === '273 שניות'`.
- **Frontend error display** — simulate fetch rejection; assert `#sh-error` is visible and `#sh-cards` is hidden.
- **Frontend loading state** — assert `#sh-loading` is shown before the fetch resolves and hidden after.

### Property-Based Tests

Use **fast-check** for Node.js. Each test runs a minimum of 100 iterations.

Tag format: `Feature: system-health-dashboard, Property <N>: <title>`

| Test | Property | Tag |
|---|---|---|
| All metrics non-negative | Property 1 | `Feature: system-health-dashboard, Property 1: All six metrics are non-negative integers` |
| retryCount equals failed | Property 2 | `Feature: system-health-dashboard, Property 2: retryCount always equals failed` |
| null iff no qualifying records | Property 3 | `Feature: system-health-dashboard, Property 3: averageSettlementDurationSeconds is null iff no qualifying records` |
| Average duration is correct | Property 4 | `Feature: system-health-dashboard, Property 4: Average duration is mathematically correct` |
| Process count exhaustiveness | Property 5 | `Feature: system-health-dashboard, Property 5: Process count exhaustiveness` |
| Notification count exhaustiveness | Property 6 | `Feature: system-health-dashboard, Property 6: Notification count exhaustiveness` |
| Frontend N/A vs שניות display | Property 7 | `Feature: system-health-dashboard, Property 7: Frontend displays N/A exactly when averageSettlementDurationSeconds is null` |

**Generator notes:**
- For Properties 1–6: generate arrays of SettlementProcess and NotificationRecord objects with random `status` values, `startedAt`, and `completedAt` (nullable).
- For Property 3: explicitly include cases where all `COMPLETED` records have `completedAt=null` to verify the `null` output.
- For Property 4: use integer millisecond durations to avoid floating-point rounding ambiguity.
- For Property 7: generate `fc.option(fc.nat())` to cover both `null` and non-null integer values.

### Requirements Traceability

| Requirement AC | Design Element |
|---|---|
| **Req 1 AC 1** — Dashboard_Tab in `.nav-tabs` | Section 2a: `<button class="tab-btn" data-tab="system-health">` |
| **Req 1 AC 2** — Clicking tab shows Dashboard_Section | Section 2d: `else if (tabName === 'system-health') { loadSystemHealth(); }` |
| **Req 1 AC 3** — Clicking other tab hides section | Handled by existing tab-switching logic |
| **Req 1 AC 4** — `active` class follows existing pattern | Section 2a/2d: uses `tab-btn` + `data-tab` — existing listener applies `active` |
| **Req 2 AC 1** — `GET /system-health` on port 3001 | Section 1: `app.get('/system-health', …)` in `backend/server.js` |
| **Req 2 AC 2** — Fetches `GET /settlement-processes` port 3002 | Section 1: `fetchWithTimeout(\`${SETTLEMENT_API}/settlement-processes\`)` |
| **Req 2 AC 3** — Fetches `GET /notifications` port 3003 | Section 1: `fetchWithTimeout(\`${NOTIFICATION_API_HEALTH}/notifications\`)` |
| **Req 2 AC 4** — HTTP 200 with JSON on success | Section 1: `res.json({ success: true, data: { … } })` |
| **Req 2 AC 5** — HTTP 503 if Settlement unreachable | Section 1: `!settlementRes.ok` guard + catch block |
| **Req 2 AC 6** — HTTP 503 if Notification unreachable | Section 1: `!notificationRes.ok` guard + catch block |
| **Req 2 AC 7** — No data modification | Section 1: only GET requests issued; no writes |
| **Req 3 AC 1** — `completed` count | Section 1: `settlementData.filter(p => p.status === 'COMPLETED').length` |
| **Req 3 AC 2** — `processing` count | Section 1: `settlementData.filter(p => p.status === 'PROCESSING').length` |
| **Req 3 AC 3** — `successful` count | Section 1: `notificationData.filter(n => n.status === 'SENT').length` |
| **Req 3 AC 4** — `failed` count | Section 1: `notificationData.filter(n => n.status === 'FAILED').length` |
| **Req 3 AC 5** — `retryCount` equals `failed` | Section 1: `const retryCount = failed` |
| **Req 3 AC 6** — Average duration when qualifying records exist | Section 1: `completedWithDates` filter + arithmetic mean + `Math.floor` |
| **Req 3 AC 7** — `null` when no qualifying records | Section 1: `let averageSettlementDurationSeconds = null` — set only if `completedWithDates.length > 0` |
| **Req 3 AC 8** — Exact JSON response structure | Section 1: Response Shape / Data Models |
| **Req 4 AC 1** — Settlement group displayed | Section 2b: Card 1 — `sh-completed`, `sh-processing` |
| **Req 4 AC 2** — Notifications group displayed | Section 2b: Card 2 — `sh-notif-success`, `sh-notif-failed`, `sh-retry-count` |
| **Req 4 AC 3** — Performance group displayed | Section 2b: Card 3 — `sh-avg-duration` |
| **Req 4 AC 4** — `null` shows "N/A" | Section 2c: `avgDuration !== null ? \`${avgDuration} שניות\` : 'N/A'` |
| **Req 4 AC 5** — Hebrew labels | Section 2b: all headings and stat labels are in Hebrew |
| **Req 4 AC 6** — RTL layout and existing CSS variables | Section 2b: reuses `.locality-summary-card`, `.locality-stat`, CSS variables |
| **Req 4 AC 7** — No charts or external libraries | Section 2b/2c: plain HTML stat cards only |
| **Req 5 AC 1** — Fresh fetch on tab activation | Section 2d: `loadSystemHealth()` called on every tab click |
| **Req 5 AC 2** — Loading indicator during fetch | Section 2c: `loading.style.display = 'block'` before fetch |
| **Req 5 AC 3** — Error shown; no stale data | Section 2c: catch block hides cards, shows `#sh-error` |
| **Req 5 AC 4** — No background polling | Section 2c: no `setInterval` or other polling |
| **Req 6 AC 1** — Only GET requests issued | Section 1: both upstream calls use `fetch(url)` (default GET) |
| **Req 6 AC 2** — No data store modification | Section 1: no imports or writes to any data store |
| **Req 6 AC 3** — No impact on existing tabs/sections | Section 2a/2b: purely additive changes |
| **Req 6 AC 4** — No route conflict | Section 1: `/system-health` is a new, unique path in `server.js` |
