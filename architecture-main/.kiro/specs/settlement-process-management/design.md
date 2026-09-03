# Design Document: Settlement Process Management

## Overview

This feature adds lightweight tracking and visibility for every execution of the
"Generate Settlement Re-Occupancy Files" batch action. The implementation is
deliberately minimal:

- **Backend** — two additive validation guards in the existing batch endpoint
  (return `400` when `settlementName` or `startedBy` is absent/blank, instead of
  silently falling back to `'לא ידוע'`). No other server logic changes.
- **Frontend** — one new tab ("תהליכי אכלוס") in `frontend/index.html` that
  fetches `GET /settlement-processes` and renders the records in a table matching
  the existing page style.

The `settlementProcessStore.js`, the `createProcess` / `completeProcess` calls in
the batch handler, and the `GET /settlement-processes` route are **already fully
implemented** and must not be changed.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  frontend/index.html  (single HTML + inline JS) │
│                                                  │
│  Tab: "תהליכי אכלוס"                            │
│   └─ loadSettlementProcesses()                  │
│       └─ fetch GET :3002/settlement-processes   │
└────────────────────────┬────────────────────────┘
                         │ HTTP GET
┌────────────────────────▼────────────────────────┐
│  backend/return-home-package-server.js  (:3002) │
│                                                  │
│  GET  /settlement-processes                      │
│   └─ getAllProcesses()                           │
│                                                  │
│  POST /buildings/batch/return-home-packages      │
│   ├─ [NEW] validate settlementName / startedBy  │
│   ├─ createProcess(settlementName, startedBy)    │
│   ├─ … PDF generation + notifications (unchanged)│
│   └─ completeProcess(process.id)                 │
└────────────────────────┬────────────────────────┘
                         │ in-process call
┌────────────────────────▼────────────────────────┐
│  backend/data/settlementProcessStore.js          │
│   createProcess()  completeProcess()             │
│   getAllProcesses()                              │
└─────────────────────────────────────────────────┘
```

No new files, no new services, no new dependencies.

---

## Components and Interfaces

### 1. Backend — Input Validation Guard (return-home-package-server.js)

**Change location:** the `POST /buildings/batch/return-home-packages` handler,
immediately after the existing `ids` validation and before the `createProcess`
call.

```js
// Add these two guards:
if (!settlementName || !settlementName.trim()) {
  return res.status(400).json({ success: false, error: 'שדה settlementName חסר או ריק' });
}
if (!startedBy || !startedBy.trim()) {
  return res.status(400).json({ success: false, error: 'שדה startedBy חסר או ריק' });
}
```

**Rules:**
- A value is considered invalid if it is `undefined`, `null`, `''`, or any
  string composed entirely of whitespace (`'   '`).
- On a `400` response, `createProcess` is NOT called — no record is created.
- The existing fallback (`|| 'לא ידוע'`) is removed from the `createProcess`
  call site.
- No other code in the handler changes.

**No change** to `GET /settlement-processes` — it is already correct.

---

### 2. Frontend — "Settlement Processes" Tab (frontend/index.html)

The frontend already has the tab button and section skeleton. What needs to be
confirmed / completed:

#### 2a. Nav-tab button (already present)
```html
<button class="tab-btn" data-tab="settlement-processes">תהליכי אכלוס</button>
```
The existing tab-switching logic (`querySelectorAll('.tab-btn')`) picks this up
automatically — no JS changes needed for tab activation.

#### 2b. Section container (already present — complete with table header)
```html
<div id="settlement-processes" class="section">
  <div class="reports-table-wrapper">
    <table class="reports-table">
      <thead>
        <tr>
          <th>ישוב</th>
          <th>הופעל על ידי</th>
          <th>זמן התחלה</th>
          <th>זמן סיום</th>
          <th>סטטוס</th>
        </tr>
      </thead>
      <tbody id="settlement-processes-body">
        <tr><td colspan="5" style="text-align:center;padding:40px;">⏳ טוען...</td></tr>
      </tbody>
    </table>
  </div>
