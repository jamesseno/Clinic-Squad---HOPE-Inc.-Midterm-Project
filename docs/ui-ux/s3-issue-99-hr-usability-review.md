# S3-UIX-05 — HR usability review handoff and evidence status

**Issue:** [#99](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/99)
**Review status:** Source-informed design review only. **Not a completed usability test, teammate review, or screenshot-based sign-off.**

## Evidence boundary

I inspected the checked-in pages at `/departments`, `/jobs`, and `/employees`, including the embedded employee profile/history. These routes contain working UI code, but this handoff does not claim the app was launched or interacted with in a browser. No review screenshots or Student Guide file were found in this checkout. Findings below are therefore source-level observations and design acceptance checks; status of runtime behavior remains **unverified**. No user research or teammate feedback is claimed.

## Observed implementation (not proposed design)

| Surface | Present in source | Design gap / verify in browser |
|---|---|---|
| Department / Job list | Search; permitted add/edit/delete/restore; optional Show deleted; Active/Deleted text; inline forms | Explicit Active/Inactive/All filter requested by #76 is absent. Native table/form hierarchy and status coloring/opacity need responsive and contrast checks. |
| Employee list | Search, gender filter, optional Show deleted, Profile, conditional add/edit/delete/restore | Admin/User variants are not clearly designed as distinct field sets; birth date and salary are not list columns. Verify filtering, row actions, and deleted visibility with actual roles. |
| Employee profile | Employee identity, gender, hire/separation dates and job history table; Add/Delete history gated by flags; salary masked by a separate view flag | Profile action itself is always rendered for listed rows. History access must be gated by the specific View Job History right before fetching; current source does not show a visible explicit right-gated entry control. Verify server response redaction and role behavior. |
| Form/feedback | Labels, required attributes, inline save/error text, saving label, confirm before delete | Native unstyled inline form; verify focus/error association, cancel behavior, duplicate/invalid date response, network error recovery, and small-screen keyboard operation. |

## Proposed verification checklist (not results)

1. Compare Admin and standard User accounts; verify only authorized controls and rows appear. Test direct URL/API attempts separately; UI hiding is not authorization.
2. Check Active, Inactive, All, search+filter zero results, loading, network failure/retry, and refresh after create/edit/archive/restore.
3. Test employee Add/Edit, optional separation date, and deleted-vs-separated distinction.
4. Test history with no view right, view-only right, history-management right, salary right, and no salary right. Confirm no sensitive value leaks in list, DOM/accessibility tree, API payload, or exports.
5. Keyboard traverse all controls; check focus order/visibility, labels, table reading order, error announcements, confirmation dialog behavior, zoom and 320px reflow.
6. Capture evidence per implemented screen only after runtime testing; record browser/viewport, role/right setup, exact route and pass/fail. Do not call a design-only checklist a usability study.

## Privacy and accessibility review notes

Birth date and salary require field-level authorization, not just omitted columns. Confirm restricted values are absent from unauthorized API responses, DOM, accessibility tree, exports, and logs. Job-history access must be checked before its data is fetched. These are verification requirements; no leak or successful mitigation is asserted by this source-only review.

The source contains labels on many form inputs and table headers, but semantic captions, focus behavior, error associations, contrast, keyboard flow, screen-reader announcements and phone reflow were not runtime-verified. Use the checklist above before recording a pass.

## Issues for developer follow-up

**Relevant implementation issues:** [#77 Department](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/77), [#80 Job](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/80), [#84 Employee list](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/84), [#88 Employee form](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/88), [#91 Separation/soft-delete](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/91), [#93 Job history mutations](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/93), [#96 Profile/history](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/96), [#100 History/salary right](https://github.com/jamesseno/Clinic-Squad---HOPE-Inc.-Midterm-Project/issues/100).

**Open design checks:** status filter parity; explicit history access affordance; responsive table/form layout; error and empty-state clarity; source/API-level salary and birth-date protection. These are not marked fixed or verified here.
