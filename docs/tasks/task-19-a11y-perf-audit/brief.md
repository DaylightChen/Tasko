# Task 19 — Accessibility + performance audit + virtualization + reduced motion

## Goal

Consolidate the WCAG 2.1 AA compliance pass: run `axe-core` on every route, manually walk through with a screen reader, verify every item in `accessibility.md` §13 audit checklist. Implement reduced-motion overrides as a single `@media (prefers-reduced-motion: reduce)` block in `tokens.css` that overrides the motion duration tokens. Add `@tanstack/react-virtual` at the perf thresholds: flat lists > 200 rows, tree views > 200 visible rows, kanban columns > 50 cards, day-detail popover > 50 items, completed view > 200 rows. Document any AA failures with mitigation per `accessibility.md` §1.

## Context files

- `docs/ux/accessibility.md` — entire document, especially §1.1 contrast targets, §1.4 color independence table, §4 focus management, §5 SR announcements, §7 reduced-motion overrides, §13 audit checklist.
- `docs/ux/design-language.md#6-4-reduced-motion-overrides` — exact substitution map.
- `docs/ux/interaction-patterns.md#7-animation-token-reuse` — motion token table with reduced-motion fallbacks.
- `docs/engineering/2026-05-18-architecture.md#10-performance-budget` — virtualization thresholds + perf targets.
- `docs/engineering/2026-05-18-architecture.md#6-6-virtualization----`tanstack-react-virtual-` — conditional virtualization rules.
- `docs/engineering/2026-05-18-feature-mapping.md#1-1-token-css-layer`, §1.6 skip link + landmarks.

## Downstream dependencies

- **Task 20** — the E2E suite runs after this; it will include axe assertions on key views.

## Steps

1. **Reduced-motion overrides** — `apps/web/src/styles/tokens.css`:
   - Add at the bottom (after all theme blocks):
     ```css
     @media (prefers-reduced-motion: reduce) {
       :root[data-theme='light'], :root[data-theme='dark'], :root {
         --motion-instant: 80ms;
         --motion-fast: 80ms;
         --motion-base: 80ms;
         --motion-medium: 80ms;
         --motion-slow: 80ms;
         --ease-spring-soft: linear;
       }
       /* Functional motions (loaders, drag shadows, focus rings, drop highlights) retained — they're not driven by motion-* tokens but by event handlers or CSS-keyframes that bypass tokens. */
     }
     ```
   - Verify: components that use `transition: <prop> var(--motion-medium) var(--ease-spring-soft)` now get ~80ms linear under reduced motion. The spring bounce is replaced by linear.
   - Verify: drag-pickup scale 1.02 has its own override (CSS rule `@media (prefers-reduced-motion: reduce) { [data-state="dragging"] { transform: none } }`) in `apps/web/src/components/drag-visuals/styles.module.css` (added in task-10 — double-check).
   - Verify: spinner / loader rotation is RETAINED under reduced motion (its rotation IS the affordance per accessibility.md §7).
   - Verify: snackbar countdown progress bar is RETAINED.
2. **Per-component reduced-motion smoke tests** — `apps/web/src/__tests__/reduced-motion.test.tsx`:
   - With `prefers-reduced-motion: reduce` (mock `matchMedia`), render: Modal, Snackbar, Checkbox completion sequence, Drag pickup. Inspect computed transition-duration; assert ≤ 80ms.
3. **Virtualization wiring** — add `@tanstack/react-virtual` to:
   - **Flat list views** (Today, Tomorrow, Next 7 Days within each day group, Inbox, All, per-tag, Completed within each time group, Trash, per-project flat) — when item count > 200, use `useVirtualizer({ count, getScrollElement, estimateSize: () => 40 /* desktop cozy */ })`. Otherwise render the normal `.map`. The conditional check is `items.length > 200 ? <Virtualized /> : <Plain />` per `architecture.md` §10.
   - **Tree view** — flatten the visible (expanded) tree to an array; when length > 200, virtualize. The flatten step is straightforward: recursive `walk(items, parent=null, depth=1, out=[])` that respects `expandedSet`.
   - **Kanban columns** — per column, when card count > 50, virtualize that column. The Done column overflow (50-cap with "Show all" expansion) takes precedence; if "Show all" is active and count > 50, virtualize.
   - **Day-detail popover** — when day's item count > 50, virtualize.
   - Tests in `apps/web/src/__tests__/virtualization.test.tsx`: seed 250 items into Today → assert virtualized container renders only ~10 visible rows in the DOM, plus a `data-testid="virtualized-spacer"` that accounts for the rest of the height.
