# S1-UIX-03: Main Page, User List, and Rights Dialog Wireframes

**Issue:** [#14 — S1-UIX-03](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/14)
**Fidelity:** Low-to-mid; establishes layout, hierarchy, navigation, controls, and states rather than final visual styling.

## Deliverables

Open [the standalone wireframe](../../UI/UX/wireframes/s1-uix-03.html) in a browser. Its CSS and JavaScript are colocated in the same folder.

| View | Layout and controls |
|---|---|
| Main Page | Global navigation, signed-in user and role context, workspace summary cards, five module shortcuts, system status, pending approvals, and a no-modules state. |
| User Management List | Page title and Add User action; All/Pending/Active/Blocked tabs; name/email search; role filter; sort; user table; rights action; page size and pagination. Preview controls expose loading and empty states. |
| Rights Dialog | Selected-user context; grouped module/action checkboxes; per-module select all; global Select all, Clear all, and Reset; role/status guardrails; Cancel and Save Rights actions. |

The permission groups show 36 illustrative action labels across Customers, Products, Human Resources, Sales, and Reports (7/7/7/7/8). Confirm their final wording and grouping against the approved rights catalogue before implementation.

## User flow

1. A signed-in Superadmin or Admin lands on the Main Page and sees their role, workspace status, summary cards, and available modules.
2. The user selects **User management** in the top navigation or **Manage users** in the utility region.
3. On the list, the manager searches, filters by status/role, sorts, and pages through accounts. Selecting **Manage rights** for an active standard User opens that user’s Rights Dialog.
4. The manager adjusts module/action rights. **Reset** returns the draft to its saved preview state; **Cancel** closes without saving; **Save rights** updates only the in-memory prototype state.

## Key states and edge cases represented

- Admin role preview excludes Admin and Superadmin accounts; elevated accounts have protected actions.
- Pending and blocked accounts cannot open or save rights. The prototype presents rights controls only for active standard Users.
- A user with zero assigned module rights gets an explicit no-modules message on the Main Page; zero rights remain a valid state.
- Search/filter combinations with no matches show a clearable empty state. A loading preview, tab counts, page-size selection, and pagination are included.
- Rights groups support partial module selection, module-level select-all, global Select all/Clear all, reset, and cancel-without-save.
- The last-active-Superadmin safeguard is called out as a guardrail; actual account lifecycle enforcement belongs to the authorized application/server behavior.
- All interactions and sample users are local presentation-only. This prototype does not authenticate, authorize, persist rights, or write audit records.

## Verification and evidence notes

- [x] Deliverable files are linked above and provide all three requested views.
- [x] Interaction preview covers navigation, filtering, search, sorting, pagination, list empty/loading states, no-module state, permission toggles, reset, cancel, and save feedback.
- [x] Browser-checked: Admin preview contains only standard User rows; no-match search and loading previews render; Cancel preserves the saved rights; Select all checks all 36 rights and Save shows prototype-only feedback.
- [x] `npm run typecheck`, `npm run lint` (one existing font warning), and `node --check UI/UX/wireframes/s1-uix-03.js` pass.
- [ ] Teammate review and approval on the linked, non-trivial PR.
- [ ] PR merged into `main` after approval.

### Suggested PR/issue evidence summary

> Added low-to-mid-fidelity Sprint 1 wireframes for the permission-aware Main Page, User Management list, and per-user Rights Dialog. The standalone preview includes role context, user search/status/role filters, sorting and pagination, empty/loading/no-module states, grouped rights controls, guardrails, and Cancel/Save preview behavior. See `UI/UX/wireframes/s1-uix-03.html` and `docs/ui-ux/s1-uix-03-wireframe-handoff.md`. All data is illustrative and no production permissions are enforced. Teammate approval and merge are pending.
