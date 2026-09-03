# Requirements Document

## Introduction

This feature introduces technical logging to the Settlement Re-Occupancy Process in the `return-home-package-server.js` service (Node.js/Express, port 3002). The logging capability enables developers and operators to track and understand what occurred during a process execution — both for batch (locality-wide) generation and for single-building generation — without modifying any existing business logic, retry mechanisms, notification workflows, or the SettlementProcess entity.

Logs are written to a persistent log file using Node.js built-in file I/O. No external logging library is introduced. Each log entry is a structured JSON line including a timestamp, log level, event name, and relevant contextual fields.

## Glossary

- **Logger**: The logging module responsible for writing structured log entries to the log file.
- **Log_File**: The file on disk where all log entries are appended, located at `backend/logs/settlement-process.log`.
- **Log_Entry**: A single line of JSON written to the Log_File, containing all required fields for a logged event.
- **Batch_Process**: The execution triggered by `POST /buildings/batch/return-home-packages`, generating re-occupancy files for multiple buildings.
- **Single_Building_Process**: The execution triggered by `POST /buildings/:id/return-home-package`, generating a re-occupancy file for one building.
- **Building**: A structure identified by a unique `buildingId` for which a return-home package is generated.
- **Settlement**: A locality identified by its `settlementName`, grouping multiple buildings in a Batch_Process.
- **Notification**: An email delivery attempt sent via the notification server (port 3003) after PDF generation.
- **Attempt_Number**: The sequential number (1 to MAX_ATTEMPTS) of a Notification delivery attempt.
- **PDF_Generation**: The operation performed by `generateReturnHomePackage()` in `returnHomePackageService.js` that creates a PDF file.
- **Correlation_ID**: A UUID (v4) generated once at the start of each process execution (Batch_Process or Single_Building_Process) and passed to every Logger call made during that execution, enabling all Log_Entries for a single run to be identified by a shared identifier.

---

## Requirements

### Requirement 1: Logger Module

**User Story:** As a developer, I want a dedicated logging module, so that log writing logic is centralized and reusable across the service without duplicating code.

#### Acceptance Criteria

1. THE Logger SHALL write each Log_Entry as a single JSON-formatted line appended to the Log_File.
2. THE Logger SHALL include exactly the following eight fields in every Log_Entry — no more, no fewer: `timestamp` (ISO 8601 wall-clock time at the moment of the log call), `level` (one of `INFO`, `WARN`, or `ERROR`), `event` (non-empty string, maximum 200 characters), `correlationId` (UUID v4 string or null), `settlementName` (string or null), `buildingId` (string or null), `attemptNumber` (integer ≥ 1 or null), and `errorMessage` (string or null).
3. IF a field is not applicable to a given event, THEN THE Logger SHALL write that field as `null` in the Log_Entry.
4. IF the `backend/logs/` directory does not exist at startup, THEN THE Logger SHALL create it before writing the first Log_Entry.
5. THE Logger SHALL append Log_Entries to the Log_File without truncating existing content.
6. THE Logger SHALL NOT include any of the following prohibited data categories in any Log_Entry: passwords, authentication tokens, session secrets, email body text, or raw binary/base64 file content.
7. THE Logger SHALL expose a callable interface that accepts the following caller-supplied fields: `level`, `event`, `correlationId`, `settlementName`, `buildingId`, `attemptNumber`, and `errorMessage`; the Logger itself SHALL generate `timestamp` automatically from the system clock at call time.
8. IF the caller passes a `level` value that is not one of `INFO`, `WARN`, or `ERROR`, THEN THE Logger SHALL NOT write a Log_Entry and SHALL return without throwing an exception.
9. IF a write to the Log_File fails due to a filesystem error, THEN THE Logger SHALL catch the error internally, SHALL NOT throw an exception to the caller, and SHALL NOT alter any program state outside the Logger module.

---

### Requirement 2: Batch Process — Locality-Level Log Injection Points

**User Story:** As a developer, I want the Batch_Process to log key lifecycle events at the locality level, so that I can determine when a batch started, how many buildings were targeted, and whether it completed or failed.

#### Acceptance Criteria

1. WHEN the Batch_Process begins execution, THE Logger SHALL write an `INFO` Log_Entry with event `BATCH_PROCESS_STARTED`, including the `settlementName` and the total count of building IDs received in the request.
2. WHEN the `ids` array validation completes, THE Logger SHALL write an `INFO` Log_Entry with event `BATCH_ELIGIBLE_BUILDINGS_COUNT`, including the `settlementName` and the count of eligible buildings.
3. IF the count of eligible buildings after validation is zero, THEN THE Logger SHALL write an `INFO` Log_Entry with event `BATCH_NO_ELIGIBLE_BUILDINGS`, including the `settlementName`.
4. WHEN the Batch_Process completes successfully (after `completeProcess()` is called), THE Logger SHALL write an `INFO` Log_Entry with event `BATCH_PROCESS_COMPLETED`, including the `settlementName` and the count of successfully processed buildings.
5. IF an unhandled exception propagates out of the Batch_Process handler, THEN THE Logger SHALL write an `ERROR` Log_Entry with event `BATCH_PROCESS_FAILED`, including the `settlementName` and the `errorMessage` from the exception; IF the exception carries no message, THE Logger SHALL write `errorMessage` as an empty string.

