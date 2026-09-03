# Requirements Document

## Introduction

This feature adds a "System Health" administrative screen to the existing Damage Reports System. The screen gives administrators a real-time, high-level overview of system activity by aggregating and displaying metrics from existing data sources — settlement processes and notifications. No existing business logic, routes, or data structures are modified.

The implementation follows the current architecture: a new aggregation endpoint is added to the Buildings Domain Server (port 3001), which fetches data from the Return Home Package Service (port 3002) and the Notification Server (port 3003). A new tab is added to the existing frontend SPA (`frontend/index.html`).

## Glossary

- **Dashboard**: The "System Health" screen (tab) added to the frontend SPA.
- **Dashboard_Tab**: The new nav-tab button with `data-tab="system-health"` added to the `.nav-tabs` bar in `frontend/index.html`.
- **Dashboard_Section**: The `.section` div identified by `id="system-health"` that contains the metric cards.
- **Metrics_API**: The new `GET /system-health` endpoint added to the Buildings Domain Server (port 3001).
- **Metrics_Aggregator**: The server-side logic inside `Metrics_API` that fetches and aggregates data from downstream services.
- **Settlement_Service**: The Return Home Package Service running on port 3002, exposing `GET /settlement-processes`.
- **Notification_Service**: The Notification Server running on port 3003, exposing `GET /notifications`.
- **SettlementProcess**: A record in the in-memory store with fields `{ id, settlementName, startedBy, startedAt, completedAt, status }`. Status is either `PROCESSING` or `COMPLETED`.
- **NotificationRecord**: A row in `notifications.csv` with fields `{ messageId, buildingId, email, subject, dateTime, status }`. Status is either `SENT` or `FAILED`.
- **Average_Settlement_Duration**: The arithmetic mean of `(completedAt − startedAt)` in seconds, calculated only over `SettlementProcess` records whose `status` is `COMPLETED` and whose `completedAt` is not null.
- **Retry_Count**: The total number of `NotificationRecord` entries whose `status` is `FAILED`. Each failed attempt is stored as a separate row, so this count equals the total number of failure rows.
- **Administrator**: A user with access to the system's admin interface who uses the Dashboard to monitor system health.

---

## Requirements

### Requirement 1: System Health Tab Navigation

**User Story:** As an Administrator, I want a dedicated "System Health" tab in the navigation bar, so that I can navigate directly to the health overview screen.

#### Acceptance Criteria

1. THE Dashboard_Tab SHALL be present in the `.nav-tabs` navigation bar of `frontend/index.html`.
2. WHEN the Administrator clicks the Dashboard_Tab, THE Dashboard_Section SHALL become visible and all other `.section` elements SHALL be hidden.
3. WHEN the Administrator clicks any other tab while the Dashboard_Section is active, THE Dashboard_Section SHALL be hidden and the selected tab's section SHALL become visible.
4. THE Dashboard_Tab SHALL follow the same activation pattern (`active` CSS class toggle) as all existing tabs in the SPA.

---

### Requirement 2: Metrics API Endpoint

**User Story:** As an Administrator, I want the system to provide a single endpoint that returns all aggregated health metrics, so that the frontend can display them without making multiple cross-origin requests.

#### Acceptance Criteria

1. THE Metrics_API SHALL expose a `GET /system-health` route on the Buildings Domain Server (port 3001).
2. WHEN a `GET /system-health` request is received, THE Metrics_Aggregator SHALL fetch settlement process data from `GET http://localhost:3002/settlement-processes`.
3. WHEN a `GET /system-health` request is received, THE Metrics_Aggregator SHALL fetch notification data from `GET http://localhost:3003/notifications`.
4. WHEN both upstream responses are received successfully, THE Metrics_API SHALL return an HTTP 200 response with a JSON body conforming to the structure defined in Requirement 3.
5. IF the Settlement_Service is unreachable, THEN THE Metrics_API SHALL return an HTTP 503 response with a JSON body `{ "success": false, "error": "Settlement service unavailable" }`.
6. IF the Notification_Service is unreachable, THEN THE Metrics_API SHALL return an HTTP 503 response with a JSON body `{ "success": false, "error": "Notification service unavailable" }`.
7. THE Metrics_API SHALL NOT modify any data in the Settlement_Service or the Notification_Service.

---

### Requirement 3: Aggregated Metrics Calculation

**User Story:** As an Administrator, I want the metrics endpoint to calculate and return accurate counts and performance figures, so that the dashboard reflects the true current state of the system.

#### Acceptance Criteria

