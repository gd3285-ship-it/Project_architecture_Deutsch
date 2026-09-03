# Requirements Document

## Introduction

This feature adds the capability to manage and track every execution of the "Generate Settlement Re-Occupancy Files" process. When the batch generation action is triggered, a new `SettlementProcess` record is created with status `PROCESSING`. Once the process finishes, the record is updated to `COMPLETED` with a completion timestamp. A dedicated "Settlement Processes" screen displays all records sorted by most recent first.

The implementation must not modify any existing background processing, retry logic, idempotency, notification server, or PDF generation logic.

## Glossary

- **Settlement_Process**: A record that represents a single execution of the "Generate Settlement Re-Occupancy Files" process, identified by a unique ID and carrying its lifecycle state.
- **Settlement_Process_Store**: The in-memory data store that persists `SettlementProcess` records for the lifetime of the server process.
- **Return_Home_Package_Server**: The backend service (port 3002) that owns the batch generation endpoint and is responsible for creating and completing `SettlementProcess` records.
- **Settlement_Processes_Screen**: The frontend UI screen that lists all `SettlementProcess` records in a table, sorted newest-first.
- **Batch_Generation_Action**: The user-triggered action that calls `POST /buildings/batch/return-home-packages` and initiates the settlement re-occupancy file generation for a set of buildings.
- **Status**: The lifecycle state of a `SettlementProcess`; either `PROCESSING` or `COMPLETED`.

---

## Requirements

### Requirement 1: SettlementProcess Entity Definition

**User Story:** As a system architect, I want a well-defined `SettlementProcess` entity, so that every execution of the generation process is represented by a consistent, identifiable record.

#### Acceptance Criteria

1. THE Settlement_Process_Store SHALL assign a unique identifier (`id`) to every `SettlementProcess` record at creation time.
2. THE Settlement_Process_Store SHALL store the settlement name (`settlementName`) on every `SettlementProcess` record.
3. THE Settlement_Process_Store SHALL store the full name of the user who initiated the process (`startedBy`) on every `SettlementProcess` record.
4. THE Settlement_Process_Store SHALL store the creation timestamp (`startedAt`) as an ISO 8601 date-time string on every `SettlementProcess` record.
5. THE Settlement_Process_Store SHALL store the completion timestamp (`completedAt`) on every `SettlementProcess` record, initialised to `null` at creation time.
6. THE Settlement_Process_Store SHALL store the status (`status`) on every `SettlementProcess` record; the only permitted values are `PROCESSING` and `COMPLETED`, and the initial value assigned at creation SHALL be `PROCESSING`.

---

### Requirement 2: Process Initiation on Batch Generation Trigger

**User Story:** As an operator, I want a `SettlementProcess` record to be created the moment I trigger batch generation, so that the operation is tracked from its very start.

#### Acceptance Criteria

1. WHEN the Batch_Generation_Action is triggered, THE Return_Home_Package_Server SHALL create a new `SettlementProcess` record before any file generation begins.
2. WHEN the Batch_Generation_Action is triggered with a valid non-blank `settlementName` in the request body, THE Return_Home_Package_Server SHALL set the `settlementName` field of the new record to that value; IF `settlementName` is absent or blank, THE Return_Home_Package_Server SHALL return a `400 Bad Request` response and SHALL NOT create a record.
3. WHEN the Batch_Generation_Action is triggered with a valid non-blank `startedBy` in the request body, THE Return_Home_Package_Server SHALL set the `startedBy` field of the new record to that value; IF `startedBy` is absent or blank, THE Return_Home_Package_Server SHALL return a `400 Bad Request` response and SHALL NOT create a record.
4. WHEN the Batch_Generation_Action is triggered, THE Return_Home_Package_Server SHALL set the `startedAt` field to the current server timestamp at the moment of record creation.
5. WHEN the Batch_Generation_Action is triggered, THE Return_Home_Package_Server SHALL set the `status` of the new record to `PROCESSING`.
6. IF the Settlement_Process_Store fails to persist the new record, THEN THE Return_Home_Package_Server SHALL return a `500 Internal Server Error` response and SHALL NOT proceed with file generation.

---

### Requirement 3: No Modification of Existing Generation Workflow

**User Story:** As a system engineer, I want the existing generation pipeline to remain completely unchanged, so that reliability and correctness of file generation are not affected.

#### Acceptance Criteria

