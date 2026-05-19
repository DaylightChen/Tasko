# Task 18 — Hotkey registry + command palette + keyboard shortcut help overlay

## Goal

Consolidate keyboard input into a single, mode-aware hotkey registry. Throughout tasks 8–16, individual views wired ad-hoc `useEffect` keylisteners — those keep working but the registry is the source of truth from this task onward. Build the **command palette** (`cmdk` library) as the full implementation with every command from `microcopy.md` §12 + dynamic commands ("Go to <Project>", "Go to #<tag>", "Add Epic in <project>", etc.). Build the **keyboard shortcut help overlay** triggered by `?` (per `microcopy.md` §13). Wire the `⌘F` no-search toast ("Use ⌘K to navigate."). Verify the landmark + skip-link + heading hierarchy is complete across every view.

## Context files

- `docs/ux/interaction-patterns.md` — §4 the entire keyboard shortcuts master table (global / no-input / input / modal / row / command-palette / calendar / kanban / tree / tag-input / date-picker modes), §4.12 conflict resolution.
- `docs/ux/component-inventory.md#33-command-palette-modal--⌘k-` — full command palette spec (input, categories, recent + curated, keyboard, ARIA).
- `docs/ux/screens.md` — Command palette + keyboard-shortcut-help-overlay screens.
- `docs/ux/microcopy.md` — §12 command list (every entry, including dynamic commands), §13 keyboard shortcut help overlay text.
- `docs/ux/accessibility.md` — §2.1 global single-key shortcuts (no-input mode), §2.2 modifier shortcuts, §2.3 per-mode maps, §2.5 focus indicator, §2.6 focus restoration, §3 ARIA per component, §3.12 landmarks, §3.13 headings.
- `docs/engineering/2026-05-18-frontend-architecture.md#8-hotkey-registry` — the full implementation skeleton (modeStack + global keydown listener + the HOTKEY_MAP).
- `docs/engineering/2026-05-18-code-architecture.md#4-3-stores---examples` — hotkeyStore shape.
- `docs/ux/interaction-patterns.md#10-the--no-global-search--affordance` — `⌘F` shows "Use ⌘K to navigate." toast.

## Downstream dependencies

- **Task 19** runs the axe + manual SR audit; this task's a11y compliance is verified there.
- **Task 20** writes E2E tests that exercise every hotkey + palette command.

## Steps

1. **Hotkey store** — `apps/web/src/store/hotkey-registry.ts` per `code-architecture.md` §4.3:
   ```ts
   import { create } from 'zustand';

   export type HotkeyMode =
     | 'no-input' | 'input' | 'modal' | 'sheet'
     | 'calendar' | 'kanban' | 'tree'
     | 'command-palette' | 'tag-input' | 'date-picker';

   interface HotkeyState {
     modeStack: HotkeyMode[];
     currentMode: HotkeyMode;        // derived (top of stack, or 'no-input' if empty)
     push: (m: HotkeyMode) => void;
     pop: () => void;
     reset: () => void;
   }
   ```
   - `currentMode` recompute on each push/pop. `'no-input'` is the default when stack is empty.
2. **`useHotkey` hook** — `apps/web/src/hooks/useHotkey.ts`:
   ```ts
   export function useHotkey(mode: HotkeyMode | HotkeyMode[], key: string, handler: (e: KeyboardEvent) => void, opts?: { allowModifiers?: boolean }): void;
   ```
   - Subscribes to `hotkeyStore.currentMode`. When the current mode matches AND the keydown matches `key` (and modifier combos when `key` is `Mod+X` form), invokes `handler`.
   - For modifier combos: `Mod` resolves to `Meta` on Mac (`navigator.platform.includes('Mac')`) or `Ctrl` elsewhere. Helper in `apps/web/src/lib/keyboard.ts`:
     ```ts
     export function isModKey(e: KeyboardEvent): boolean;
     export function matchHotkey(spec: string, e: KeyboardEvent): boolean;  // spec like 'Mod+k', 'Mod+Shift+m', '?', 't'
     ```
