# Task 07 — Task modal + field popovers

## Goal

Build the largest user-facing UI surface in v1: the Task modal, plus every field-level popover it composes — Date picker (using `react-day-picker`), Time picker, Date+time combined, Priority menu, Tag input with autocomplete, Project picker (typeahead Dropdown), Recurrence picker, Subtask list (with inline add / reorder / delete). Modal supports New Task (title pre-filled from quick-add) and Edit Task (all fields pre-filled, plus Delete button bottom-left, plus Subtasks section). Field validation matches `microcopy.md` §28.1. Required fields are title, due_date, project. The modal opens with focus on the Due date field per the locked spec §6.1. After this task, an end-to-end flow works: quick-add input → enter title → modal opens → fill required fields → save → POST to `/api/items` → row appears (manual verification — the views are stubs until task-08).

## Context files

- `docs/ux/component-inventory.md` — §4 Textarea markdown (basic plain textarea ships here; full markdown render in task-13), §5 Date picker popover, §6 Time picker, §7 Date+time combined, §8 Dropdown (already in task-05), §9 Multi-select tag input, §10 Priority menu, §22 Subtask row, §14 Modal (already shipped).
- `docs/ux/screens.md` — Task modal (desktop) + mobile sheet variant — field order, required markers, "More" disclosure, Cancel/Save footer.
- `docs/ux/flows.md` — §1 first-time use (modal opens from quick-add), §6 recurring task lifecycle (recurrence picker fields per frequency), §13 tag use (autocomplete behavior + case-insensitive dedup).
- `docs/ux/microcopy.md` — §3 Task modal field labels + placeholders + Required helpers + error variants; §3.3 Recurrence picker labels; §4 button labels (Save / Cancel / Save changes / Delete / Add subtask); §28.1 form validation errors (every required-field error string).
- `docs/ux/accessibility.md` — §3.4 date picker ARIA (`role="dialog"` + grid + gridcell), §3.5 tag input ARIA (combobox + listbox), §4.1 modal trap (focus on Due date), §8 form validation (`aria-required`, `aria-invalid`, `aria-describedby`), §11 dates accessible long-form, §12.7 "+N more".
- `docs/ux/interaction-patterns.md` — §2 hover, §4.11 date-picker mode shortcuts (`t/m/w/n`), §4.10 tag-input mode shortcuts (Enter / `,` / Backspace / ↑↓), §11 confirmation policy (Discard changes guard).
- `docs/engineering/2026-05-18-data-model.md` — §3 Item schema (validates start_date <= due_date refinement), §6 Recurrence rule schema (discriminated union).
- `docs/engineering/2026-05-18-api.md` — §6.5 tag autocomplete endpoint, §2.10 subtask sub-routes.
- `docs/engineering/2026-05-18-frontend-architecture.md#14-quick-add-behavior` — quick-add → Modal contract, destination-context pre-fill rules.

## Downstream dependencies

- **Task 08** wires the quick-add input → opens this modal. The modal is the only authoring surface; the rest of the views just consume Items.
- **Task 09** uses Project picker with `parent_id` resolution inside the project tree (the "+ Add Task in Feature" inline flow opens the modal with project + parent pre-filled per the destination-context exception). Keep `initialParentId` prop on the modal.
- **Task 11** (recurrence) writes the server math. The Recurrence picker UI here writes a `RecurrenceRule | null` into the form state; the server consumes it.
- **Task 12** (trash) wires the Delete button in Edit mode → `useTrashItem().mutate(id)` + confirmation prompt.
- **Task 13** replaces the plain Textarea in the Notes field with the full markdown render+edit toggle.
- **Task 14/15** open this modal from calendar / kanban with `initialDueDate` / `initialStatus` pre-filled.

## Steps

1. **Date picker popover** (`components/date-picker/`):
   - Wrap `react-day-picker` v9. Use the `<DayPicker>` with `mode="single"`. Configure `weekStartsOn` from `useConfig().week_start` (0 = Sun, 1 = Mon).
   - Render inside a `Modal`-ish dialog or, when used in a form-field, a Popover anchored to the trigger (the date-chip button). On desktop: `@floating-ui/react` Popover. On mobile: render as a Sheet.
   - Above the calendar grid, a quick-select row (per UX §5.3): "Today" / "Tomorrow" / "Next week" / "No date" (only if `optional` prop is true). Each is a small Ghost button.
   - Footer: optional "Clear" button (only if `optional` and a value is set). Esc closes without selecting.
   - Today cell highlight: always drawn even if not selected (per §5.6). Use `react-day-picker`'s `modifiers` API.
   - Disabled dates: pass a `disabled` predicate. Use case: for the **Due date** picker, when the parent passes `minDate = start_date`, all dates before are disabled.
   - Single-key shortcuts inside the popover (per §4.11): `t` = today, `m` = tomorrow, `w` = next week (today + 7), `n` = no date (only if optional). Wire via `onKeyDown` on the popover root.
   - Long-form ARIA: each gridcell has `aria-label="<Day, Month DD, YYYY>"`. `react-day-picker` provides this via `labels` overrides; pass our `formatDateLong`.
   - Props:
     ```tsx
     export interface DatePickerProps {
       value: LocalDate | null;
       onChange: (v: LocalDate | null) => void;
       optional?: boolean;        // default false; if true, the popover allows "No date" / "Clear"
       minDate?: LocalDate;        // for due-date when start-date is set
       triggerLabel?: string;      // accessible name override
       weekStart: 'sun' | 'mon';
       open: boolean;
       onClose: () => void;
       anchorEl?: HTMLElement;     // for popover positioning
     }
     ```