1. THE Return_Home_Package_Server SHALL add the `SettlementProcess` tracking code as an additive layer only; the existing background processing, retry logic, and idempotency mechanisms SHALL execute with the same logic, arguments, and execution order as before this feature was introduced.
2. WHEN the Batch_Generation_Action is executing, THE Return_Home_Package_Server SHALL invoke the notification server at the same point in the execution sequence and with the same arguments as before this feature was introduced.
3. WHEN the Batch_Generation_Action is executing, THE Return_Home_Package_Server SHALL invoke the PDF generation logic at the same point in the execution sequence and with the same arguments as before this feature was introduced.

---

### Requirement 4: Process Completion Recording

**User Story:** As an operator, I want to see when a process finished, so that I can confirm generation completed and measure how long it took.

#### Acceptance Criteria

1. WHEN the Batch_Generation_Action finishes executing successfully for all requested buildings, THE Return_Home_Package_Server SHALL atomically update the `status` to `COMPLETED` and set `completedAt` to the current server timestamp in a single write operation on the corresponding `SettlementProcess` record.
2. WHEN the Batch_Generation_Action finishes but one or more buildings fail to process, THE Return_Home_Package_Server SHALL atomically update the `status` to `COMPLETED` and set `completedAt` to the current server timestamp, reflecting that the process run itself finished (regardless of per-building outcomes).
3. THE Settlement_Process_Store SHALL NOT apply a completion update to a `SettlementProcess` record whose `status` is already `COMPLETED`; any such attempted write SHALL be silently ignored to preserve data integrity.
4. THE Settlement_Process_Store SHALL ensure that the `completedAt` value on any `COMPLETED` record is a valid ISO 8601 date-time string that is chronologically equal to or later than the `startedAt` value of the same record.

---

### Requirement 5: Settlement Processes API Endpoint

**User Story:** As a frontend developer, I want a dedicated API endpoint that returns all settlement process records, so that the UI can display the full list without coupling to the internal data store.

#### Acceptance Criteria

1. THE Return_Home_Package_Server SHALL expose a `GET /settlement-processes` endpoint that returns all `SettlementProcess` records in a response envelope of the form `{ "success": true, "data": [...] }`.
2. WHEN `GET /settlement-processes` is called, THE Return_Home_Package_Server SHALL return the records sorted by `startedAt` in descending order (newest first).
3. IF `GET /settlement-processes` is called and no records exist, THEN THE Return_Home_Package_Server SHALL return `{ "success": true, "data": [] }` with a `200 OK` status (not `404 NOT FOUND`).
4. IF the Settlement_Process_Store fails to retrieve records, THEN THE Return_Home_Package_Server SHALL return a `500 Internal Server Error` response with `{ "success": false, "error": "<message>" }`.

---

### Requirement 6: Settlement Processes Screen

**User Story:** As an operator, I want a dedicated "Settlement Processes" screen in the application, so that I can see a high-level overview of all generation runs at a glance.

#### Acceptance Criteria

1. THE Settlement_Processes_Screen SHALL display a table with the following columns in this order: Settlement, Started By, Started At, Completed At, Status.
2. WHEN the Settlement_Processes_Screen loads, THE Settlement_Processes_Screen SHALL fetch all records from `GET /settlement-processes` and render them in the table within 5 seconds under normal network conditions.
3. WHEN the Settlement_Processes_Screen renders the table, THE Settlement_Processes_Screen SHALL display records sorted by `startedAt` descending, with the most recent process appearing first.
4. WHEN the Settlement_Processes_Screen renders the table and a record has `status` equal to `PROCESSING`, THE Settlement_Processes_Screen SHALL display a visual indicator (e.g. badge or pill) that is visually distinct from the indicator used for `COMPLETED`.
5. WHEN the Settlement_Processes_Screen renders the table and a record has `status` equal to `COMPLETED`, THE Settlement_Processes_Screen SHALL display a visual indicator that is visually distinct from the indicator used for `PROCESSING`.
6. IF the visual status indicator fails to render due to a UI error, THEN THE Settlement_Processes_Screen SHALL still display the record row with the remaining columns intact.
7. WHEN a `SettlementProcess` record has `completedAt` equal to `null`, THE Settlement_Processes_Screen SHALL display a dash (`—`) or equivalent placeholder in the Completed At column cell.
8. IF the fetch from `GET /settlement-processes` fails or times out, THEN THE Settlement_Processes_Screen SHALL display a user-readable error message that includes guidance to retry (e.g. "Failed to load processes. Please try again.").
9. WHEN the Settlement_Processes_Screen loads and the returned `data` array is empty, THE Settlement_Processes_Screen SHALL display an empty-state message such as "No settlement processes have been run yet." in place of the table body.
