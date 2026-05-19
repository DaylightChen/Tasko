# Execution Log — Task 06: Components — rows, pickers, sidebar primitives

**Scope:** `project`

## Iteration 1

### Implement

**Components created (each as `apps/web/src/components/<name>/` with `index.tsx`, `styles.module.css`, `__tests__/`):**
- `checkbox/`, `subtask-checkbox/`, `card/`, `filter-chip/`, `sort-dropdown/`, `view-toggle/`, `multi-day-chip/`, `sidebar-nav-item/`, `folder-header/`, `project-row/`, `sync-footer/`, `quick-add-input/`, `task-list-row/`

**Library helpers:**
- `apps/web/src/lib/date-fmt.ts` — formatDateChip, formatDateLong, isOverdue
- `apps/web/src/lib/a11y.ts` — announce(message, priority)

**Files modified:**
- `apps/web/src/components/sidebar/index.tsx` — inline `SidebarNavItem` / `FolderHeader` / `ProjectRow` placeholders REPLACED with the new components; imports reordered for biome
- `apps/web/src/components/card/index.tsx` — added `onKeyDown` alongside `onClick` (useKeyWithClickEvents)
- `apps/web/src/components/filter-chip/index.tsx` — `<span role="group">` → `<div>` (useSemanticElements)
- `apps/web/src/components/task-list-row/index.tsx` — `<div role="listitem">` → `<li>`; title `<span role="button">` → `<button>`; removed `start_date!` non-null assertions; rowRef type updated to `HTMLLIElement`

**Decisions not in plan:**
- Title element is `<button type="button">` rather than `<span role="button">` — biome's `useSemanticElements` rule rejects role on non-button elements. CSS-module class styling is element-agnostic.

**Deviations from plan:** none structural.

**Issues encountered:**
- Biome lint rules (`useSemanticElements`, `useKeyWithClickEvents`, `noNonNullAssertion`, `organizeImports`) — all resolved by using proper semantic elements.

**Confirmed:** all typechecks 0 errors. lint clean. tests pass.

### Test
_(filled in after tester returns)_

### Review
_(filled in after reviewer returns)_
