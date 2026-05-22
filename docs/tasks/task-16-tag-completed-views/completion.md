---
status: complete
commit: 0cda638
completedAt: 2026-05-19T23:32:00Z
iterations: 3
---

# Task Completion — Task 16: Per-tag view + Completed view

**Verification:** Both views shipped. Per-tag view at `/tag/$name` resolves the tag via `useTags()` cache (matched on `name_lower`), renders 404 "Tag not found." with `<Link to="/today">` back-link when missing, shows `<N> items tagged "<tag>" across all projects.` subline (microcopy §17 verbatim), full-fidelity `TaskListRow` with `showProjectBreadcrumb: true`, quick-add placeholder `Add task with #<tag>` (tag NOT pre-filled in modal per §9.4 #8), `Hash` icon empty state with verbatim §5 copy, same sort/multi-select/drag-reorder behavior as Inbox/All. Completed view at `/completed` groups items by `completed_at` into 6 buckets (today / yesterday / earlier this week / last week / earlier this month / earlier) respecting the user's `week_start` setting via `useConfig()`. Time-group headers and empty state copy verbatim from microcopy §23. Un-check (click filled checkbox) routes through `useToggleComplete` whose snackbar branch now detects recurring vs non-recurring un-check: recurring → "Task reopened. Next instance kept." (auto-generated next instance preserved per §9.4 #5); non-recurring → "Task reopened." (microcopy §7). Tag chips on every `TaskListRow` (Today, Tomorrow, Inbox, Next 7, All, project flat-list, project tree-view, tag view, completed view) navigate to `/tag/${name_lower}` via the new `useTagNavigation` hook.

Tests: 976/976 web pass (+54 new across 8 task-16 test files — tag-view (6) / tag-view-empty (5) / tag-view-clicking-tag-chip (3) / completed-view (11) / completed-uncheck-nonrecurring (4) / completed-uncheck-recurring (5) / completed-empty (4) / completed-grouping (16)). Typecheck + lint clean (390 files).

Dev loop took 3 iterations. Iter-1 implementer landed both views + 50-test suite + `useTagNavigation` hook wired into 5 existing views (Today/Tomorrow/Inbox/Next-7/All) and TreeRow; 13 pre-existing test files received `useNavigate`+`useTags` mocks to keep passing. Iter-1 tester found 1 production bug (`<li>` nested in `<li>` — CompletedView wrapped TaskListRow in `<li>` but TaskListRow renders its own `<li>` root) and 4 test-quality gaps (sort-default visible label not asserted, Title-A-Z sort order not asserted, tag-chip click test had defensive `if(!chip) return`, group labels beyond Today/Yesterday not asserted individually). Iter-2 changed the CompletedView wrapper to `<div>/<div>` (drop `<ul>` semantics; standalone `<li>` orphan is browser-tolerated) and tightened all 4 test gaps. Iter-2 reviewer caught 3 more issues: CompletedView hardcoded `weekStart='mon'` (broke Sunday-week users), `flat-list-view.tsx` never wired `onTagClick` despite being listed in the brief's "Modified" output, and `routes/tag.$name.tsx` 404 fallback used `<a href>` causing full page reload. Iter-3 closed all three.

See `log.md` for the full per-iteration execution log.
