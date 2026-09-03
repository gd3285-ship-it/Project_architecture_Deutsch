# Requirements Document

## Introduction

Sprint 2 adds Role-Based Access Control (RBAC) to the Damage Reports System. The system currently supports authenticated users (login/logout via `auth-server.js`) but treats all users identically once authenticated. This feature introduces three distinct roles — `MINISTRY`, `MUNICIPALITY`, and `APPRAISER` — and enforces different action permissions for each role both on the server (authoritative) and in the UI (for usability).

Every protected business action must be validated server-side before execution. The UI additionally hides or disables elements that the current user's role cannot use, but the server never trusts the UI alone. Audit log entries are only created when an action is executed successfully by an authorized user.

## Glossary

- **RBAC_System**: The role-based access control subsystem introduced in this sprint, spanning the Auth_Server, API_Gateway, Assessments_Server, Municipal_Server, and Frontend.
- **Auth_Server**: The Node.js service running on port 3006, responsible for login, logout, and session management (`backend/auth-server.js`).
- **API_Gateway**: The main Node.js server running on port 3001 (`backend/server.js`), which handles building reports, proxies to domain servers, and writes audit logs.
- **Assessments_Server**: The domain server on port 3004 (`backend/domains/assessments/server.js`) that manages appraisal data.
- **Municipal_Server**: The domain server on port 3005 (`backend/domains/municipal/server.js`) that manages local authority approval data.
- **Frontend**: The vanilla JS single-page application served from `frontend/index.html`.
- **Session**: An in-memory record in the Auth_Server mapping a token to a user's `userId`, `fullName`, `username`, and `role`.
- **CurrentUser**: The client-side object stored in the Frontend after login, containing `token`, `userId`, `fullName`, `username`, and `role`.
- **Role**: One of three string values assigned to every user: `MINISTRY`, `MUNICIPALITY`, or `APPRAISER`.
- **Protected_Endpoint**: Any API endpoint that requires an authorized role before executing its business logic.
- **Audit_Log**: An immutable record appended by `appendAuditLog` in `auditStore.js` on successful, authorized actions.
- **Appraisers_Portal**: The frontend tab labeled "פורטל שמאים" that provides access to appraisal update functionality.
- **Local_Authorities_Portal**: The frontend tab labeled "פורטל רשויות מקומיות" that provides access to authority approval functionality.

---

## Requirements

### Requirement 1: Role Field on User Entity

**User Story:** As a system administrator, I want every user to have an assigned role, so that the system can make authorization decisions based on who is performing each action.

#### Acceptance Criteria

1. THE RBAC_System SHALL store a `role` field on every user record, where the value is exactly one of the three strings: `MINISTRY`, `MUNICIPALITY`, or `APPRAISER`.
2. THE RBAC_System SHALL assign the following roles to the existing seed users: `admin` → `MINISTRY`; `dana` → `MINISTRY`; `yoav` → `MUNICIPALITY`; `michal` → `MUNICIPALITY`; `appraiser1` → `APPRAISER`; `authority1` → `MUNICIPALITY`.
3. WHEN the Auth_Server creates a new session upon successful login, THE Auth_Server SHALL include the user's `role` in the session record alongside `userId`, `fullName`, and `username`.
4. WHEN the Auth_Server responds to a successful `POST /auth/login` request, THE Auth_Server SHALL include the `role` field in the response `data` object alongside `token`, `userId`, `fullName`, and `username`.
5. WHEN the Auth_Server responds to a successful `GET /auth/me` request, THE Auth_Server SHALL include `role`, `userId`, `fullName`, and `username` in the response `data` object.
6. IF a user record contains a `role` value that is not one of `MINISTRY`, `MUNICIPALITY`, or `APPRAISER`, THEN THE Auth_Server SHALL reject the login with HTTP 500 and SHALL NOT create a session.

---

### Requirement 2: Frontend Role Storage and UI Enforcement

**User Story:** As a user, I want the interface to show only the actions and portals relevant to my role, so that I am not confused by controls I cannot use.

#### Acceptance Criteria

