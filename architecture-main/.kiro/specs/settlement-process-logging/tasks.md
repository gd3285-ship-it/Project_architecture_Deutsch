# Implementation Plan: Settlement Process Logging

## Overview

Add structured, append-only JSON-Lines logging to `backend/return-home-package-server.js` via a new `backend/logger.js` module. The implementation is purely additive: **`backend/services/returnHomePackageService.js` must NOT be modified under any circumstances.** All changes are limited to creating `logger.js` and injecting `log()` calls into the server file.

## Tasks

- [ ] 1. Create `backend/logger.js` — the Logger module
  - [ ] 1.1 Implement the `log(level, event, fields)` function
    - Use Node.js built-in `fs`, `path`, and `url` modules only — no third-party dependencies
    - Resolve `LOG_DIR` as `backend/logs/` and `LOG_FILE` as `backend/logs/settlement-process.log` using `import.meta.url` / `fileURLToPath`
    - Implement `ensureLogDir()`: call `fs.mkdirSync(LOG_DIR, { recursive: true })` if the directory does not exist
    - Build the entry object with exactly seven fields: `timestamp` (ISO 8601 via `new Date().toISOString()`), `level`, `event`, `settlementName`, `buildingId`, `attemptNumber`, `errorMessage`; default every missing field to `null`
    - Append the serialised entry with `fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8')`
    - Wrap the entire body in a `try/catch` that swallows all errors silently — the function must never throw
    - Export `log` as a named export: `export function log(...) { ... }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.7_

  - [ ]* 1.2 Write property test — Property 1: Log Entry Structure Invariant
    - **Property 1: Log Entry Structure Invariant**
    - For any call to `log(level, event, fields)` the appended line must be valid JSON containing exactly the seven required keys and any unset optional fields must be `null`
    - Generators: `fc.constantFrom('INFO','WARN','ERROR')` for level; `fc.string()` for event; `fc.option(fc.string(), {nil:null})` for settlementName / errorMessage; `fc.option(fc.uuid(), {nil:null})` for buildingId; `fc.option(fc.integer({min:1,max:3}), {nil:null})` for attemptNumber
    - Redirect `LOG_FILE` to a temp file (or in-memory buffer via `mock`) for each run; read back the last line and assert key set and null-defaults
    - Run minimum 100 iterations
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 1.3 Write property test — Property 2: Append-Only Accumulation
    - **Property 2: Append-Only Accumulation**
    - For any sequence of N `log()` calls the log file must contain exactly N lines and every previously written line must be byte-for-byte intact
    - Generate an arbitrary list of `{level, event, fields}` tuples (1–20 entries), call `log()` for each, split file on `\n`, assert `lines.length === N` and that each parsed line matches the original call
    - Run minimum 100 iterations
    - **Validates: Requirements 1.5, 5.3, 5.4**

  - [ ]* 1.4 Write property test — Property 3: Write-Failure Isolation
    - **Property 3: Write-Failure Isolation**
    - For any simulated `fs.appendFileSync` failure, `log()` must return `undefined` without throwing
    - Use `jest.spyOn` (or equivalent) to make `fs.appendFileSync` throw with a generated error message; call `log()` and assert it does not throw and returns `undefined`
    - Run minimum 100 iterations
    - **Validates: Requirements 5.6, 6.7**

- [ ] 2. Modify `backend/return-home-package-server.js` — inject log calls
  - > ⚠️ **`backend/services/returnHomePackageService.js` must NOT be modified.** PDF-generation log events are injected in the server by wrapping the existing `generateReturnHomePackage()` call. Do not touch any file under `backend/services/`.

  - [~] 2.1 Import logger and update `sendNotification()` signature
    - Add `import { log } from './logger.js';` at the top of the file
    - Change `sendNotification(report)` → `sendNotification(report, settlementName)` — signature only; the retry loop, idempotency key, payload, and HTTP call remain byte-for-byte identical
    - Inside the attempt loop add the five notification log calls in order:
      - If `attempt > 1`: `log('INFO', 'NOTIFICATION_RETRY_STARTED', { settlementName, buildingId: report.id, attemptNumber: attempt })`
      - Before the fetch: `log('INFO', 'NOTIFICATION_SEND_STARTED', { settlementName, buildingId: report.id, attemptNumber: attempt })`
      - On status-based failure: `log('WARN', 'NOTIFICATION_DELIVERY_FAILED', { settlementName, buildingId: report.id, attemptNumber: attempt, errorMessage: \`Unexpected status: ${result.data?.status ?? 'unknown'}\` })`
      - On exception-based failure: `log('WARN', 'NOTIFICATION_DELIVERY_FAILED', { settlementName, buildingId: report.id, attemptNumber: attempt, errorMessage: err.message ?? '' })`
      - On `status === 'SENT'`: `log('INFO', 'NOTIFICATION_DELIVERY_SUCCESS', { settlementName, buildingId: report.id, attemptNumber: attempt })`
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 4.4, 4.5, 4.6, 4.7, 6.2, 6.3_

  - [~] 2.2 Inject log calls into the batch endpoint (`POST /buildings/batch/return-home-packages`)
    - Restructure the handler to separate the fetch+filter loop from the generate+notify loop (this is additive — HTTP responses and stored process entity remain unchanged)
    - After destructuring `{ ids, settlementName, startedBy }`: `log('INFO', 'BATCH_PROCESS_STARTED', { settlementName })`
    - After the fetch+filter loop completes: `log('INFO', 'BATCH_ELIGIBLE_BUILDINGS_COUNT', { settlementName })`
    - If `eligibleReports.length === 0`: `log('INFO', 'BATCH_NO_ELIGIBLE_BUILDINGS', { settlementName })`
    - At the start of each building iteration: `log('INFO', 'BUILDING_PROCESSING_STARTED', { settlementName, buildingId: report.id })`
    - Before `generateReturnHomePackage(report)`: `log('INFO', 'PDF_GENERATION_STARTED', { settlementName, buildingId: report.id })`
    - After successful return: `log('INFO', 'PDF_GENERATION_COMPLETED', { settlementName, buildingId: report.id })`
    - In the per-building catch block: `log('ERROR', 'PDF_GENERATION_FAILED', { settlementName, buildingId: report.id, errorMessage: error.message })`
    - After `sendNotification(report, settlementName)`: `log('INFO', 'BUILDING_PROCESSING_COMPLETED', { settlementName, buildingId: report.id })`
    - After `completeProcess()`: `log('INFO', 'BATCH_PROCESS_COMPLETED', { settlementName })`
    - In the outer catch block: `log('ERROR', 'BATCH_PROCESS_FAILED', { settlementName, errorMessage: error.message ?? '' })`
    - Update all `sendNotification(report)` calls in this handler to `sendNotification(report, settlementName)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.9_

  - [~] 2.3 Inject log calls into the single-building endpoint (`POST /buildings/:id/return-home-package`)
    - Before PDF generation: `log('INFO', 'BUILDING_PROCESSING_STARTED', { buildingId: report.id, settlementName: null })`
    - Before `generateReturnHomePackage(report)`: `log('INFO', 'PDF_GENERATION_STARTED', { buildingId: report.id, settlementName: null })`
    - After successful return: `log('INFO', 'PDF_GENERATION_COMPLETED', { buildingId: report.id, settlementName: null })`
    - In the catch block (if PDF generation throws): `log('ERROR', 'PDF_GENERATION_FAILED', { buildingId: report.id, settlementName: null, errorMessage: error.message })`
    - After `sendNotification(report, null)`: `log('INFO', 'BUILDING_PROCESSING_COMPLETED', { buildingId: report.id, settlementName: null })`
    - Update `sendNotification(report)` to `sendNotification(report, null)`
    - _Requirements: 4.1, 4.2, 4.3, 4.8_

  - [ ]* 2.4 Write property test — Property 4: Batch Lifecycle Event Fields
    - **Property 4: Batch Lifecycle Event Fields**
    - For any valid batch request with a given `settlementName` and non-empty `ids`, `BATCH_PROCESS_STARTED` must be the first logged event, carry the correct `settlementName`, and `BATCH_PROCESS_COMPLETED` (or `BATCH_PROCESS_FAILED`) must be the final batch-level event with the same `settlementName`
    - Mock `fetchBuildingReport()` and `generateReturnHomePackage()` to return generated values; capture log output to an in-memory array; assert ordering and field values
    - Generators: `fc.string({minLength:1})` for settlementName; `fc.array(fc.uuid(), {minLength:1, maxLength:5})` for ids
    - Run minimum 100 iterations
    - **Validates: Requirements 2.1, 2.4, 2.5**

  - [ ]* 2.5 Write property test — Property 5: Building-Level Batch Events Carry Correct Context
    - **Property 5: Building-Level Batch Events Carry Correct Context**
    - For any building processed within a batch, the events `BUILDING_PROCESSING_STARTED`, `PDF_GENERATION_STARTED`, `PDF_GENERATION_COMPLETED` (or `PDF_GENERATION_FAILED`), and `BUILDING_PROCESSING_COMPLETED` must all carry the same `settlementName` from the batch request and the matching `buildingId`
    - Mock service dependencies; for each generated building assert that all its scoped log entries share the same `settlementName` and `buildingId`
    - Generators: `fc.string({minLength:1})` for settlementName; `fc.array(fc.uuid(), {minLength:1, maxLength:5})` for building IDs
    - Run minimum 100 iterations
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.9**

  - [ ]* 2.6 Write property test — Property 6: Single-Building Events Always Have `settlementName = null`
    - **Property 6: Single-Building Events Always Have `settlementName = null`**
    - For any call to the single-building endpoint, every log entry produced during that request must have `settlementName === null` and `buildingId` equal to the requested building's ID
    - Mock service dependencies; capture log entries and assert every entry has `settlementName === null` and `buildingId === requestedId`
    - Generators: `fc.uuid()` for buildingId; randomly decide whether PDF generation succeeds or throws
    - Run minimum 100 iterations
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8**

  - [ ]* 2.7 Write property test — Property 7: Eligible Building Count Accuracy
    - **Property 7: Eligible Building Count Accuracy**
    - For any batch request where some buildings are fetchable and some are not, the count value associated with `BATCH_ELIGIBLE_BUILDINGS_COUNT` must equal the number of buildings for which `fetchBuildingReport()` returned a non-null report
    - Generate an array of building IDs where each is independently assigned a fetchable (returns report) or non-fetchable (returns null or throws) status; run batch handler; assert `BATCH_ELIGIBLE_BUILDINGS_COUNT` corresponds to the eligible subset
    - Generators: `fc.array(fc.record({ id: fc.uuid(), fetchable: fc.boolean() }), {minLength:1, maxLength:10})`
    - Run minimum 100 iterations
    - **Validates: Requirements 2.2, 2.3**

- [~] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- **`backend/services/returnHomePackageService.js` must NOT be modified at any point** — this is a hard constraint from the design; PDF-generation events are logged by wrapping `generateReturnHomePackage()` in the server file
- Each task references specific requirements for traceability
- Property tests use **fast-check** (`fc`) with a minimum of 100 iterations each
- All seven correctness properties defined in the design document have corresponding property test sub-tasks (1.2, 1.3, 1.4, 2.4, 2.5, 2.6, 2.7)
- Unit tests and property tests are complementary; both should be present for full coverage

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6", "2.7"] }
  ]
}
```
