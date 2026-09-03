# Requirements Document

## Introduction

Sprint 3 adds settlement-level scope control to the damage-reports-system. Currently, all authenticated users can view and act on every building record regardless of geography. This feature restricts MUNICIPALITY users so that they can only see and act on buildings belonging to their assigned settlement, while MINISTRY and APPRAISER users retain unrestricted access. The change touches three layers: the seed data (users and buildings gain a `settlementId` field), the server-side API (scope enforcement on every building route), and the frontend (the city filter is pre-locked for MUNICIPALITY users).

## Glossary

- **Settlement_Scope**: The set of buildings whose `settlementId` matches a given user's `settlementId`.
- **settlementId**: A string identifier for a settlement (e.g., `'jerusalem'`). Stored on both User records and Building records. Matching is case-sensitive string equality.
- **MUNICIPALITY**: A user role whose data access is restricted to the user's assigned settlement.
- **MINISTRY**: A user role with unrestricted access to all buildings.
- **APPRAISER**: A user role with unrestricted access to all buildings.
- **Auth_Server**: The service running on port 3006 that manages sessions and returns user identity including role and `settlementId`.
- **Buildings_Server**: The API service running on port 3001 that owns building records and enforces scope rules.
- **Session**: The in-memory token-to-user mapping maintained by Auth_Server.
- **City_Filter**: The dropdown UI control on the frontend that filters the buildings list by city name.
- **Audit_Log**: The append-only log of user actions recorded by the Buildings_Server.

---

## Requirements

### Requirement 1: User Entity — settlementId Field

**User Story:** As a system administrator, I want each user record to carry a `settlementId`, so that the system knows which settlement a MUNICIPALITY user belongs to.

#### Acceptance Criteria

1. THE Buildings_Server SHALL store a `settlementId` field on every User record in `usersStore.js`.
2. WHILE a user's role is `MUNICIPALITY`, THE Buildings_Server SHALL ensure the user's `settlementId` is a non-null, non-empty string.
3. WHILE a user's role is `MINISTRY` or `APPRAISER`, THE Buildings_Server SHALL store `null` as the user's `settlementId`.
4. THE Buildings_Server SHALL assign `settlementId: 'jerusalem'` to seed users `yoav`, `michal`, and `authority1`.

---

### Requirement 2: Building Entity — settlementId Field

**User Story:** As a system administrator, I want each building record to carry a `settlementId`, so that scope filtering can be applied during API queries.

#### Acceptance Criteria

1. THE Buildings_Server SHALL store a `settlementId` field on every Building record in `reportsStore.js`.
2. THE Buildings_Server SHALL assign `settlementId: 'jerusalem'` to all existing building records whose `address` ends with `, ירושלים`.
3. THE Buildings_Server SHALL assign `settlementId: 'other'` to the three English-address seed buildings (John Smith, Jane Doe, Bob Johnson).
4. WHEN a new building is created via `POST /reports`, THE Buildings_Server SHALL require a `settlementId` field in the request body and SHALL reject requests missing this field with HTTP 400.
5. WHEN a new building is created via `POST /reports` with a valid `settlementId`, THE Buildings_Server SHALL persist the provided `settlementId` on the new building record.

---

### Requirement 3: Auth Server — Session Includes settlementId

**User Story:** As a frontend application, I want the auth endpoints to return `settlementId` alongside the user's role, so that the client can enforce scope-based UI behavior without additional API calls.

#### Acceptance Criteria

1. WHEN a user successfully authenticates via `POST /auth/login`, THE Auth_Server SHALL include `settlementId` in the response `data` object alongside `token`, `userId`, `fullName`, `username`, and `role`.
2. WHEN a valid token is presented to `GET /auth/me`, THE Auth_Server SHALL return `settlementId` in the session `data` object.
3. THE Auth_Server SHALL persist `settlementId` in the Session at login time, reading it from the User record.
4. IF a user's role is `MINISTRY` or `APPRAISER`, THEN THE Auth_Server SHALL return `settlementId: null` in both `POST /auth/login` and `GET /auth/me` responses.

---

### Requirement 4: Scope Enforcement — List Buildings

**User Story:** As a MUNICIPALITY user, I want the buildings list to contain only buildings in my settlement, so that I never see or process buildings outside my jurisdiction.

#### Acceptance Criteria

1. WHEN `GET /reports` is called by a MUNICIPALITY user, THE Buildings_Server SHALL return only buildings where `building.settlementId === user.settlementId`.
2. WHEN `GET /reports` is called by a MINISTRY or APPRAISER user, THE Buildings_Server SHALL return all buildings without settlement filtering.
3. WHEN `GET /reports` is called by an unauthenticated request (no valid token), THE Buildings_Server SHALL return HTTP 401.

---

### Requirement 5: Scope Enforcement — Single Building Read