4. **axe-core integration** — add `@axe-core/playwright` to dev deps. In `apps/web/test/e2e/`, create `a11y-views.spec.ts`:
   - For each route (`/today`, `/tomorrow`, `/next-7-days`, `/inbox`, `/all`, `/completed`, `/trash`, `/calendar/month`, `/calendar/week`, `/settings`, a created `/project/$id` route, `/project/$id/kanban`, a `/tag/$name` route), navigate + run `await new AxeBuilder({ page }).analyze()`. Assert no violations of severity `serious` or `critical`. Log any `moderate` / `minor` findings as warnings.
   - Common violations to fix proactively: missing form labels, missing alt text (use `aria-hidden` for purely decorative icons), insufficient color contrast (verify the tokens-table from `accessibility.md` §6 holds), missing landmark roles, duplicate IDs.
5. **Manual screen-reader walkthrough** — using macOS VoiceOver (`Cmd+F5`):
   - Open Today → SR announces "Tasko, navigation. Today, main." Skip link reads first.
   - Tab into sidebar → each item announces label + count + overdue sub-badge ("Today, 5 items, 3 overdue").
   - Arrow keys move through the task list.
   - Check a task → "<Title> completed. Undo available." (polite live region).
   - Open Task modal → "Add task, dialog. Due date, required". Focus on Due date.
   - Tab cycles within the modal. Esc → unsaved-changes prompt if dirty.
   - Calendar grid → "Calendar, May 2026." Arrow keys announce "Wednesday, May 18, 2026, 5 events".
   - Tree → each row announces "Epic: Marketing site relaunch, 2 of 9 tasks complete, level 1, 1 of 2".
   - Drag a row → "Dragging 'Buy charger'. Drop on a project, folder, or feature." (polite). Hover invalid target → "Cannot drop on Pricing page: would exceed nesting depth."
   - Document findings in `docs/.phased-dev/audits/sr-walkthrough-2026-05-18.md` (one-off; not committed as a doc — the audit notes live in the task log).
6. **WCAG audit checklist (`accessibility.md` §13)** — verify each item:
   - [ ] Every interactive element reachable via keyboard alone. Test by unplugging mouse + walking through every view.
   - [ ] Every interactive element has visible focus indicator (2px accent ring + 2px offset).
   - [ ] Every interactive element has an accessible name (text, aria-label, or aria-labelledby).
   - [ ] No element is the only signal that a state changed (e.g., completing a task: strike-through + checkbox glyph + SR announcement all fire).
   - [ ] Color contrast meets AA for all text + 3:1 for non-text UI. Run `pa11y` or just verify via design-language.md §2 contrast pairs.
   - [ ] Reduced-motion override applied for all decorative animations (verified by reduced-motion tests).
   - [ ] Form fields have associated labels, required hints, error associations (verified by task-07 tests).
   - [ ] Landmarks present (header, nav, main).
   - [ ] Heading hierarchy correct (one h1, then h2s, no skipped levels).
   - [ ] Touch targets 44x44 on mobile (mobile not QA-targeted — document as v1.1 follow-up if any are < 44).
   - [ ] Layout reflows at 320px width with no horizontal scroll.
   - [ ] Layout functional at 200% browser zoom.
   - [ ] Live regions announce state changes; not focus/hover.
   - [ ] Modals trap focus, return focus on close, support Esc.
   - [ ] Snackbars don't steal focus but are reachable via `⌘⇧Z`.
   - [ ] First focusable element is "Skip to main content" link.
   - [ ] `<html lang>` set.
   - [ ] All date/time strings have accessible long-form labels.
   - [ ] Drag-and-drop has a keyboard equivalent (move-to picker via `⌘⇧M`).
   - [ ] Depth-cap violations announce assertively.