3. **HotkeyProvider** — `apps/web/src/app/hotkey-provider.tsx` (replaces task-04's no-op stub):
   - On mount: registers one `document.addEventListener('keydown', handler, true)` (capture phase so it runs before native handlers).
   - The handler reads `currentMode` from the hotkey store, looks up in a static `HOTKEY_MAP` per `frontend-architecture.md` §8.3, and either calls the action (and `preventDefault` if the action consumed the key) or does nothing.
   - Suppresses single-keys when `currentMode === 'input' || 'tag-input' || 'command-palette'` UNLESS the spec is a modifier-combo (those always fire).
   - Per UX §4.12: `⌘B` / `⌘I` / `⌘K` inside a textarea are wired BY the textarea (task-13); the global registry must NOT fire `⌘K` (command palette) when `currentMode === 'input'` AND the focused element is a textarea — handled by suppression rule.
4. **Mode transitions** — wire the push/pop calls at the appropriate places:
   - Any focus on `<input>`, `<textarea>`, `[contenteditable]` → `push('input')`; blur → `pop()`. Implementation: a `useEffect` in `HotkeyProvider` that registers `focusin` / `focusout` on `document.body`.
   - Modal mount → `push('modal')`; unmount → `pop()`. The `Modal` component (task-05) calls into the hotkey store on mount/unmount.
   - Sheet mount → `push('sheet')`.
   - Command palette mount → `push('command-palette')`.
   - Tree view → `push('tree')` on view focus; pop on leave. Calendar / Kanban same.
   - Tag input focus → `push('tag-input')`.
   - Date picker open → `push('date-picker')`.
   - Each of these mode-pushes is in the corresponding component (Modal in task-05, calendar in task-14, etc.). For task-18, AUDIT each existing component and add the `push/pop` calls. Comment with `// task-18: hotkey mode`.
5. **HOTKEY_MAP** — `apps/web/src/app/hotkey-map.ts` (the central table per `frontend-architecture.md` §8.3):
   ```ts
   import { useNavigate } from '@tanstack/react-router';
   import { useCommandPaletteStore } from '@/store/command-palette';
   import { useSidebarToggle } from '@/store/sidebar';
   // ... etc.

   export function getHotkeyAction(spec: string, mode: HotkeyMode): (() => void) | undefined { ... }
   ```
   Encode every binding from `interaction-patterns.md` §4:
   - **Global** (matches in any mode unless suppressed):
     - `Mod+k` → open command palette
     - `Mod+\` → toggle sidebar collapsed
     - `Mod+z` → undoStore.pop() (within 5s window)
     - `Mod+Shift+z` → focus the most recent snackbar's action button
     - `Mod+f` → show transient toast "Use ⌘K to navigate." (3s auto-dismiss; subsequent presses within 60s silent)
     - `?` → toggle keyboard shortcut help overlay
   - **`no-input` mode**:
     - `t` → navigate to /today
     - `i` → navigate to /inbox
     - `n` → focus the current view's quick-add input
     - `/` → focus quick-add (alternative)
     - `j` / `ArrowDown` → moveFocus down in current list
     - `k` / `ArrowUp` → moveFocus up
     - `h` / `ArrowLeft` → moveFocus left (calendar / kanban grids)
     - `l` / `ArrowRight` → moveFocus right
     - `Space` → toggle focused row's checkbox (calls the view's handler via a shared `useFocusedRowAction()` hook)
     - `x` → alternative toggle complete
     - `Enter` / `o` → open modal for focused row
     - `1` / `2` / `3` / `4` → set priority on focused row
     - `t` (already mapped — and same key for "Today nav" — by mode this becomes "schedule to today" when a row is focused vs "go to Today" otherwise; we resolve via a sub-mode "row-focused" derived from `useFocusedRow().focusedId !== null` AND on a list view). The cleanest model: the action for `t` is a single dispatcher that checks `useFocusedRow().focusedId`; if set → schedule to today; else → go to Today route.
     - `Backspace` / `Delete` → soft-delete focused row (with confirmation)
     - `Esc` → blur input / clear multi-select / close dropdown / close popover / etc. (cascading effect — each open surface listens for Esc independently).
   - **`modal`** / **`sheet`** mode:
     - `Mod+Enter` / `Mod+s` → save modal (calls a context callback)
     - `Esc` → close modal with unsaved-changes guard (the modal component handles)
     - `Tab` / `Shift+Tab` → cycle fields (native behavior + trap, modal handles)
   - **`calendar`** mode:
     - `ArrowLeft` / `ArrowRight` → day
     - `ArrowUp` / `ArrowDown` → week
     - `PageUp` / `PageDown` → month
     - `Shift+PageUp` / `Shift+PageDown` → year
     - `Home` / `End` → start / end of week
     - `t` → jump to today
     - `Enter` → day-detail popover
     - `n` → new task on focused day
   - **`kanban`** mode:
     - `ArrowUp` / `ArrowDown` → reorder card within column
     - `ArrowLeft` / `ArrowRight` → move card to previous / next column (status mutate)
     - `Enter` / `o` → open modal
     - `Space` / `x` → toggle complete
   - **`tree`** mode:
     - `ArrowUp` / `ArrowDown` → previous/next sibling
     - `ArrowLeft` → collapse, or move to parent if collapsed
     - `ArrowRight` → expand, or move to first child if expanded
     - `Enter` / `o` → open modal
     - `Space` → toggle checkbox (Tasks only)
     - `Mod+Shift+m` → open Move-to picker
   - **`tag-input`** mode:
     - `Enter` / `,` → commit
     - `Backspace` (on empty) → remove last chip
     - `ArrowDown` → open suggestions / move into them
     - `Tab` → exit
   - **`date-picker`** mode:
     - Arrow keys, PageUp/Down per UX §4.11
     - `t` / `m` / `w` / `n` quick-select
6. **Command palette** (`apps/web/src/components/command-palette/`) — replaces task-04's empty stub:
   - Use the `cmdk` library: `<Command>`, `<Command.Input>`, `<Command.List>`, `<Command.Item>`, `<Command.Group>`, `<Command.Empty>`.
   - Wrapped in a Modal (max-width 560px, `radius-lg`, `elevation-3`).
   - Open via `Mod+k`. `useCommandPaletteStore.open` toggles render.
   - **Layout** per UX §33:
     - Top: large text input with leading `Command` Lucide icon + placeholder "Type a command…" (microcopy §12.1).
     - Below: scrolling result list.
     - Section headers: "Recent" / "Navigate" / "Create" / "View" / "Settings" (microcopy §12.1).
     - Empty results: "No matching commands. Try a different word." (microcopy §12.1).
   - **Initial state** (no query): recent commands (last 5 from `useCommandPaletteStore.recent`) + curated: "Go to Today", "Go to Inbox", "Add task", "Add project", "Open settings", "View keyboard shortcuts" (per UX §33.3).
   - **Command catalog** — `apps/web/src/app/command-catalog.ts`:
     - Static commands per microcopy §12.2 (Go to Today / Tomorrow / Next 7 Days / Inbox / All / Calendar / Completed / Trash, Add task, Add project, New folder, Toggle sidebar, Show/Hide completed, Sort by …, Open settings, Switch theme to dark/light, View keyboard shortcuts).
     - Dynamic commands generated at palette open: "Go to <Project name>" for each project, "Go to #<tag name>" for each tag, "Add Epic in <project>" / "Add Feature under <Epic>" / "Add Task under <Feature>" when the current view has the appropriate focused context, "Move <Title> to…" when a single row is focused.
   - Each command has `id`, `label`, `category`, `keywords?: string[]`, `shortcut?: string` (rendered on right side as `text-mono` chip), `icon?: LucideIcon`, `action: () => void`.
   - Selecting a command: invokes `action()` + closes palette + adds to recent list (persisted to `localStorage` under key `tasko.command.recent`).
   - **Fuzzy match**: `cmdk` ships with built-in fuzzy ranking — use its `filter` API. No custom matcher needed.
   - **Keyboard** per §33.5: Arrow Up/Down navigate, Enter selects, Esc closes, Tab also moves into results (cmdk handles).
   - **ARIA** per §3.10: input is `role="combobox"` `aria-expanded` `aria-controls` `aria-activedescendant` `aria-autocomplete="list"`. Listbox: `role="listbox"`, items `role="option"`. cmdk applies these automatically; verify.
7. **Keyboard shortcut help overlay** — `apps/web/src/components/shortcut-help-overlay/`:
   - Per UX cross-screen annotation + microcopy §13. A non-modal floating panel anchored to bottom-right of viewport (per UX `screens.md` keyboard-shortcut-help-overlay).
   - Triggered by `?` (no-input mode) — the global hotkey. Also via the command palette command "View keyboard shortcuts" and the Settings page "View keyboard shortcuts" link (task-04).
   - Content: render the table from microcopy §13 (NAVIGATE / ROW / MODAL / CALENDAR / GLOBAL groups + their entries).
   - Dismiss: `?` again or `Esc` or clicking outside.
   - ARIA: `role="dialog" aria-label="Keyboard shortcuts"`; close button with `aria-label="Close keyboard shortcuts"`.
8. **`⌘F` no-search toast** — `apps/web/src/app/no-search-toast.ts`:
   - On `Mod+F` (global mode), call `snackbar.show({ variant: 'info', text: 'Use ⌘K to navigate.', durationMs: 3000 })`.
   - **De-bouncing**: don't show again if a `⌘F` toast was shown in the last 60 seconds. Track in a module-level `lastShownAt` timestamp.
9. **Refactor previous ad-hoc handlers** — in tasks 8–16, individual views registered `useEffect` keylisteners. Refactor each to use `useHotkey`. Examples to refactor:
   - `apps/web/src/views/today-view/`: `Space` / `Enter` / `1-4` / `T` / `Backspace` on focused row → switch to `useHotkey('no-input', 'Space', ...)` etc.
   - `apps/web/src/views/calendar-view/month.tsx`: arrows / PageUp / etc. → `useHotkey('calendar', 'ArrowLeft', ...)`.
   - `apps/web/src/views/project-view/kanban-view.tsx`: arrows + Space → `useHotkey('kanban', 'ArrowLeft', ...)`.
   - `apps/web/src/views/project-view/tree-view.tsx`: arrows + Space → `useHotkey('tree', 'ArrowLeft', ...)`.
   - Each view ALSO pushes/pops its mode on mount/unmount via `useHotkeyStore.push/pop`.
10. **Landmark + heading + skip-link audit** — verify every route:
    - `<a href="#main" className="skip-link">` is the first focusable element on every page (in `__root.tsx`).
    - `<nav aria-label="Primary navigation">` wraps the sidebar.
    - `<main id="main">` wraps the route's content.
    - Each route renders exactly one `<h1>` (the view title).
    - Section headers (Overdue, day-group, folder names, sidebar PROJECTS/TAGS) are `<h2>`.
    - No `<h3>` is used for primary view content (`<h3>` is acceptable for kanban column headers and rollup chips — keep them as `text-h3` styled but not semantic headings; use `role="heading" aria-level="3"` if needed).
    - `<html lang="en">` set (task-04).
    - Fix any gaps found.
11. **Tests** — `apps/web/src/__tests__/`:
    - `hooks/useHotkey.test.tsx`: register a hotkey for `'no-input'` mode + `'t'` key → dispatch a keydown → handler fires. Push `'input'` mode → re-dispatch → handler does NOT fire.
    - `app/hotkey-provider.test.tsx`: focus an `<input>` → mode auto-pushes to `'input'`; blur → pops.
    - `app/no-search-toast.test.tsx`: dispatch `Mod+F` → snackbar shows; dispatch again within 60s → no second snackbar.
    - `components/command-palette/command-palette.test.tsx`: open via `Mod+K` → input focused; type "today" → "Go to Today" highlighted; Enter → navigation fires; Esc → closes.
    - `components/command-palette/dynamic-commands.test.tsx`: with seeded projects + tags, open palette → "Go to <Project>" + "Go to #<tag>" appear.
    - `components/shortcut-help-overlay/help-overlay.test.tsx`: press `?` → panel appears; press `?` again → dismisses.
    - `app/keyboard-help-from-palette.test.tsx`: open palette → select "View keyboard shortcuts" → overlay opens.
12. **Manual end-to-end**:
    - `T` on Today (no input focused) → already on Today. From Inbox, `T` → navigate to Today.
    - `I` → Inbox.
    - `N` → focuses quick-add input in current view.
    - `1`-`4` on a focused row → priority changes.
    - `T` on a focused row → reschedules to today.
    - `Backspace` on a focused row → confirmation prompt.
    - `Mod+K` → palette opens. Type "settings" → "Open settings" appears → Enter → navigates.
    - `Mod+F` → snackbar "Use ⌘K to navigate.".
    - `?` → help overlay; `?` or Esc → closes.
    - Inside Task modal: `Mod+Enter` saves; Esc → unsaved-changes guard.
    - Calendar: Arrow keys move cell focus; `T` jumps to today; `N` opens modal with date pre-filled.
    - Kanban: arrow keys reorder/move-column; Space toggles complete.
    - Tree: arrows expand/collapse/navigate; Space toggles checkbox on Tasks; `Mod+Shift+M` opens Move-to picker.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every test in step 11 passes.
- [ ] All hotkey behaviors enumerated in `interaction-patterns.md` §4 work end-to-end (manual verification per step 12).
- [ ] Command palette opens via `⌘K` and contains every command from `microcopy.md` §12.2 (static + dynamic).
- [ ] `⌘F` shows the toast "Use ⌘K to navigate." (de-bounced).
- [ ] `?` toggles the keyboard shortcut help overlay with the exact content from `microcopy.md` §13.
- [ ] Mode transitions: focusing an input pushes `'input'` mode; opening a modal pushes `'modal'`; opening the palette pushes `'command-palette'`. Each pops on close.
- [ ] Single-key shortcuts are suppressed while `'input'` / `'tag-input'` / `'command-palette'` is active.
- [ ] `⌘B` / `⌘I` inside a textarea STILL work (per UX §4.12 conflict resolution — task-13's keybindings).
- [ ] Skip link, landmarks (`<nav>`, `<main>`), and `<h1>`/`<h2>` heading hierarchy verified on every route.
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/store/hotkey-registry.ts`
  - `apps/web/src/hooks/useHotkey.ts`
  - `apps/web/src/lib/keyboard.ts` (matchHotkey + isModKey)
  - `apps/web/src/app/hotkey-map.ts`, `apps/web/src/app/command-catalog.ts`, `apps/web/src/app/no-search-toast.ts`
  - `apps/web/src/components/command-palette/` (full impl + test)
  - `apps/web/src/components/shortcut-help-overlay/` (+ test)
  - `apps/web/src/store/sidebar.ts` (collapsed boolean + `⌘\` action — if not already shipped)
- Modified:
  - `apps/web/src/app/hotkey-provider.tsx` — real implementation (replace stub).
  - `apps/web/src/app/command-palette-host.tsx` — render the real `<CommandPalette />`.
  - Every view in `apps/web/src/views/` — replace ad-hoc keylisteners with `useHotkey` + push/pop mode on mount/unmount.
  - `apps/web/src/components/modal/`, `sheet/`, `task-modal/`, `tag-input/`, `date-picker/`, `priority-menu/`, `move-to-picker/` — call `useHotkeyStore.push('modal'|'sheet'|'tag-input'|'date-picker')` on mount; pop on unmount.
  - `apps/web/src/components/sidebar/` — add `⌘\` handler that toggles a `sidebarStore.collapsed` state which CSS uses for the 56px collapsed variant from UX §41.