---

### Requirement 3: Batch Process — Building-Level Log Injection Points

**User Story:** As a developer, I want the Batch_Process to log fine-grained events for each Building processed, so that I can trace exactly what happened for each building within a batch.

#### Acceptance Criteria

1. WHEN processing begins for a Building within the Batch_Process, THE Logger SHALL write an `INFO` Log_Entry with event `BUILDING_PROCESSING_STARTED`, including the `settlementName` and `buildingId`.
2. WHEN PDF generation starts for a Building within the Batch_Process, THE Logger SHALL write an `INFO` Log_Entry with event `PDF_GENERATION_STARTED`, including the `settlementName` and `buildingId`.
3. WHEN PDF generation completes successfully for a Building within the Batch_Process, THE Logger SHALL write an `INFO` Log_Entry with event `PDF_GENERATION_COMPLETED`, including the `settlementName` and `buildingId`.
4. IF PDF generation fails for a Building within the Batch_Process (an exception is thrown by `generateReturnHomePackage()`), THEN THE Logger SHALL write an `ERROR` Log_Entry with event `PDF_GENERATION_FAILED`, including the `settlementName`, `buildingId`, and `errorMessage`.
5. WHEN a Notification delivery attempt begins for a Building within the Batch_Process, THE Logger SHALL write an `INFO` Log_Entry with event `NOTIFICATION_SEND_STARTED`, including the `settlementName`, `buildingId`, and `attemptNumber`.
6. WHEN a Notification delivery attempt fails for a Building within the Batch_Process (the response status is not `SENT` or an exception is caught), THE Logger SHALL write a `WARN` Log_Entry with event `NOTIFICATION_DELIVERY_FAILED`, including the `settlementName`, `buildingId`, `attemptNumber`, and `errorMessage`; IF the failure is status-based (response received but status is not `SENT`), THE Logger SHALL set `errorMessage` to a string describing the received status.
7. WHEN a retry attempt starts for a Building within the Batch_Process (i.e., `attemptNumber` is 2 or greater), THE Logger SHALL write an `INFO` Log_Entry with event `NOTIFICATION_RETRY_STARTED`, including the `settlementName`, `buildingId`, and `attemptNumber`.
8. WHEN a Notification is delivered successfully for a Building within the Batch_Process, THE Logger SHALL write an `INFO` Log_Entry with event `NOTIFICATION_DELIVERY_SUCCESS`, including the `settlementName`, `buildingId`, and `attemptNumber`.
9. WHEN processing of a Building within the Batch_Process concludes (regardless of success or failure outcome), THE Logger SHALL write an `INFO` Log_Entry with event `BUILDING_PROCESSING_COMPLETED`, including the `settlementName` and `buildingId`.

---

### Requirement 4: Single-Building Process — Log Injection Points

**User Story:** As a developer, I want the Single_Building_Process to log the same building-level events as the Batch_Process, so that single-building executions are equally traceable.

#### Acceptance Criteria

1. WHEN processing begins for a Building in the Single_Building_Process, THE Logger SHALL write an `INFO` Log_Entry with event `BUILDING_PROCESSING_STARTED`, including the `buildingId` and `settlementName` as `null`.
2. WHEN PDF generation starts for a Building in the Single_Building_Process, THE Logger SHALL write an `INFO` Log_Entry with event `PDF_GENERATION_STARTED`, including the `buildingId` and `settlementName` as `null`.
3. WHEN PDF generation completes successfully for a Building in the Single_Building_Process, THE Logger SHALL write an `INFO` Log_Entry with event `PDF_GENERATION_COMPLETED`, including the `buildingId` and `settlementName` as `null`.
4. WHEN a Notification delivery attempt begins for a Building in the Single_Building_Process, THE Logger SHALL write an `INFO` Log_Entry with event `NOTIFICATION_SEND_STARTED`, including the `buildingId`, `attemptNumber`, and `settlementName` as `null`.
5. WHEN a Notification delivery attempt fails for a Building in the Single_Building_Process (the response status is not `SENT` or an exception is caught), THE Logger SHALL write a `WARN` Log_Entry with event `NOTIFICATION_DELIVERY_FAILED`, including the `buildingId`, `attemptNumber`, `errorMessage`, and `settlementName` as `null`.
6. WHEN a retry attempt starts for a Building in the Single_Building_Process (i.e., `attemptNumber` is 2 or greater), THE Logger SHALL write an `INFO` Log_Entry with event `NOTIFICATION_RETRY_STARTED`, including the `buildingId`, `attemptNumber`, and `settlementName` as `null`.
7. WHEN a Notification is delivered successfully for a Building in the Single_Building_Process, THE Logger SHALL write an `INFO` Log_Entry with event `NOTIFICATION_DELIVERY_SUCCESS`, including the `buildingId`, `attemptNumber`, and `settlementName` as `null`.
8. WHEN processing of a Building completes in the Single_Building_Process (regardless of outcome), THE Logger SHALL write an `INFO` Log_Entry with event `BUILDING_PROCESSING_COMPLETED`, including the `buildingId` and `settlementName` as `null`.