1. WHEN the Frontend receives a successful login response or a successful `GET /auth/me` response during session restore, THE Frontend SHALL store the `role` field in the `CurrentUser` object.
2. WHILE a user with role `MUNICIPALITY` is logged in, THE Frontend SHALL set the Appraisers_Portal tab's CSS `display` property to `none`.
3. WHILE a user with role `MUNICIPALITY` is logged in, THE Frontend SHALL render appraisal update controls with the `disabled` attribute set.
4. WHILE a user with role `MUNICIPALITY` is logged in, THE Frontend SHALL render the budget request submit button with the `disabled` attribute set.
5. WHILE a user with role `APPRAISER` is logged in, THE Frontend SHALL set the Local_Authorities_Portal tab's CSS `display` property to `none`.
6. WHILE a user with role `APPRAISER` is logged in, THE Frontend SHALL render authority approval form controls with the `disabled` attribute set.
7. WHILE a user with role `APPRAISER` is logged in, THE Frontend SHALL render the budget request submit button with the `disabled` attribute set.
8. WHILE a user with role `MINISTRY` is logged in, THE Frontend SHALL display all six navigation tabs (כל הדיווחים, דיווח חדש, פרטי דיווח, מרכז הודעות, פורטל שמאים, פורטל רשויות מקומיות) and SHALL NOT set the `disabled` attribute on any action control.
9. WHEN a user logs out, THE Frontend SHALL clear the `role` field from `CurrentUser` and remove any stored token before showing the login screen.

---

### Requirement 3: Server-Side Authorization Middleware

**User Story:** As a system architect, I want every protected server endpoint to verify the caller's role before executing any business logic, so that UI bypass or direct API calls cannot circumvent access rules.

#### Acceptance Criteria

1. WHEN a request arrives at a Protected_Endpoint, THE API_Gateway SHALL read the `x-auth-token` header, call `GET /auth/me` on the Auth_Server with that token within 2000 ms, and resolve the caller's role before executing any business logic.
2. IF a request arrives at a Protected_Endpoint without an `x-auth-token` header, THEN THE API_Gateway SHALL return HTTP 401 with `{ success: false, error: "..." }` and SHALL NOT execute any business logic or modify any data.
3. IF a request arrives at a Protected_Endpoint with an `x-auth-token` that does not correspond to an active session, THEN THE API_Gateway SHALL return HTTP 401 with `{ success: false, error: "..." }` and SHALL NOT execute any business logic or modify any data.
4. IF a request arrives at a Protected_Endpoint and the resolved role is not permitted for that endpoint's action, THEN THE API_Gateway SHALL return HTTP 403 with `{ success: false, error: "..." }` and SHALL NOT execute any business logic or modify any data.
5. IF the Auth_Server is unreachable or returns an error when the API_Gateway attempts to resolve the caller's role, THEN THE API_Gateway SHALL return HTTP 503 with `{ success: false, error: "..." }` and SHALL NOT execute any business logic.

---

### Requirement 4: Authorization Rules for Appraisal Updates

**User Story:** As a ministry official, I want only authorized roles to be able to update appraisal data, so that assessment records remain reliable and tamper-proof.

#### Acceptance Criteria

1. WHEN a `POST /reports/:id/assessment` request is received by the API_Gateway, THE API_Gateway SHALL verify the caller's role before proxying the request to the Assessments_Server.
2. IF the caller's role is `MINISTRY` or `APPRAISER`, THEN THE API_Gateway SHALL proxy the appraisal update request to the Assessments_Server and return the downstream HTTP status code and response body verbatim.
3. IF the caller's role is `MUNICIPALITY`, THEN THE API_Gateway SHALL return HTTP 403 with `{ success: false, error: "אין הרשאה לעדכן הערכת שמאי" }` and SHALL NOT forward the request to the Assessments_Server.
4. IF the Assessments_Server is unreachable after a successful authorization check, THEN THE API_Gateway SHALL return HTTP 503 with `{ success: false, error: "..." }`.

---

### Requirement 5: Authorization Rules for Local Authority Approvals

**User Story:** As a ministry official, I want only authorized roles to be able to submit or update local authority approvals, so that approval records are not modified by unauthorized parties.

#### Acceptance Criteria