7. **Performance verification** — for each perf target in `architecture.md` §10:
   - Open Today with 0 items → measure first-paint via Chrome DevTools Performance tab. Target < 800ms (`time to first contentful paint`).
   - Open Today with 250 items (seeded via API) → virtualization active; verify scroll FPS ≥ 60.
   - Open the Task modal → measure modal mount + first-paint. Target < 100ms.
   - Toggle checkbox optimistic → first paint after click ≤ 16ms.
   - Drag a row through 1000 sorted rows (seeded) → no jank, FPS ≥ 60.
   - Calendar month with 100 events → < 100ms render.
   - These are best-effort manual checks; v1 doesn't ship perf telemetry. Capture findings in `docs/.phased-dev/audits/perf-2026-05-18.md` (task log).
8. **Color contrast spot-check** — run `pa11y` (npm) on a hosted preview if convenient, OR manually verify each contrast pair in `accessibility.md` §6. The known exception (priority-medium amber dot at 2.9:1 light) is documented + accepted; verify the documentation is clear.
9. **Focus indicator audit** — manually Tab through every view's chrome row + first 3 items + sidebar; verify the 2px accent outline appears + 2px offset.
10. **Fix any issues found** — file each fix as a small change inline. Examples of likely findings:
    - A button without `aria-label` (e.g., the calendar chevron icons).
    - An incorrect heading level (e.g., a section using `<h3>` directly when no `<h2>` precedes it).
    - A missing `aria-hidden="true"` on a decorative icon.
    - A focus ring clipped by an `overflow: hidden` container.
    Each fix is a small modification to the relevant component file. Document fixes in the task log.
11. **Mobile responsive smoke test** — open the app on a 320px viewport (devtools device emulation). Verify:
    - Sidebar collapses to a sheet behind the menu icon (per UX global mobile layout).
    - Bottom nav appears (per UX §39).
    - Task list rows are 44px tall.
    - Task modal opens as a Sheet (per task-07).
    - No horizontal scrolling.
    These are confirmation-only checks — mobile is NOT a v1 QA target per binding decision. Note any blocking issues but accept them as v1.1.
12. **Pre-launch a11y annotation** — update `accessibility.md` only if engineering deviated from the contract. If the priority-medium contrast exception is honored as written, no update needed.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — `reduced-motion.test.tsx` + `virtualization.test.tsx` pass.
- [ ] `pnpm --filter @tasko/web test:e2e -- a11y-views.spec.ts` — axe analysis on every listed route returns zero `serious` or `critical` violations.
- [ ] Reduced-motion verified manually (macOS System Settings → Accessibility → Display → Reduce motion ON): no scale-1.02 on drag; modal opens with opacity fade only; checkbox tick is linear no-bounce; snackbar still has its countdown bar.
- [ ] Virtualization fires: with 250 seeded items in Today, only ~10-15 row DOM nodes exist at any time.
- [ ] Skip link present + reachable as the first Tab.
- [ ] Every view has exactly one `<h1>`; section headers are `<h2>`.
- [ ] All 19 items in the `accessibility.md` §13 audit checklist verified.
- [ ] No regressions: re-running `pnpm test` and `pnpm lint` after fixes — all green.
- [ ] Performance targets manually verified per step 7; any findings logged.

## Output files

- Created:
  - `apps/web/test/e2e/a11y-views.spec.ts`
  - `apps/web/src/__tests__/reduced-motion.test.tsx`, `virtualization.test.tsx`
  - `docs/.phased-dev/audits/sr-walkthrough-2026-05-18.md` (optional notes file)
  - `docs/.phased-dev/audits/perf-2026-05-18.md` (optional notes file)
- Modified:
  - `apps/web/src/styles/tokens.css` — add `@media (prefers-reduced-motion: reduce)` overrides.
  - `apps/web/src/views/today-view/`, `tomorrow-view/`, `next-7-view/`, `inbox-view/`, `all-view/`, `tag-view/`, `completed-view/`, `trash-view/` — wire virtualization at the 200-row threshold.
  - `apps/web/src/views/project-view/tree-view.tsx`, `flat-list-view.tsx`, `kanban-view.tsx` — virtualize.
  - `apps/web/src/views/calendar-view/day-detail.tsx` — virtualize when > 50.
  - `apps/web/package.json` — add `@axe-core/playwright` to dev deps.
  - Any component files where audit findings indicate a fix.