1. THE Metrics_Aggregator SHALL calculate `settlementProcesses.completed` as the count of all SettlementProcess records whose `status` is `COMPLETED`.
2. THE Metrics_Aggregator SHALL calculate `settlementProcesses.processing` as the count of all SettlementProcess records whose `status` is `PROCESSING`.
3. THE Metrics_Aggregator SHALL calculate `notifications.successful` as the count of all NotificationRecord entries whose `status` is `SENT`.
4. THE Metrics_Aggregator SHALL calculate `notifications.failed` as the count of all NotificationRecord entries whose `status` is `FAILED`.
5. THE Metrics_Aggregator SHALL calculate `notifications.retryCount` as the count of all NotificationRecord entries whose `status` is `FAILED` (identical to `notifications.failed`, since each failed attempt is a separate CSV row).
6. WHEN at least one SettlementProcess record exists with `status` equal to `COMPLETED` and a non-null `completedAt`, THE Metrics_Aggregator SHALL calculate `performance.averageSettlementDurationSeconds` as the arithmetic mean of `(completedAt − startedAt)` in whole seconds across all such records.
7. WHEN no SettlementProcess record exists with `status` equal to `COMPLETED` and a non-null `completedAt`, THE Metrics_Aggregator SHALL set `performance.averageSettlementDurationSeconds` to `null`.
8. THE Metrics_API SHALL return the aggregated metrics in the following JSON structure:
   ```json
   {
     "success": true,
     "data": {
       "settlementProcesses": {
         "completed": 2,
         "processing": 1
       },
       "notifications": {
         "successful": 18,
         "failed": 4,
         "retryCount": 4
       },
       "performance": {
         "averageSettlementDurationSeconds": 273
       }
     }
   }
   ```

---

### Requirement 4: Dashboard Metric Display

**User Story:** As an Administrator, I want the System Health screen to display all metrics in a clear, readable layout, so that I can assess system health at a glance.

#### Acceptance Criteria

1. THE Dashboard_Section SHALL display a "Settlement Processes" group showing the `completed` and `processing` counts fetched from the Metrics_API.
2. THE Dashboard_Section SHALL display a "Notifications" group showing the `successful`, `failed`, and `retryCount` values fetched from the Metrics_API.
3. THE Dashboard_Section SHALL display a "Performance" group showing the `averageSettlementDurationSeconds` value fetched from the Metrics_API.
4. WHEN `performance.averageSettlementDurationSeconds` is `null`, THE Dashboard_Section SHALL display a "N/A" placeholder for that metric.
5. THE Dashboard_Section SHALL display metric labels in Hebrew, consistent with the existing SPA language and RTL direction.
6. THE Dashboard_Section SHALL apply RTL layout and use the same font family (`Heebo`/`Assistant`) and CSS variables (`--primary-color`, `--bg-white`, `--border-gray`, etc.) as the rest of the SPA.
7. THE Dashboard_Section SHALL NOT include charts, graphs, or external visualisation libraries.

---

### Requirement 5: Data Freshness

**User Story:** As an Administrator, I want the metrics to reflect the current state of the system each time I view the dashboard, so that stale data does not mislead my decisions.

#### Acceptance Criteria

1. WHEN the Dashboard_Tab is activated, THE Dashboard_Section SHALL trigger a fresh call to the Metrics_API and update all displayed metric values with the response.
2. WHEN the Metrics_API call is in progress, THE Dashboard_Section SHALL display a loading indicator to inform the Administrator that data is being fetched.
3. WHEN the Metrics_API returns an error response, THE Dashboard_Section SHALL display a user-facing error message in Hebrew and SHALL NOT show stale metric values from a prior successful load.
4. THE Dashboard_Section SHALL NOT poll the Metrics_API automatically in the background; data SHALL only be fetched on explicit tab activation.

---

### Requirement 6: No Impact on Existing Business Processes

**User Story:** As a system owner, I want the new dashboard to be entirely read-only, so that adding it cannot affect existing workflows or data.

#### Acceptance Criteria

1. THE Metrics_Aggregator SHALL only issue `GET` requests to the Settlement_Service and the Notification_Service; it SHALL NOT issue `POST`, `PATCH`, `PUT`, or `DELETE` requests to either service.
2. THE Metrics_API SHALL NOT modify, add, or remove any records in the `settlementProcessStore`, `reportsStore`, `auditStore`, or `notifications.csv`.
3. THE Dashboard_Tab and Dashboard_Section SHALL NOT alter the behavior or appearance of any existing tab or section in the SPA.
4. THE new `GET /system-health` route SHALL NOT conflict with or shadow any existing route in the Buildings Domain Server.
