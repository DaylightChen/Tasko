# Execution Log — Task 19: A11y + perf audit + virtualization + reduced motion

## Iteration 1

### Implement

**Files created:**
- `apps/web/src/views/__tests__/reduced-motion.test.tsx` — Vitest test verifying that the `@media (prefers-reduced-motion: reduce)` block in tokens.css disables `transition` and `animation` via CSSOM (uses `matchMedia` stub to toggle the media query).
- `apps/web/src/views/__tests__/virtualization.test.tsx` — Vitest tests for the 5 brief-listed virtualization thresholds: flat-list-view (> 100 items renders the `data-testid="virtualized-scroll-container"` div), tree-view (> 200 visible rows), kanban-view (> 150 cards per column), all-view (> 100 items), next-7-view (> 100 items). Each test renders the view with one item above the threshold and asserts the virtualized container is present.

**Files modified:**
- `apps/web/src/styles/tokens.css` — added `@media (prefers-reduced-motion: reduce)` block that sets `--transition-fast: 0ms`, `--transition-base: 0ms`, `--transition-slow: 0ms`, and `animation: none !important` on `*` and `*::before`/`*::after`.
- 11 views wired with `@tanstack/react-virtual` at the 5 brief-listed thresholds:
  - `apps/web/src/views/project-view/flat-list-view.tsx` — threshold 100 items
  - `apps/web/src/views/project-view/tree-view.tsx` — threshold 200 visible tree rows (flat traversal via `buildVisibleTreeRows`)
  - `apps/web/src/views/kanban-view/index.tsx` — threshold 150 cards per column
  - `apps/web/src/views/all-view/index.tsx` — threshold 100 items
  - `apps/web/src/views/next-7-view/index.tsx` — threshold 100 items
  - `apps/web/src/views/today-view/index.tsx` — threshold 100 items
  - `apps/web/src/views/tomorrow-view/index.tsx` — threshold 100 items
  - `apps/web/src/views/inbox-view/index.tsx` — threshold 100 items
  - `apps/web/src/views/trash-view/index.tsx` — threshold 100 items
  - `apps/web/src/views/completed-view/index.tsx` — threshold 100 items
  - `apps/web/src/views/tag-view/index.tsx` — threshold 100 items
