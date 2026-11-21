# S1-TST-03 User Management Test Cases

Related issue: #25

## Scope

Verify add, edit, approve, designate Admin, block/unblock, role visibility, and last-Superadmin guard behavior.

## Matrix

| ID | Case | Expected result |
|---|---|---|
| UM-01 | Standard User opens user management | HTTP 403 |
| UM-02 | Admin views user management | Standard Users are visible; Admin/Superadmin accounts are hidden |
| UM-03 | Admin adds a standard user | User is created with the standard User role and a temporary password |
| UM-04 | Admin submits an Admin role or protected field | Request is rejected by validation |
| UM-05 | Superadmin approves a pending user | Account becomes active |
| UM-06 | Superadmin designates an approved user as Admin | Role changes only through trusted server logic |
| UM-07 | Admin/Superadmin edits a standard user | Allowed fields persist and protected fields remain guarded |
| UM-08 | Block and unblock a standard user | Session access follows block state |
| UM-09 | Attempt to demote or block the last active Superadmin | Operation is rejected |
| UM-10 | Admin tries to open Superadmin user details | Target is hidden or denied |

## Executable verification

Run:

```powershell
npm.cmd run verify:users
npm.cmd run verify:approval
```

Both runners create isolated test accounts and remove their Auth users during cleanup.