**User Story:** As a MUNICIPALITY user, I want the system to block my access to buildings outside my settlement when fetching a specific record, so that scope is enforced consistently on direct lookups.

#### Acceptance Criteria

1. WHEN `GET /reports/:id` is called by a MUNICIPALITY user and `building.settlementId === user.settlementId`, THE Buildings_Server SHALL return the building record with HTTP 200.
2. WHEN `GET /reports/:id` is called by a MUNICIPALITY user and `building.settlementId !== user.settlementId`, THE Buildings_Server SHALL return HTTP 403.
3. WHEN `GET /reports/:id` is called by a MINISTRY or APPRAISER user, THE Buildings_Server SHALL return the building record regardless of `settlementId`.

---

### Requirement 6: Scope Enforcement — Mutating Actions

**User Story:** As a MUNICIPALITY user, I want all write operations on buildings to be blocked for buildings outside my settlement, so that I cannot accidentally modify data I do not own.

#### Acceptance Criteria

1. WHEN `PATCH /reports/:id/status` is called by a MUNICIPALITY user and `building.settlementId !== user.settlementId`, THE Buildings_Server SHALL return HTTP 403.
2. WHEN `POST /reports/:id/budget-request` is called by a MUNICIPALITY user and `building.settlementId !== user.settlementId`, THE Buildings_Server SHALL return HTTP 403.
3. WHEN `POST /reports/:id/assessment` is called by a MUNICIPALITY user and `building.settlementId !== user.settlementId`, THE Buildings_Server SHALL return HTTP 403.
4. WHEN `POST /reports/:id/authority-approval` is called by a MUNICIPALITY user and `building.settlementId !== user.settlementId`, THE Buildings_Server SHALL return HTTP 403.
5. WHEN any of the above mutating routes is called by a MUNICIPALITY user and `building.settlementId === user.settlementId`, THE Buildings_Server SHALL process the request normally.
6. WHEN any of the above mutating routes is called by a MINISTRY or APPRAISER user, THE Buildings_Server SHALL process the request without settlement scope checks.

---

### Requirement 7: Scope Enforcement — Audit Log Integrity

**User Story:** As an auditor, I want scope-blocked requests to leave no audit trail, so that the audit log reflects only genuinely authorized actions.

#### Acceptance Criteria

1. WHEN a request is rejected with HTTP 403 due to settlement scope mismatch, THE Buildings_Server SHALL NOT append any entry to the Audit_Log.
2. WHEN a mutating action is authorized and succeeds within the user's settlement scope, THE Buildings_Server SHALL append an audit log entry as defined by the existing audit logging behavior.

---

### Requirement 8: Auth Resolution in Buildings_Server

**User Story:** As a developer, I want the Buildings_Server to resolve role and settlementId from the Auth_Server on every protected request, so that scope enforcement is always based on current session data.

#### Acceptance Criteria

1. WHEN a protected route receives a request, THE Buildings_Server SHALL extract the `x-auth-token` header and call `GET /auth/me` on the Auth_Server to resolve `role` and `settlementId`.
2. IF the Auth_Server returns a non-200 response or the token is absent, THEN THE Buildings_Server SHALL return HTTP 401 to the caller.
3. THE Buildings_Server SHALL apply scope enforcement using the `settlementId` returned by the Auth_Server, without reading user data directly from `usersStore.js` in route handlers.

---

### Requirement 9: Frontend — currentUser Stores settlementId

**User Story:** As a frontend developer, I want `currentUser` to include `settlementId` after login, so that the UI can apply scope-based restrictions without additional network calls.

#### Acceptance Criteria

1. WHEN the frontend completes a successful login, THE Frontend SHALL store `settlementId` in the `currentUser` object alongside `token`, `userId`, `fullName`, `username`, and `role`.
2. WHEN the frontend restores a session via `GET /auth/me`, THE Frontend SHALL update `currentUser.settlementId` from the response data.

---

### Requirement 10: Frontend — City Filter Locked for MUNICIPALITY Users

**User Story:** As a MUNICIPALITY user, I want the city filter to be pre-set to my settlement's city and non-interactive, so that I cannot accidentally browse buildings from other settlements.

#### Acceptance Criteria

1. WHILE the authenticated user's role is `MUNICIPALITY`, THE Frontend SHALL pre-set the City_Filter to the city name corresponding to `currentUser.settlementId` and SHALL render the City_Filter as non-interactive (disabled or read-only).
2. WHILE the authenticated user's role is `MINISTRY` or `APPRAISER`, THE Frontend SHALL render the City_Filter as a freely selectable control with no pre-set value enforced by the settlement scope.
3. THE Frontend SHALL derive the city name for the City_Filter from the existing mechanism that extracts city names from building address strings (the suffix after the last comma).