2. **Time picker** (`components/time-picker/`):
   - Per §6: two scroll wheels (hour 00–23 or 01–12+AM/PM per device locale; minute in 00/15/30/45) + a free-text 24h `HH:MM` input below + a "Clear time" button to revert to all-day.
   - Implementation: simpler than full scroll-wheel; render two Dropdowns (hours, minutes) + the free-text input. The Dropdowns can use the existing Dropdown component (task-05). 15-min increments are the only menu options; the free-text input lets the user type any minute.
   - Validate `HH:MM` regex on free-text blur.
   - Props: `value: LocalTime | null`, `onChange`, `locale: '12h' | '24h' | 'system'`, `open`, `onClose`, anchor.
3. **Date+time combined** (`components/date-time-combined/`):
   - Per §7: a wrapper around DatePicker (left) + TimePicker (right). Right side collapsed by default; an "Add time" toggle expands it. An "All-day" toggle clears time when on. Tab order: quick-select → date grid → time toggle → time wheel (if visible) → all-day toggle → action buttons.
   - Used as the Task modal's Due date field. Props pass through to both inner pickers.
4. **Priority menu** (`components/priority-menu/`):
   - Per §10. Small popover with 4 rows: None / Low / Medium / High. Each row: priority dot (per design-language §2.7), label, optional keyboard shortcut hint (`1`/`2`/`3`/`4`). Current selection has a `Check` icon on the right.
   - Single-key shortcuts (when menu open): `1/2/3/4` set + close. Also `1/2/3/4` work globally when no input focused AND a row is selected — task-18 wires that path.
   - Props: `value`, `onChange`, `open`, `onClose`, anchor.
5. **Tag input** (`components/tag-input/`):
   - Per §9. Horizontal flow: tag chips + an inline text input + an autocomplete dropdown.
   - Behavior:
     - Type → autocomplete via `GET /api/tags/autocomplete?q=<prefix>` (TanStack Query debounced ~150ms). Show dropdown listing matching tags (case-insensitive). If no exact match, show "Create '<typed>'" as the bottom row.
     - Enter on a highlighted suggestion → select; Enter when only "Create '<x>'" → create + attach (server POST `/api/tags` is find-or-create — see task-03; even if already exists case-insensitively, server returns existing).
     - `,` (comma) is an alternative commit key.
     - Backspace on empty input → remove last chip.
     - Each chip is a button with an `X` to remove (`aria-label="Remove tag <name>"`).
     - The case-insensitive dedup happens on the server; the UI displays the existing tag's casing after selection.
     - The leading `#` is stripped on the client before sending — both `urgent` and `#urgent` route to the same `POST /api/tags` body `{ name: 'urgent' }`.
   - ARIA: container `role="group" aria-label="Tags"`. Input: `role="combobox" aria-expanded aria-controls={listboxId} aria-activedescendant={focusedOptionId} aria-autocomplete="list"`. Listbox: `role="listbox"` with `role="option"` children.
   - The `useTagAutocomplete(q: string)` hook ships here in `apps/web/src/api/tags.ts`: `useQuery({ queryKey: tagKeys.autocomplete(q), queryFn: () => apiCall(...), enabled: q.length > 0 })`.
   - Props: `value: TagId[]`, `tagsById: Map<TagId, Tag>` (resolved name display), `onChange`, `onCreateTag` (callback that does the find-or-create POST), `allTags: Tag[]` (for fallback render of chip names).
6. **Project picker** (`components/project-picker/`):
   - A typeahead Dropdown wrapper. Loads projects from `useProjects()` + folders from `useFolders()`. Shows projects grouped by folder (with the folder name as a non-selectable header) and ungrouped projects below.
   - Required-field semantics: the parent Task modal validates a project is selected before save; this component supports an empty / placeholder state ("Pick a project (or Inbox)" — from microcopy §3.1).
   - Inbox is always at the top of the list.
   - Props: `value: ProjectId | null`, `onChange: (id: ProjectId) => void`, `required`, `error?: string`.
