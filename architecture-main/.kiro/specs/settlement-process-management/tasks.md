# Implementation Plan: Settlement Process Management

## Overview

Three small, focused changes complete the feature: add two input-validation guards
to the batch endpoint, add error-handling to the GET route, fix the error-state
rendering in `loadSettlementProcesses()`, and write property-based tests covering
the 7 correctness properties from the design.

The store, `createProcess` / `completeProcess` calls, tab button, section markup,
table header, empty-state, status badges, null `completedAt` dash, and
tab-click wiring are **already fully implemented** and must not be touched.

---

## Tasks

- [ ] 1. Add input validation guards to the batch endpoint
  - [-] 1.1 Validate `settlementName` and `startedBy` in the POST handler
    - In `backend/return-home-package-server.js`, immediately after the existing
      `ids` array guard and before the `createProcess()` call, add:
      ```js
      if (!settlementName || !settlementName.trim()) {
        return res.status(400).json({ success: false, error: 'שדה settlementName חסר או ריק' });
      }
      if (!startedBy || !startedBy.trim()) {
        return res.status(400).json({ success: false, error: 'שדה startedBy חסר או ריק' });
      }
      ```
    - Remove the `|| 'לא ידוע'` fallbacks from the `createProcess()` call so
      it becomes `createProcess(settlementName, startedBy)`.
    - _Requirements: 2.2, 2.3_

- [ ] 2. Add error handling to `GET /settlement-processes`
  - [-] 2.1 Wrap `getAllProcesses()` in a try/catch and return 500 on failure
    - In `backend/return-home-package-server.js`, replace the current one-liner
      `GET /settlement-processes` handler with:
      ```js
      app.get('/settlement-processes', (req, res) => {
        try {
          res.json({ success: true, data: getAllProcesses() });
        } catch (err) {
          res.status(500).json({ success: false, error: err.message });
        }
      });
      ```
    - _Requirements: 5.4_

- [ ] 3. Fix the error-state template in `loadSettlementProcesses()`
  - [-] 3.1 Update the catch block in `frontend/index.html` to match the design spec
    - Replace the current catch-block `tbody.innerHTML` (which uses plain `red`
      and exposes `err.message`) with the design-specified template:
      ```html
      <tr>
        <td colspan="5" style="text-align:center;color:var(--error-red);padding:20px;">
          שגיאה בטעינת תהליכים. אנא נסה שנית.
        </td>
      </tr>
      ```
    - _Requirements: 6.8_

- [~] 4. Checkpoint — verify backend changes manually
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Install fast-check and write property-based tests
  - [~] 5.1 Install fast-check as a dev dependency
    - Run `npm install --save-dev fast-check` in the workspace root.
    - Add a `"test"` script to `package.json`:
      `"test": "node --experimental-vm-modules node_modules/.bin/jest --testPathPattern=tests/"` 
      **or**, since the project uses ESM and has no test runner yet, use Node's
      built-in test runner:
      `"test": "node --test tests/settlementProcess.test.js"`
    - Create the `tests/` directory and `tests/settlementProcess.test.js` file.
    - _Requirements: (testing infrastructure)_

  - [ ]* 5.2 Write property test for Property 1 — Record creation invariants
    - **Property 1: Record creation invariants**
    - For any non-blank `settlementName` and `startedBy`, `createProcess()` must
      return a record where `settlementName` and `startedBy` match the inputs,
      `status === 'PROCESSING'`, `completedAt === null`, and `startedAt` is a
      valid ISO 8601 string.
    - Use `fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)` for
      both fields.
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

  - [ ]* 5.3 Write property test for Property 2 — Unique IDs
    - **Property 2: Unique IDs across all created records**
    - Generate a count `N` in `[2, 20]`; call `createProcess()` N times; collect
      all `id` values into a `Set` and assert `Set.size === N`.
    - Reset the store between runs (export a `_reset()` helper for tests, or
      re-import a fresh module instance using `--experimental-vm-modules`).
    - **Validates: Requirements 1.1**

  - [ ]* 5.4 Write property test for Property 3 — Completion round-trip
    - **Property 3: Completion round-trip with chronological ordering**
    - Create a process, call `completeProcess(record.id)`, then assert
      `status === 'COMPLETED'`, `completedAt` is a valid ISO 8601 string, and
      `new Date(completedAt) >= new Date(startedAt)`.
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [ ]* 5.5 Write property test for Property 4 — Completion idempotency
    - **Property 4: Completion idempotency**
    - Create and complete a process; record the first `completedAt`; call
      `completeProcess(id)` a second time; assert the `completedAt` is unchanged.
    - **Validates: Requirements 4.3**

  - [ ]* 5.6 Write property test for Property 5 — GET envelope and sort order
    - **Property 5: GET endpoint response envelope and sort order**
    - Generate `N` in `[0, 30]`; insert N processes; call `getAllProcesses()`;
      assert the array length equals N and for every adjacent pair
      `new Date(data[i].startedAt) >= new Date(data[i+1].startedAt)`.
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 5.7 Write property test for Property 6 — Validation rejects blank fields
    - **Property 6: Input validation rejects blank required fields**
    - Generate blank strings via
      `fc.oneof(fc.constant(''), fc.stringOf(fc.constant(' '), { minLength: 1, maxLength: 20 }))`.
    - For each combination of blank `settlementName` / `startedBy`, make an
      in-process call to the route handler (or use supertest) and assert a `400`
      response is returned and no new record is created in the store.
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 5.8 Write property test for Property 7 — Null completedAt renders as dash
    - **Property 7: Null completedAt renders as a dash**
    - Extract the cell-rendering logic from `loadSettlementProcesses()` into a
      pure helper `renderCompletedAt(completedAt)` that returns a string.
    - For any record where `completedAt === null`, assert
      `renderCompletedAt(null) === '—'`.
    - For any valid ISO 8601 date string, assert the result is a non-empty string
      that is not `'—'`.
    - **Validates: Requirements 6.7**

- [~] 6. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Tasks 1 and 2 are pure additive changes — no existing logic is removed beyond
  the `|| 'לא ידוע'` fallbacks that the design explicitly calls out for removal.
- For the property tests (task 5), the store module must expose a `_reset()`
  test-only export, or each test suite must re-import a fresh module instance,
  to keep tests independent.
- Property test tags follow the format:
  `Feature: settlement-process-management, Property N: <title>`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["5.1"] },
    { "id": 2, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8"] }
  ]
}
```
