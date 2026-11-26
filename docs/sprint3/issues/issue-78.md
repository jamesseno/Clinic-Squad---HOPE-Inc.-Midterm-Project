# S3-SM-02: Re-prioritize any Sprint 2 carryover

Issue: #78
Owner: `jamesseno`
Target: Sprint 3, day 3

## Carryover review

The GitHub issue query for the `sprint-2` label returned no open issues at the time of this review. This does not substitute for checking the closed Sprint 2 issue history or verifying deployed behavior.

| Item | Current evidence | Disposition | Owner / next action |
|---|---|---|---|
| Open Sprint 2 issue backlog | No open issues returned for label `sprint-2` | No issue-level carryover identified | Scrum Master: retain links in the final sprint report |
| Customer/Product/Price History availability | Existing implementation is present in the repository; hosted behavior was not verified in this work | Gate Sprint 3 integration on regression and environment checks | Developer + Tester: run the available regression suite |
| HR/Sales integration PRs | PR #191 and #192 are closed and unmerged | Do not count as delivered to `main`; recover their required changes through reviewed issue-specific PRs | Scrum Master + assigned Developers |
| Hosted auth, invitation/reset, and Supabase behavior | No `.env.local` or authorized hosted project is available in this workspace | Block hosted sign-off; do not infer success from local builds | Project owner: arrange authorized non-production access |

## Priority decision

1. Keep security, privacy, and data-integrity defects ahead of visual polish.
2. Resolve migration and effective-date validation before relying on HR records.
3. Keep all work tied to its official issue and owner; do not silently relabel unfinished tasks as Sprint 2 completion.
4. Preserve open blockers for the Sprint 3 midpoint and exit reports until evidence exists.

## Status

The backlog check and dispositions above are documented. Functional carryover verification and the PR recovery work remain open; no Sprint 2 issue is being reopened or marked complete by this note.