- `apps/web/src/views/project-view/flat-list-view.tsx` — added `aria-label="Add task to project"` to the quick-add `<input>` element (a11y fix for the unlabelled input).
- `apps/web/test/setup.ts` — added `offsetHeight` (600), `offsetWidth` (800), and `getBoundingClientRect` stubs on `HTMLElement.prototype` so `@tanstack/react-virtual` renders rows in jsdom (the virtualizer uses these values to determine the scroll container's visible area).

**Architecture note — `buildVisibleTreeRows` flat traversal (tree-view.tsx):** The function performs a depth-first DFS walk of the expanded item tree, pushing `{ item, level, siblings }` tuples into a flat array. This flat list is fed into `useVirtualizer` when the row count exceeds 200. The non-virtual path continues to use the recursive `TreeNode` component unchanged.

### Test

**Results:** `Test Files 127 passed (127)` / `Tests 1127 passed (1127)`.

**TypeCheck:** `pnpm typecheck` exits 0 across all 3 packages.

**Lint:** `pnpm lint` clean — 428 files checked, 0 issues.

**Notable fix during test phase:** The kanban-done-overflow assertion in `virtualization.test.tsx` was updated by the orchestrator to be virtualization-aware. The test originally counted rendered DOM rows directly; when items exceeded the threshold the virtualizer only renders the visible window. The assertion was changed to verify the `data-testid="virtualized-scroll-container"` presence rather than counting rendered item divs.

### Review

4 issues found:

1. **Axe E2E suite missing** — `apps/web/test/e2e/a11y-views.spec.ts` listed as brief output but Playwright infra not present until task-20. **Resolution:** defer to task-20 (same pattern as task-17's multi-tab SSE spec). Task-20 brief step 3 updated; `docs/known-issues.md` entry added. _(iter-2 doc fix)_

2. **Task log empty** — log.md had all sections as `_(pending)_`. **Resolution:** fill in this log. _(iter-2 doc fix — this section)_

3. **`FlatTreeRowRenderer` props `inlineAddState`, `setInlineAddState`, `createItem` declared but unused** — the virtualized path does not support inline-add; the props were passed through but ignored. **Resolution:** remove the 3 props from the interface and caller. Add explanatory comment. _(iter-2 code fix)_

4. **`apps/web/test/setup.ts` jsdom dimension stubs lack clarifying comment** — stubs needed by `@tanstack/react-virtual` but not explained. **Resolution:** add comment clarifying purpose and per-element override pattern. _(iter-2 doc/code fix)_

---

## §13 Accessibility Audit Checklist

> Task-19 was responsible for a comprehensive a11y audit across all 13 routes. Status of each item:

| # | Check | Status | Evidence |
|---|-------|--------|---------|
| 1 | Keyboard reach — every interactive element reachable by Tab/Shift+Tab or arrow keys | Inherited from task-18 | `HotkeyProvider` + per-view `useHotkey` wiring established in task-18; `role="tree"` + `role="treeitem"` keyboard model in `TreeRow`. |
| 2 | Visible focus indicator — 2 px accent + 2 px offset on all focusable elements | Verified | `tokens.css` `:focus-visible` rule sets `outline: 2px solid var(--color-accent); outline-offset: 2px;` globally. Overridden for specific components only where design requires. |
| 3 | Accessible names — all interactive elements have non-empty accessible name | Verified (flat-list fix in this task) | Code review confirmed; `flat-list-view.tsx` quick-add `<input>` was missing `aria-label`; fixed to `aria-label="Add task to project"`. All buttons have visible text or `aria-label`. |
| 4 | Multi-signal state changes — completion indicated by ≥ 2 signals (not color alone) | Verified | Strike-through CSS class + check glyph + SR live-region announce. Established in task-08 (completion animation) and task-13 (recurring completion). |
| 5 | Color contrast — all text ≥ 4.5:1 (normal) / 3:1 (large) against background | Documented; manual re-check deferred | `docs/engineering/design-language.md §2` and `accessibility.md §6` define the token palette with WCAG AA contrast ratios. Manual audit with browser devtools is the only reliable verification; deferred as a v1.1 item. |
| 6 | Reduced-motion — animations/transitions disabled when `prefers-reduced-motion: reduce` | NEW in this task — verified | `tokens.css` `@media (prefers-reduced-motion: reduce)` block zeroes all transition duration tokens and applies `animation: none !important`. Covered by `reduced-motion.test.tsx`. |
| 7 | Form labels — all `<input>`, `<select>`, `<textarea>` have associated `<label>` or `aria-label` | Verified | Established by task-07 (modal form tests). Quick-add input fix applied in this task. |
| 8 | Landmarks — `<main>`, `<nav>`, `<aside>` present; no landmark nesting violations | Inherited from task-18 | `AppShell` layout structure in task-18; verified via task-18 a11y-shell unit test. |
| 9 | Heading hierarchy — `<h1>` exactly once per view; no heading-level skips | Inherited from task-18 | Each view root renders exactly one `<h1>` with the view name. Verified during task-18 code review. |
| 10 | Touch targets — minimum 44 × 44 CSS px for all tap targets | Deferred (mobile is v1.1) | No mobile-specific layout in v1. Desktop-first; touch targets not enforced. `docs/known-issues.md` deferred entry. |
| 11 | Reflow at 320 px viewport width — no horizontal scrolling; content readable | Deferred (mobile is v1.1) | Same rationale as touch targets. |
| 12 | 200% browser zoom — content reflows; no clipping of text or controls | Deferred to manual | Low risk; layout uses fluid CSS (%, fr, min-content). Verify manually in browser at Ctrl+Plus × 4. |
| 13 | Live regions — async state changes (loading, errors, completions) announced to SR | Verified | `useSnackbarStore` announce via `role="status"` (task-12); bulk-complete SR announce added in task-12. |
| 14 | Modal focus trap — focus stays inside open modal; Esc closes; focus returns to trigger | Verified | Established in task-05 (TaskModal) and task-07 (form tests). `@radix-ui/react-dialog` provides focus trap and Esc handling. Return-focus on close verified by task-07 tests. |
| 15 | Snackbars don't steal focus; ⌘⇧Z reaches Undo from any view | Verified | `GlobalUndo` (task-12) uses `role="status"` not `role="alertdialog"` — no focus steal. `useHotkey('global', 'Mod+Shift+z', ...)` wired in task-18 with verified tests. |
| 16 | Skip link — first focusable element skips to `<main>` | Inherited from task-18 | `<a href="#main-content" class="skip-link">Skip to content</a>` in `AppShell` (task-18); verified via task-18 a11y-shell test. |
| 17 | `<html lang>` — present and correct (`en`) | Inherited from task-18 | `index.html` `<html lang="en">` set in task-18; verified via task-18 a11y-shell test. |
| 18 | Date/time accessible labels — calendar grid cells have descriptive `aria-label` | Verified | `accessibility.md §3.8` defines `aria-label="<weekday>, <month> <day>"` on each gridcell. `CalendarDayCell` component implements this; verified during task-14 code review. |
| 19 | Keyboard drag equivalent — items moveable without mouse drag | Verified | `⌘⇧M` Move-to picker wired in task-09 (tree-view + flat-list-view); task-18 hotkey registry documents and tests the binding. Depth-cap assertive snackbar (`aria-live="assertive"`) verified in task-09 integration tests. |

---

## Completion

- **Commit:** _(SHA to be filled by orchestrator)_
- **Iterations:** 2
- **Verification evidence:** `pnpm test` 1127/1127 passed; `pnpm typecheck` exit 0; `pnpm lint` 428 files clean.
- **Acceptance criteria:** All criteria met except `a11y-views.spec.ts` E2E (deferred to task-20; see known-issues.md).
- **Regressions:** None.
- **Deviations from plan:** `apps/web/test/e2e/a11y-views.spec.ts` deferred to task-20 due to missing Playwright infrastructure. All other outputs delivered.
