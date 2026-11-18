# HOPE, Inc. ERP - Sprint 1 Test Plan & Acceptance Criteria

**Task ID:** S1-TST-01  
**Role:** Tester (`stfnviernes-afk`)  
**Scope:** Sprint 1 Authentication, User Management, 36-Action Rights System, and Permission-Aware Main Page[cite: 2, 8, 19].

---

## 1. Test Strategy & Scope
This test plan defines the mandatory verification gates and executable acceptance cases for Sprint 1 of the HOPE ERP project. Testing must validate that backend Supabase security boundaries, role permissions, audit logging, and frontend screens behave correctly under both valid inputs and negative/security test scenarios.

* **In Scope:** 
  * Public registration (pending state)[cite: 6, 12]
  * Session handling, login/logout, and first-password setup[cite: 7, 13]
  * Password recovery (request, token verification, expiration/reuse protection)[cite: 7, 13]
  * User Management (Superadmin/Admin roles, approval, block/unblock, last-Superadmin protection)[cite: 8, 13]
  * Rights System (5 modules, 36 action rights, checkboxes, All/None, audit log attribution)[cite: 8, 13, 14]
  * Permission-aware Main Page & navigation entry points[cite: 8, 14]
* **Out of Scope for Sprint 1:** Later module CRUD operations (Customer, Product, HR, Sales, Reports business logic screens are out of scope and will be implemented in subsequent sprints)[cite: 2, 8, 19].

---

## 2. Test Fixtures & Role Matrix
To execute these tests, prepare the following isolated test fixtures in the database:
1. **Unregistered Visitor:** No profile or session.
2. **Pending User:** Registered via public form; state is `pending`, cannot access protected areas[cite: 6, 12].
3. **Blocked User:** An active user whose account has been toggled to `blocked = true`[cite: 13].
4. **Ordinary User:** Approved user with customized or zero module rights assigned[cite: 13].
5. **Admin:** Can view and manage ordinary `User` accounts only; cannot see or modify Superadmins or other Admins[cite: 8, 13].
6. **Superadmin:** Can approve pending registrations, designate Admins, assign rights, and manage all accounts (protected by the last-Superadmin safeguard)[cite: 8, 13].

---

## 3. Detailed Test Cases

### Category A: Authentication & Account Lifecycle (`TST-02`)
| Case ID | Action / Input | Expected Result |
| :--- | :--- | :--- |
| **TC-AUTH-01** | Submit valid registration form (First Name, Last Name, Email)[cite: 10, 11]. | Account created successfully; linked profile persisted in database with `pending` status; user cannot access protected routes[cite: 6, 12]. |
| **TC-AUTH-02** | Submit registration with missing fields or duplicate email. | Form displays appropriate validation error; no duplicate or orphan profile is created[cite: 12]. |
| **TC-AUTH-03** | Attempt to manipulate browser request/payload to self-assign `Superadmin` or `Admin` role during registration. | Server/database security policy rejects the privilege escalation; account defaults strictly to ordinary `pending` user[cite: 6, 12]. |
| **TC-AUTH-04** | Sign in with valid credentials as an approved active user. | Session established successfully; user redirected to the main dashboard[cite: 7, 12, 13]. |
| **TC-AUTH-05** | Sign in with incorrect password or as a `pending` / `blocked` user[cite: 13]. | Login rejected with clear error message; access to protected routes strictly denied[cite: 7, 13]. |
| **TC-AUTH-06** | Perform first-time password setup via one-time secure link[cite: 7, 13]. | Password successfully stored (hashed); user gains valid active session[cite: 7, 13]. |
| **TC-AUTH-07** | Request password reset, follow email token link, and set a new password[cite: 7, 13]. | Password updated successfully; old password no longer works[cite: 8]. |
| **TC-AUTH-08** | Attempt to reuse, or use an expired/malformed password reset token[cite: 8]. | Request rejected; password remains unchanged[cite: 8]. |
| **TC-AUTH-09** | Click Logout while signed in. | Session destroyed; subsequent attempts to access protected pages redirect back to login[cite: 8]. |

### Category B: User Management (`TST-03`)
| Case ID | Action / Input | Expected Result |
| :--- | :--- | :--- |
| **TC-UM-01** | Log in as **Admin** and view User Management screen[cite: 13]. | User list displays ordinary users. Superadmin accounts are hidden; other Admin rows have no management controls[cite: 8, 13]. |
| **TC-UM-02** | Log in as **Superadmin**, locate a `pending` user, and click **Approve**[cite: 13]. | User state updates to active/approved; persistence verified after page refresh[cite: 8, 13]. |
| **TC-UM-03** | Click **Block** on an active user account[cite: 13]. | User state updates to blocked; active sessions are invalidated and prevented from accessing protected pages[cite: 8, 13]. |
| **TC-UM-04** | Attempt to delete, demote, or block the **last remaining active Superadmin**[cite: 8, 13]. | Action rejected by system guardrails; error message displayed, leaving the Superadmin active[cite: 8, 13]. |
| **TC-UM-05** | Attempt direct API/URL manipulation as an ordinary User to access User Management endpoints. | Server-side permission check denies access (HTTP 403 or redirect). |

### Category C: Rights System & Audit Attribution (`TST-04`, `DBA-06`)
| Case ID | Action / Input | Expected Result |
| :--- | :--- | :--- |
| **TC-RIGHTS-01** | Open Rights dialog for a target user, click **All**, then click **Save**[cite: 13, 14]. | All 36 rights across all 5 modules are successfully checked and persisted to the database[cite: 8, 13, 14]. |
| **TC-RIGHTS-02** | Toggle specific module checkboxes or click **None**, then click **Cancel**[cite: 13, 14]. | Dialog closes without saving changes; previous permission state remains intact[cite: 8, 14]. |
| **TC-RIGHTS-03** | Perform a rights modification as an authorized Admin/Superadmin[cite: 28]. | An entry is successfully logged in `audit_log` capturing the correct authenticated actor ID, timestamp, and old/new permission values[cite: 8, 14, 28]. |
| **TC-RIGHTS-04** | Log in as a User with zero module rights assigned. | Main page renders an honest empty state ("No modules assigned; contact an administrator")[cite: 14]. |

### Category D: Main Page & Smoke Testing (`TST-05`)
| Case ID | Action / Input | Expected Result |
| :--- | :--- | :--- |
| **TC-MAIN-01** | Log in with specific module rights (e.g., Customer only)[cite: 14]. | Sidebar and module tiles display only authorized entry points; unauthorized tiles are hidden or locked[cite: 8, 14]. |
| **TC-MAIN-02** | Attempt direct URL navigation to a restricted module route without holding its permission[cite: 8, 14]. | Access denied; server-side boundary blocks entry. |
| **TC-SMOKE-01** | Run automated smoke test script covering login sequence and main page load[cite: 30]. | Script executes successfully, verifying positive authorized flow and signed-out denial[cite: 30]. |

---

## 4. Verification & Sign-off Checklist
* [ ] All test cases executed against the staging/integration environment[cite: 19].
* [ ] Bug reports filed under `TST-06` for any failing checks and verified upon fix[cite: 20].
* [ ] Audit logging verified to record real actor identities[cite: 27].
* [ ] Review and approval obtained from a teammate prior to merging PR[cite: 1, 15].