</div>
```

#### 2c. `loadSettlementProcesses()` function (already present — verify completeness)

The function must:

1. Set the `tbody` to a loading placeholder.
2. `fetch` `GET ${RETURN_HOME_API_BASE}/settlement-processes`.
3. If the response array is empty → render an empty-state message row.
4. Otherwise → map each record to a `<tr>` with formatted dates and a status badge.
5. On fetch error → render an error message row including retry guidance.

**Status badge mapping:**

| `status` value | CSS class on `.status-badge` | Label |
|---|---|---|
| `PROCESSING` | `waiting` | בעיבוד |
| `COMPLETED` | `restoration-completed` | הושלם |

These reuse the existing `.status-badge.waiting` (orange) and
`.status-badge.restoration-completed` (green) classes — no new CSS is needed.

**Null `completedAt` display:** render `—` (em dash) in the "זמן סיום" cell.

**Date formatting:** use `toLocaleDateString('he-IL')` + `toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })` — matching the pattern already in the file.

**Error state template:**
```html
<tr>
  <td colspan="5" style="text-align:center;color:var(--error-red);padding:20px;">
    שגיאה בטעינת תהליכים. אנא נסה שנית.
  </td>
</tr>
```

**Empty state template:**
```html
<tr><td colspan="5">
  <div class="empty-state" style="padding:40px;margin:0;">
    <div class="empty-state-icon">📋</div>
    <h3>אין תהליכים</h3>
    <p>תהליכי הפקה יופיעו כאן לאחר הפעלת "הפק תיקי אכלוס"</p>
  </div>
</td></tr>
```

#### 2d. Tab activation hook (already present)
```js
} else if (tabName === 'settlement-processes') {
    loadSettlementProcesses();
}
```
This is already wired in the tab-click handler — no change needed.

---

## Data Models

### SettlementProcess record (defined in `settlementProcessStore.js`)

```js
{
  id:             string,   // UUID v4, unique, assigned at creation
  settlementName: string,   // non-blank, from request body
  startedBy:      string,   // non-blank, from request body
  startedAt:      string,   // ISO 8601, set at createProcess() time
  completedAt:    string | null,  // null until completeProcess(); then ISO 8601
  status:         'PROCESSING' | 'COMPLETED'
}
```

### API response envelope

`GET /settlement-processes` → `200 OK`
```json
{
  "success": true,
  "data": [ /* SettlementProcess[], newest first */ ]
}
```

`POST /buildings/batch/return-home-packages` → `400 Bad Request` (new guard)
```json
{ "success": false, "error": "שדה settlementName חסר או ריק" }
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all
valid executions of a system — essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Record creation invariants

*For any* non-blank `settlementName` and `startedBy` strings passed to
`createProcess()`, the returned record SHALL satisfy all of the following
simultaneously:

- `record.settlementName === settlementName`
- `record.startedBy === startedBy`
- `record.status === 'PROCESSING'`
- `record.completedAt === null`
- `record.startedAt` is a valid ISO 8601 date-time string

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

---

### Property 2: Unique IDs across all created records

*For any* sequence of `N ≥ 2` calls to `createProcess()`, all returned `id`
values SHALL be pairwise distinct — no two records share the same `id`.

**Validates: Requirements 1.1**

---

### Property 3: Completion round-trip with chronological ordering

*For any* process record created with `createProcess()`, after calling
`completeProcess(record.id)` the record SHALL satisfy:

- `record.status === 'COMPLETED'`
- `record.completedAt` is a valid ISO 8601 date-time string
- `new Date(record.completedAt) >= new Date(record.startedAt)`

**Validates: Requirements 4.1, 4.2, 4.4**

---

### Property 4: Completion idempotency

*For any* process record that has already been marked `COMPLETED`, calling
`completeProcess(id)` a second time SHALL leave `completedAt` unchanged — the
timestamp recorded on the first completion call is preserved.

**Validates: Requirements 4.3**

---

### Property 5: GET endpoint response envelope and sort order

*For any* store state containing `N ≥ 0` process records, calling
`getAllProcesses()` (and by extension `GET /settlement-processes`) SHALL return
an array where:

- The response envelope shape is `{ success: true, data: Array }`
- `data.length === N`
- For every adjacent pair `(data[i], data[i+1])`, `new Date(data[i].startedAt) >= new Date(data[i+1].startedAt)` (sorted newest-first)

**Validates: Requirements 5.1, 5.2, 5.3**

---

### Property 6: Input validation rejects blank required fields

*For any* POST request to `/buildings/batch/return-home-packages` where
`settlementName` or `startedBy` is absent, `''`, or composed entirely of
whitespace, the server SHALL return `400 Bad Request` and no new
`SettlementProcess` record SHALL be created in the store.

**Validates: Requirements 2.2, 2.3**

---

### Property 7: Null completedAt renders as a dash

*For any* `SettlementProcess` record where `completedAt === null`, the
`loadSettlementProcesses()` rendering function SHALL produce a table cell whose
text content is `'—'` (em dash) in the "זמן סיום" column.

