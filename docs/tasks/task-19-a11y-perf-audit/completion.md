---
status: complete
commit: 87c3653
completedAt: 2026-05-20T01:00:00Z
iterations: 2
---

# Task Completion — Task 19: A11y + perf audit + virtualization + reduced motion

**Verification:** Reduced-motion CSS overrides shipped (`tokens.css` `@media (prefers-reduced-motion: reduce)` zeroes all `--transition-*` tokens + applies `animation: none !important` to `*`/`*::before`/`*::after`). `@tanstack/react-virtual` wired at 5 thresholds across 11 views + 1 component: flat list views (Today/Tomorrow/Inbox/All/Tag/Completed/Trash/Per-project flat) at 100+ items; project tree-view at 200+ visible rows (DFS `buildVisibleTreeRows` flat traversal feeds the virtualizer; non-virtual `TreeNode` path preserved; inline-add doesn't function in the virtualized path — documented limitation); kanban-column at 150+ cards; calendar day-detail popover at 50+ items. A11y fix: `flat-list-view.tsx` quick-add `<input>` now has `aria-label="Add task to project"`. §13 audit checklist walked — every item verified, inherited from earlier tasks, or explicitly deferred (touch targets + 320px reflow deferred to v1.1 mobile work; manual contrast + 200% zoom deferred to release manual QA; axe-via-Playwright suite deferred to task-20 alongside Playwright infra setup).

Tests: 1127/1127 web pass (+2 new files: reduced-motion.test.tsx + virtualization.test.tsx; orchestrator updated kanban-done-overflow assertion to be virtualization-aware after the kanban column began virtualizing at >50 items). Typecheck + lint clean (428 files). `apps/web/test/setup.ts` extended with `offsetHeight/offsetWidth/getBoundingClientRect` jsdom stubs (the virtualizer needs non-zero container dimensions; jsdom returns 0); comment in setup.ts documents the rationale and the per-element override pattern for future tests that need real 0 dimensions.

Dev loop took 2 iterations. Iter-1 implementer landed all code-deliverables but left the task log empty and skipped the Playwright axe suite (no Playwright infra in repo). Iter-2 closeout filled in the full log including the §13 audit checklist with per-item status, removed 3 dead props from `FlatTreeRowRendererProps` (`inlineAddState`, `setInlineAddState`, `createItem` — unused in the virtualized path; inline-add only works in the non-virtual tree path, documented in code comment), added explanatory comment to the jsdom dimension stubs in `test/setup.ts`, and deferred the axe E2E suite to task-20 by appending a bullet to task-20's brief step 3 (`a11y-views.spec.ts` over 13 routes via AxeBuilder + `@axe-core/playwright` devDep) and recording the deferral in `docs/known-issues.md`.

Manual QA outputs still required for release (deferred per brief): macOS VoiceOver walkthrough across views, reduced-motion confirmation with macOS System Settings toggle, perf measurements (first-paint < 800ms, modal mount < 100ms, optimistic checkbox < 16ms, 250-row scroll FPS ≥ 60, calendar month with 100 events < 100ms), mobile 320px responsive smoke. These are best-effort manual checks for the release verification stage of task-20.

See `log.md` for the full per-iteration execution log including the §13 audit checklist.