7. **Recurrence picker** (`components/recurrence-picker/`):
   - Per `microcopy.md` §3.3. A small section in the modal. Top-level Dropdown: "Repeat" with options Never / Daily / Every N days / Weekly on… / Monthly on day N / Yearly. Switching frequency shows additional fields below:
     - Daily: no extra fields.
     - Every N days: number input (1-365).
     - Weekly on…: checkbox group of 7 weekdays.
     - Monthly on day N: number input (1-31). Helper text "This recurrence will use the last day of the month when needed." (per microcopy §28.2).
     - Yearly: month dropdown (1-12) + day input (1-31).
   - Below frequency-specific fields, an Anchor toggle (per microcopy §3.3): radio group "On schedule" / "After completion" with the explanatory helper text:
     `"On schedule" keeps the cadence even if you complete late. "After completion" restarts the clock when you finish.`
   - Internal state binds to a `RecurrenceRule | null` form value. Switching to "Never" sets to `null`.
   - Props: `value: RecurrenceRule | null`, `onChange`.
8. **Subtask list** (`components/subtask-row/` for the row + a list wrapper in the Task modal):
   - Per §22. 32px rows inside the modal's Subtasks section. Each row: drag-handle 16px (visible on hover; task-10 wires drag), SubtaskCheckbox, title (inline edit), hover-only `X` delete.
   - Strike-through when status === 'done'; `text-subtle` color.
   - At the bottom: an inline "+ Add subtask" row with a `+` icon and a TextInput. Enter creates the subtask + opens a new inline row beneath; Esc cancels in-progress new-subtask.
   - Subtask toggle does NOT trigger a snackbar (per §12.4 + inconsistencies §6.5 resolution).
   - For task-07, the parent (Task modal) calls the per-subtask API endpoints directly:
     - Add: `POST /api/items/:id/subtasks` — but if the modal is in "new task" mode (no item id yet), accumulate the subtasks in form state and send them as part of the `POST /api/items` body's `subtasks` array (per `ItemCreateSchema`).
     - In Edit mode: each subtask toggle / rename / delete / add hits `PATCH/POST/DELETE /api/items/:id/subtasks/:sid` — optimistic update of the modal's local subtasks state, snackbar on error.
   - Reorder via drag is wired in task-10; until then, ↑/↓ keyboard shortcuts on a focused subtask row move sort_order via PATCH.