1. WHEN a `POST /reports/:id/authority-approval` request is received by the API_Gateway, THE API_Gateway SHALL verify the caller's role before proxying the request to the Municipal_Server.
2. IF the caller's role is `MINISTRY` or `MUNICIPALITY`, THEN THE API_Gateway SHALL proxy the authority approval request to the Municipal_Server and return the downstream HTTP status code and response body verbatim.
3. IF the caller's role is `APPRAISER`, THEN THE API_Gateway SHALL return HTTP 403 with `{ success: false, error: "אין הרשאה לעדכן אישור רשות מקומית" }` and SHALL NOT forward the request to the Municipal_Server.
4. IF the Municipal_Server is unreachable after a successful authorization check, THEN THE API_Gateway SHALL return HTTP 503 with `{ success: false, error: "..." }`.

---

### Requirement 6: Authorization Rules for Budget Requests

**User Story:** As a ministry official, I want only ministry users to be able to submit budget requests, so that financial actions are strictly controlled.

#### Acceptance Criteria

1. WHEN a `POST /reports/:id/budget-request` request is received by the API_Gateway, THE API_Gateway SHALL verify the caller's role before executing the budget request logic.
2. IF the caller's role is `MINISTRY`, THEN THE API_Gateway SHALL execute the budget request logic and return the result.
3. IF the caller's role is `MUNICIPALITY` or `APPRAISER`, THEN THE API_Gateway SHALL return HTTP 403 with `{ success: false, error: "אין הרשאה להגיש בקשת תקציב" }` and SHALL NOT modify the report's `hasBudgetRequest` field.

---

### Requirement 7: Authorization Rules for Building Status Updates

**User Story:** As a system architect, I want building status updates to be restricted to authorized roles, so that only users with the right permissions can change a building's workflow state.

#### Acceptance Criteria

1. WHEN a `PATCH /reports/:id/status` request is received by the API_Gateway, THE API_Gateway SHALL verify the caller's role before executing the status update.
2. IF the caller's role is `MINISTRY` or `MUNICIPALITY`, THEN THE API_Gateway SHALL execute the status update and return the result.
3. IF the caller's role is `APPRAISER`, THEN THE API_Gateway SHALL return HTTP 403 with `{ success: false, error: "אין הרשאה לעדכן סטטוס מבנה" }` and SHALL NOT modify the building's status field.
4. IF the resolved role is not one of the three defined roles, THEN THE API_Gateway SHALL return HTTP 403 and SHALL NOT execute the status update.

---

### Requirement 8: Audit Log Isolation for Unauthorized Actions

**User Story:** As an auditor, I want the audit log to contain only records of successful, authorized actions, so that the log is a reliable record of legitimate system activity.

#### Acceptance Criteria

1. WHEN a Protected_Endpoint successfully executes a business action for an authorized caller and receives a success response from any downstream service, THE API_Gateway SHALL append an Audit_Log entry via `appendAuditLog`.
2. IF a Protected_Endpoint rejects a request due to a missing token, invalid token, or insufficient role, THEN THE API_Gateway SHALL NOT call `appendAuditLog` for that request.
3. IF a Protected_Endpoint returns HTTP 503 because the Auth_Server or a downstream domain server is unreachable, THEN THE API_Gateway SHALL NOT call `appendAuditLog` for that request.

---

### Requirement 9: Authorization Error Response Format

**User Story:** As a frontend developer, I want unauthorized responses to follow a consistent format, so that the Frontend can display a clear and uniform error message to the user.

#### Acceptance Criteria

1. WHEN the API_Gateway returns HTTP 401, THE API_Gateway SHALL include `{ "success": false, "error": "<non-empty string>" }` in the response body.
2. WHEN the API_Gateway returns HTTP 403, THE API_Gateway SHALL include `{ "success": false, "error": "<non-empty string>" }` in the response body.
3. WHEN the Frontend receives an HTTP 403 response from any API call, THE Frontend SHALL display the `error` field from the response body in the existing message area and SHALL NOT navigate away from the current view.
4. WHEN the Frontend receives an HTTP 401 response from any API call AND a valid token is currently stored in `sessionStorage`, THE Frontend SHALL clear `sessionStorage`, set `currentUser` to `null`, and show the login overlay — provided the login overlay is not already visible.