**Validates: Requirements 6.7**

---

## Error Handling

| Scenario | Layer | Response |
|---|---|---|
| `settlementName` absent / blank | Backend batch endpoint | `400` `{ success: false, error: "שדה settlementName חסר או ריק" }` |
| `startedBy` absent / blank | Backend batch endpoint | `400` `{ success: false, error: "שדה startedBy חסר או ריק" }` |
| `ids` missing or empty | Backend batch endpoint | `400` `{ success: false, error: "יש לספק רשימת מזהים" }` (existing) |
| Store throws on `getAllProcesses()` | GET /settlement-processes | `500` `{ success: false, error: "<message>" }` |
| `fetch` fails / times out in frontend | `loadSettlementProcesses()` | Error row: "שגיאה בטעינת תהליכים. אנא נסה שנית." |
| `data.data` is `[]` | `loadSettlementProcesses()` | Empty-state row with icon and description |
| Individual building generation fails | Batch loop | Per-building error pushed to `errors[]`; process still reaches `COMPLETED` |

Frontend error display uses the existing `color: var(--error-red)` inline style
inside a full-width `<td colspan="5">` to stay consistent with other screens.

---

## Testing Strategy

### Unit / Example Tests

These tests cover specific behaviors and error paths that are not universal
properties:

- **400 on missing `ids`** — existing guard still works (regression).
- **500 simulation** — mock `getAllProcesses()` to throw; verify `GET` returns
  `500` with `{ success: false, error: ... }`.
- **Table column order** — render a single record; assert `<th>` order matches
  specification (ישוב / הופעל על ידי / זמן התחלה / זמן סיום / סטטוס).
- **PROCESSING badge class** — render a PROCESSING record; assert the badge has
  class `waiting` and label "בעיבוד".
- **COMPLETED badge class** — render a COMPLETED record; assert the badge has
  class `restoration-completed` and label "הושלם".
- **Error state** — simulate fetch rejection; assert the rendered HTML contains
  "אנא נסה שנית".
- **Empty state** — feed `data: []`; assert "אין תהליכים" message appears.

### Property-Based Tests

Use a property-based testing library (recommended: **fast-check** for Node.js).
Each test runs a minimum of **100 iterations**.

Tag format: `Feature: settlement-process-management, Property <N>: <title>`

| Test | Property | Tag |
|---|---|---|
| Record creation invariants | Property 1 | `Feature: settlement-process-management, Property 1: Record creation invariants` |
| Unique IDs | Property 2 | `Feature: settlement-process-management, Property 2: Unique IDs across all created records` |
| Completion round-trip | Property 3 | `Feature: settlement-process-management, Property 3: Completion round-trip with chronological ordering` |
| Completion idempotency | Property 4 | `Feature: settlement-process-management, Property 4: Completion idempotency` |
| GET envelope + sort | Property 5 | `Feature: settlement-process-management, Property 5: GET endpoint response envelope and sort order` |
| Validation rejects blank fields | Property 6 | `Feature: settlement-process-management, Property 6: Input validation rejects blank required fields` |
| Null completedAt renders dash | Property 7 | `Feature: settlement-process-management, Property 7: Null completedAt renders as a dash` |

**Generator notes:**

- For Properties 1–5: generate `settlementName` and `startedBy` as arbitrary
  non-empty, non-whitespace-only strings (`fc.string({ minLength: 1 })` filtered
  to exclude all-whitespace).
- For Property 2: generate a count `N` in `[2, 20]` and call `createProcess()`
  N times; collect all IDs into a Set and assert `Set.size === N`.
- For Property 5: generate `N` in `[0, 30]` processes, insert with deliberate
  random `startedAt` values (or just sequential calls), then call
  `getAllProcesses()` and verify the sort invariant.
- For Property 6: generate blank strings as `fc.oneof(fc.constant(''), fc.stringOf(fc.constant(' '), { minLength: 1, maxLength: 20 }))`.

### Integration Test

One end-to-end test confirms the full batch flow without breaking existing
behavior:

1. POST `/buildings/batch/return-home-packages` with valid `ids`, `settlementName`,
   `startedBy` (using mock PDF service).
2. Verify response is `200` with `success: true`.
3. GET `/settlement-processes` and verify the first record has `status: COMPLETED`
   and the correct `settlementName` and `startedBy`.

This validates Requirements 2.1, 3.1–3.3, and 4.1 end-to-end.