---

### Requirement 5: Log File Management

**User Story:** As a developer, I want the log file to be persistently stored and inspectable after process execution, so that I can review what happened without interrupting a running service.

#### Acceptance Criteria

1. THE Logger SHALL write all Log_Entries to the file path `backend/logs/settlement-process.log` relative to the project root.
2. THE Logger SHALL use Node.js built-in file system APIs (`fs`) to write to the Log_File, without introducing any third-party logging library.
3. WHILE the service is running, THE Logger SHALL write new Log_Entries in append mode without requiring a service restart between calls.
4. THE Log_File SHALL be a plain text file where each line is a valid JSON object, with each Log_Entry separated by a newline character.
5. IF the `backend/logs/` directory or the Log_File does not exist when the Logger is initialized, THEN THE Logger SHALL create the directory and file before writing the first Log_Entry.
6. IF a write to the Log_File fails, THEN THE Logger SHALL catch the error internally and SHALL NOT throw an exception to the caller; previously written entries SHALL remain intact in the Log_File.

---

### Requirement 6: Scope Restrictions

**User Story:** As a developer, I want the logging feature to be additive only, so that no existing behavior, performance characteristics, or data structures are altered.

#### Acceptance Criteria

1. THE Logger SHALL NOT modify the PDF generation workflow inside `returnHomePackageService.js`.
2. THE Logger SHALL NOT modify the retry logic or Attempt_Number thresholds in `sendNotification()`.
3. THE Logger SHALL NOT modify the idempotency key generation in `sendNotification()`.
4. THE Logger SHALL NOT modify the SettlementProcess entity or its store operations (`createProcess`, `completeProcess`).
5. THE Logger SHALL NOT modify the notification server (port 3003) or any of its endpoints.
6. THE Logger SHALL NOT expose a UI screen, dashboard, metrics endpoint, log-query API, or monitoring alert as part of this feature.
7. IF a log write operation fails, THEN THE Logger SHALL catch the error internally, SHALL NOT propagate an exception to the caller, and SHALL NOT alter the caller's return value or any program state outside the Logger module.
8. THE Correlation_ID SHALL NOT be stored as a field in the SettlementProcess entity or its in-memory store; THE Correlation_ID SHALL exist solely within the Logger scope for the duration of a single process execution.

---

### Requirement 7: Process-Level Correlation ID

**User Story:** As a developer, I want every log entry produced during a single process execution to share a unique identifier, so that I can filter the log file and isolate all entries belonging to one specific run when multiple processes execute concurrently.

#### Acceptance Criteria

1. WHEN a Batch_Process execution begins, THE Logger-caller SHALL generate a single Correlation_ID (UUID v4) and SHALL pass that same Correlation_ID to every Logger call made within that execution.
2. WHEN a Single_Building_Process execution begins, THE Logger-caller SHALL generate a single Correlation_ID (UUID v4) and SHALL pass that same Correlation_ID to every Logger call made within that execution.
3. THE Logger SHALL write the Correlation_ID value to the `correlationId` field of every Log_Entry produced during the execution that generated it.
4. WHEN the execution ends (whether successfully or with an error), THE Correlation_ID SHALL cease to be used; a subsequent execution SHALL generate a new, independent Correlation_ID.
5. FOR ALL Log_Entries produced during a single Batch_Process or Single_Building_Process execution, the `correlationId` field SHALL contain the same UUID value — including entries for PDF_Generation, Notification delivery, retry attempts, and process completion.
6. IF a log entry is produced outside of any active process execution context (i.e., no Correlation_ID has been generated), THEN THE Logger SHALL write `correlationId` as `null` in that Log_Entry.
7. THE Correlation_ID SHALL be a valid UUID v4 string; THE Logger-caller SHALL use the same `uuid` package already present in the project to generate it.

---

## Filtering Log Entries by Correlation ID

Once the Correlation ID is implemented, every log line written during a specific settlement process execution will contain the same `correlationId` UUID. To isolate all entries for one run, use standard command-line tools or any JSON-aware log viewer:

**Using `grep` (any platform):**
```bash
grep '"correlationId":"<your-uuid>"' backend/logs/settlement-process.log
```

**Using `jq` for structured output:**
```bash
jq 'select(.correlationId == "<your-uuid>")' backend/logs/settlement-process.log
```

**Using PowerShell:**
```powershell
Get-Content backend\logs\settlement-process.log |
  Where-Object { $_ -match '"correlationId":"<your-uuid>"' }
```

Replace `<your-uuid>` with the actual UUID found in the first log entry of the run (e.g., from the `BATCH_PROCESS_STARTED` or `BUILDING_PROCESSING_STARTED` event). The result will contain every log event — PDF generation, notification attempts, retries, and completion — tagged to that single execution, regardless of how many other processes ran concurrently.