9. **The Task modal itself** (`apps/web/src/views/task-modal/`):
   - The modal is opened via a global Zustand store: `taskModalStore` with `{ mode: 'new' | 'edit' | 'closed', initialTitle?, initialProjectId?, initialParentId?, initialDueDate?, initialStatus?, editingItemId? }`. Tasks 08+ call `taskModalStore.openNew({...})` or `taskModalStore.openEdit(id)`.
   - Render order per `screens.md` Task modal:
     1. Title (TextInput, focused only if mode === 'new' and `initialTitle == null`; mode === 'new' with `initialTitle != null` focuses Due date per §6.1).
     2. Due date (DateTimeCombined — `optional: false`) — **required**. Required `· Required ·` helper above field.
     3. Start date (DatePicker — `optional: true`, `maxDate: due_date`). Helper: "(optional)".
     4. Project (ProjectPicker — required).
     5. Tags (TagInput).
     6. Priority (PriorityMenu — surfaced inline as 4 selectable pills in the modal for visibility, not behind a popover; clicking a pill sets value). Or stick to the popover model (`Priority: <current>` button → menu) — pick the inline-pill version per screens.md.
     7. More disclosure ("More" / "Less" toggle) — collapsed by default for a new task; expands if values are set on open.
        - Notes (Textarea, plain `<textarea>` for now; task-13 layers markdown).
        - Recurrence (RecurrencePicker).
        - Edit mode only: Subtasks (SubtaskList) — appears between Notes and Recurrence.
   - Footer: `[Cancel]` on the left of `[Save]` on the right. Edit mode: `[Delete]` (Ghost button with Trash2 icon) on the bottom-left. Per `microcopy.md` §3.1: Save / Save changes (edit) / Delete / Cancel.
   - Keyboard: Tab/Shift+Tab cycles. `⌘Enter` or `⌘S` saves. Esc → unsaved-changes guard if dirty.
   - **Form validation** (on submit):
     - Title empty → error "Add a title." inline; focus moves to Title.
     - Due date null → "Pick a due date." (use a sentinel since the schema requires it; the modal's form state may have null until user picks).
     - Project null → "Pick a project.".
     - Start date > Due date → "Start date must be before due date." on Start field.
   - On submit:
     - New: build `ItemCreate` per `data-model.md` §3.2. POST via `useCreateItem()` (task-04 stub). On success → close modal + show snackbar "Saved." or rely on the row appearance to communicate creation per microcopy §7 ("(No snackbar — modal close + new row appearance is sufficient feedback.)").
     - Edit: PATCH via `usePatchItem()` (task-08 will add this; for task-07, write the hook in `apps/web/src/api/items.ts` as a basic mutation). On success → close.
   - **Dirty tracking**: form state diffs against initial values; if any changed, `dirty = true`. Modal's unsaved-changes guard activates on close.
   - **Mobile**: same layout in a Sheet instead of a Modal. The component decides via a `useIsMobile()` hook based on viewport (`useMatchMedia('(max-width: 768px)')`).
10. **Wire opening from quick-add** — in `apps/web/src/components/quick-add-input/` (task-06), Enter triggers `taskModalStore.openNew({ initialTitle: typedText })`. Wire this here.
11. **Tests** — `apps/web/src/views/task-modal/__tests__/`:
    - `task-modal.test.tsx`:
      - Open in new mode with `initialTitle: 'X'`; assert Title prefilled, Due date field has focus.
      - Open in new mode with no initial title; assert Title has focus.
      - Submit with empty Due date → error "Pick a due date.", focus moves to Due field.
      - Submit with start > due → "Start date must be before due date." on Start field.
      - Fill all required, click Save → `useCreateItem` called with the expected body.
      - Open in edit mode for an existing item → all fields pre-filled; click Delete → confirmation prompt shows "Move to Trash?".
      - Dirty modal → press Esc → unsaved-changes guard prompt shows.
    - `recurrence-picker.test.tsx`: switch frequency from Never → Weekly → Monthly. Verify weekday checkbox group appears for Weekly; day-of-month number input for Monthly. Anchor radio defaults to on_schedule.
    - `tag-input.test.tsx`: with no existing tags, type "urgent" → suggestions show "Create 'urgent'" → Enter → calls `useCreateTag().mutateAsync({ name: 'urgent' })` → chip added. Type "URGENT" → matches existing case-insensitively → suggestion shows existing tag with its preserved casing.
    - `date-picker.test.tsx`: open picker, press `t` → today selected + closed; press `m` → tomorrow; press `w` → next week; press `n` (only when optional) → null.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every test in step 11 passes.
- [ ] Manual: from a stub Today view, type a title in the quick-add input + Enter → modal opens, Due date focused. Fill due date, project, click Save → an Item is created on the server (`curl /api/items?view=all` shows the new item).
- [ ] Manual: opening the modal, leaving it dirty, pressing Esc → "Discard changes?" prompt appears. Pressing "Keep editing" returns to modal; pressing "Discard" closes without saving.
- [ ] Manual: in the modal, with subtasks added in new-task mode, Save → `POST /api/items` body includes the `subtasks` array per `ItemCreateSchema`.
- [ ] Manual: in edit mode, clicking Delete → "Move to Trash?" confirmation. (Confirm calls `useTrashItem` which is stubbed until task-12 — show a snackbar "Coming soon" if task-12 isn't done yet — but at minimum the prompt renders.)
- [ ] Manual: with the recurrence picker, set frequency = Weekly + check Mon/Wed/Fri + anchor = on_schedule → form state's `recurrence` matches the discriminated-union schema.
- [ ] Manual: ARIA — focus the modal → SR reads "Add task, dialog". Tab cycles inside. Esc closes (guarded).
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/components/date-picker/` (+ test)
  - `apps/web/src/components/time-picker/` (+ test)
  - `apps/web/src/components/date-time-combined/` (+ test)
  - `apps/web/src/components/priority-menu/` (+ test)
  - `apps/web/src/components/tag-input/` (+ test)
  - `apps/web/src/components/project-picker/` (+ test)
  - `apps/web/src/components/recurrence-picker/` (+ test)
  - `apps/web/src/components/subtask-row/` (+ test)
  - `apps/web/src/views/task-modal/index.tsx`, `apps/web/src/views/task-modal/form-state.ts` (form hook), `apps/web/src/views/task-modal/__tests__/task-modal.test.tsx`
  - `apps/web/src/store/task-modal.ts` (Zustand)
- Modified:
  - `apps/web/src/api/items.ts` — add `useCreateItem`, `usePatchItem` (basic, optimistic in task-08), `useItem(id)` (already exists in task-04 stub form; flesh out here if not).
  - `apps/web/src/api/tags.ts` — add `useTagAutocomplete(q)`, `useCreateTag()`.
  - `apps/web/src/components/quick-add-input/index.tsx` — Enter triggers `taskModalStore.openNew({ initialTitle })`.
