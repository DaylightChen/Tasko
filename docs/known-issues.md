# Known Issues

> Track deferred bugs, workarounds, and architectural debt. Each entry should include a reproduction or symptom, the workaround in place (if any), and the conditions for revisiting.

## Format

```
## [Issue title]

**Discovered:** YYYY-MM-DD ([phase name], Task NN if applicable)
**Status:** open / mitigated / resolved
**Symptom:** [What goes wrong, including reproduction steps]
**Workaround:** [What's in place today, if anything]
**Revisit when:** [Trigger condition for picking this up]
```

---

## INBOX_PROJECT_ID contains chars excluded from the ULID base32 alphabet

**Discovered:** 2026-05-18 (implement, Task 02)
**Status:** mitigated
**Symptom:** The engineering spec states `INBOX_PROJECT_ID = '00000000000000000000INBOX0'` and claims all chars are in the ULID base32 alphabet, but `I` and `O` are excluded from Crockford base32. The strict `ProjectIdSchema` regex `/^[0-9A-HJKMNP-TV-Z]{26}$/` therefore rejects the constant.
**Workaround:** The indexer defines `ProjectDiskSchema` and `ItemDiskSchema` with relaxed id fields (`z.string().brand<...>()` without regex) for disk reads only. The strict schema is preserved for user-supplied input (API routes). The sentinel is created via `ProjectDiskSchema.parse(...)` internally.
**Revisit when:** The sentinel constant is changed to a valid Crockford base32 string (e.g. `00000000000000000000000000`). At that point, `ProjectDiskSchema` / `ItemDiskSchema` can be removed and the strict schemas used everywhere. Coordinate with any existing data migration if users have data with the old sentinel id.

---

## Calendar drag-to-reschedule is not available in v1

**Discovered:** 2026-05-19 (implement, Task 14)
**Status:** open (by design — v1 scope reduction)
**Symptom:** Users cannot drag a calendar event chip to a different date to reschedule. The only reschedule path is click → Task modal → edit the date field.
**Workaround:** Click the event chip to open the Task modal; use the date picker in the modal to change the due date. Alternatively, right-click the chip and choose "Edit date…" (same modal opens).
**Revisit when:** Post-v1 UX iteration. Wire `@dnd-kit` to `CalendarDayCell` to accept drops, and add `useDraggable` to `CalendarEventChip`. The `data-item-id` and `data-day-position` attributes are already in place for drag source identification. Per binding resolution §1.1 this was explicitly CUT from v1 scope.

---

## Axe E2E suite deferred to task-20 (Playwright infra not present until task-20)

**Discovered:** 2026-05-20 (implement, Task 19)
**Status:** deferred to task-20
**Symptom:** Task-19 brief listed `apps/web/test/e2e/a11y-views.spec.ts` as a required output (AxeBuilder scan across all 13 routes). However Playwright infrastructure (playwright.config.ts, test fixtures, webServer wiring) does not exist until task-20 sets it up in its step 1.
**Workaround:** None needed pre-task-20; automated a11y coverage for individual component behaviours is provided by Vitest unit tests for reduced-motion (tokens.css) and virtualization thresholds.
**Revisit when:** Task-20 Playwright setup is complete. The a11y-views spec is listed as a deliverable in task-20's brief step 3.

---

## TreeRow `aria-label` on `role="treeitem"` (deferred to task-18)
- **Where:** `apps/web/src/components/tree-row/index.tsx`
- **What:** TreeRow's `role="treeitem"` div doesn't set `aria-label`. Accessibility spec §3.6 and microcopy §29 define full row labels: `"Epic: <Title>, N of M tasks complete"`, `"Feature: <Title>, N of M tasks complete"`, etc.
- **Why deferred:** task-18 is the consolidated a11y / hotkey-registry sweep. Adding the aria-label now means re-touching the same code surface in two tasks. Logged for task-18's a11y audit pass.
