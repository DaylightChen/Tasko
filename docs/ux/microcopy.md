---
title: Tasko — Microcopy Library
date: 2026-05-18
phase: ux
scope: project
status: draft
---

# Tasko — Microcopy Library

The canonical text for every user-facing string. Engineering must use these exactly. Translation work in v1.1+ will start from this canonical English source.

## Voice & tone

Tasko's microcopy voice is **terse-neutral**, with **2-3 specifically marked warm flourishes**. The model is Linear and Things 3: short, neutral, direct. Microcopy assumes the user is competent and doesn't need hand-holding.

### Voice rules

1. **Sentence case.** Not Title Case. Not ALL CAPS.
2. **Active voice.** "Add a task." not "A task should be added."
3. **Imperative for CTAs.** "Save", "Cancel", "Delete forever" — verbs the user is doing.
4. **Concise. Cut every word that isn't doing work.**
5. **No exclamation marks.** Ever. They are noise.
6. **No emoji.** (Per locked behavior.) Lucide icons carry visual warmth.
7. **No filler text.** Avoid "Please", "Sorry", "Just", "Simply".
8. **Direct about errors, not apologetic.** "Couldn't save. Try again." not "Oops! We're so sorry…"
9. **Specific numbers when possible.** "3 overdue items" beats "Some overdue items".
10. **No second-person warmth except in the marked flourishes.** Most copy talks about the data, not the user.

### The warm flourishes (3 strings total, all explicitly marked)

Per round 2, we lock **two to three warm flourishes**. v1 ships these three:

1. **Today empty (regular)** subline: "You're caught up. Enjoy the day." — quiet acknowledgment of accomplishment.
2. **First-run welcome headline**: "Welcome to Tasko." — a real greeting on the first ever open.
3. **First-run welcome subline**: "Add your first task above — type it and press Enter." — slightly conversational, with a directional hint.

Everywhere else: terse-neutral.

---

## How to read this doc

Each row has:
- **Context** — where the string appears.
- **String** — the exact text. Whitespace and punctuation are part of the contract.
- **Rationale** — why this wording; voice note if relevant.
- **Warm?** — `*` marks the three flourishes; everything else is terse-neutral.

---

## 1. Sidebar labels

| Context | String | Rationale |
|---|---|---|
| Smart list — daily landing | Today | Standard. Title case for the proper noun. |
| Smart list — next day | Tomorrow | Standard. |
| Smart list — week ahead | Next 7 Days | Standard. Numeric for scannability. |
| Smart list — unfiled tasks | Inbox | Standard. |
| Smart list — all active tasks | All | Terse. |
| System view | Completed | Standard. |
| System view | Trash | Standard. |
| System view | Calendar | Standard. |
| System view | Settings | Standard. |
| Section header — projects | PROJECTS | One of the few all-caps strings; `text-caption` tracking — section label, not a heading the user reads. |
| Section header — tags | TAGS | Same. |
| Folder creation prompt | Folder name… | Placeholder in inline edit. |
| Project creation prompt | (uses modal — see §3) | |
| Add project / add folder menu | New project / New folder | Terse imperative. |

---

## 2. Quick-add input

| Context | String | Rationale |
|---|---|---|
| Quick-add placeholder (default — Today view) | Add task | Terse. The action is the placeholder. |
| Quick-add placeholder (Inbox view) | Add task to Inbox | Reinforces destination context. Note: project field still requires explicit pick in modal per §9.4 #8. |
| Quick-add placeholder (project view) | Add task to <Project name> | Same — reinforces what view the user is on. The modal still requires Project selection (the user is implicitly told via the placeholder, but the modal forces an explicit choice — this is a friction call by spec). |
| Quick-add placeholder (Calendar view) | Add task on <focused day> | Date is auto-filled from the focused day. Project still empty. |
| Quick-add placeholder (per-tag view) | Add task with #<tag> | Tag is NOT pre-filled per locked behavior; placeholder is informational only. |
| First-run hint pointer | start here | Small accent annotation next to quick-add input on first-run. |

---

## 3. Modals

### 3.1 Task modal — labels

| Context | String | Rationale |
|---|---|---|
| Modal title (new task) | Add task | Terse, matches Things 3 / Linear. |
| Modal title (edit task) | Edit task | |
| Field label | Title | |
| Field label | Due date | Two words, no abbreviation — clarity matters here. |
| Field label | Start date (optional) | Explicit "optional" tag to manage expectation. |
| Field label | Project | |
| Field label | Tags | Plural. |
| Field label | Priority | |
| Field label | Notes | |
| Field label | Recurrence | |
| Field label | Subtasks | (in edit modal) |
| Field placeholder — title | Task title | Or "Type a title…" — we pick `Task title` (more direct). |
| Field placeholder — project | Pick a project | Imperative. |
| Field placeholder — tags | Add tag… | Trailing ellipsis = there can be more. |
| Field helper — due date | Required | `text-caption`, `text-subtle`. Appears beneath the field. |
| Field helper — project | Required | Same. |
| Field helper — title (when empty after blur) | Add a title. | Error variant. |
| Field helper — due date (when empty after blur or submit) | Pick a due date. | Error variant. |
| Field helper — project (when empty after blur or submit) | Pick a project. | Error variant. |
| Field helper — tag length over 32 chars | Tag names are limited to 32 characters. | Error variant. |
| Disclosure — show more fields | More | Collapsed label. |
| Disclosure — hide more fields | Less | Expanded label. |
| Add time button (date field) | Add time | |
| Remove time button (date field) | Remove time | |
| All-day toggle | All-day | Adjective, lowercase per voice rule. |
| Date quick-select | Today | |
| Date quick-select | Tomorrow | |
| Date quick-select | Next week | |
| Date quick-select | No date | (only when field is optional — start date) |
| Cancel | Cancel | |
| Save | Save | |
| Save (edit modal) | Save changes | Explicit when editing. |
| Delete (in edit modal, ghost button bottom-left) | Delete | (Soft-delete to Trash.) |

### 3.2 Project modal

| Context | String | Rationale |
|---|---|---|
| Modal title (new) | Add project | |
| Modal title (edit) | Edit project | |
| Field label | Name | |
| Field label | Folder (optional) | |
| Field label | Use Epic / Feature / Task hierarchy | Spelled out — toggle context matters. |
| Field placeholder | Project name | |
| Folder picker placeholder | No folder | Default selection label. |
| Primary action (new) | Create project | Verb-noun pairing. |
| Primary action (edit) | Save changes | |

### 3.3 Recurrence picker

| Context | String | Rationale |
|---|---|---|
| Picker title | Repeat | Standard term. |
| Option | Never | Default. |
| Option | Daily | |
| Option | Every <N> days | <N> is a numeric input adjacent. |
| Option | Weekly on… | + day selector beneath. |
| Option | Monthly on day <N> | + day-of-month numeric input. |
| Option | Yearly | + month + day picker. |
| Anchor toggle label | Anchor next due date | (small section label above the radio) |
| Anchor radio | On schedule | E.g., next due = previous due + N. |
| Anchor radio | After completion | E.g., next due = completion + N. |
| Helper text under anchor | "On schedule" keeps the cadence even if you complete late. "After completion" restarts the clock when you finish. | Two sentences. Explanatory because the distinction is the entire point of the toggle. |

---

## 4. Buttons (action labels by context)

| Context | String | Rationale |
|---|---|---|
| Add a task | Add task | |
| Add a project | Add project | |
| Add an Epic in a hierarchical project | Add Epic | |
| Add a Feature under an Epic | Add Feature | |
| Add a Task under a Feature | Add Task | |
| Add a Task at the project root (loose) | Add Task in project | |
| Add a subtask in Task modal | Add subtask | |
| Move all overdue items to today (Today view) | Move all overdue to today | Used as Ghost button next to the Overdue strip header. |
| Move-all confirmation primary action | Move all | (in confirmation modal) |
| Empty Trash | Empty Trash | (Destructive) |
| Empty Trash confirmation primary | Empty Trash | (Destructive) — verb in the confirm matches the trigger. |
| Restore a single item from Trash | Restore | |
| Permanently delete a single Trash item | Delete forever | (Destructive) |
| Permanently delete confirmation primary | Delete forever | |
| Soft-delete a task (from a list ⋯ menu) | Delete | (Sends to Trash. Not "delete forever".) |
| Move task to project (single) | Move to project… | Trailing ellipsis = opens a picker. |
| Move multiple selected tasks | Move to… | (When selection isn't all same type.) |
| Show completed (in project view toggle) | Show 6 completed | The number is dynamic; "Show <N> completed" template. |
| Hide completed | Hide completed | |
| Show keyboard shortcuts | View keyboard shortcuts | (In settings + ⌘K command palette.) |
| Switch theme to dark / light (command palette) | Switch theme to dark / Switch theme to light | (Two separate command entries, one per current theme.) |
| Toggle sidebar | Toggle sidebar | (Command palette; key `⌘\`.) |
| Add task on this day (calendar / day-detail popover) | Add task on this day | Imperative, locative. |
| Clear filters (filtered-down-to-nothing empty state) | Clear filters | |
| Discard unsaved changes (modal close guard) | Discard | (Destructive) |
| Keep editing (modal close guard cancel) | Keep editing | |
| Complete all (parent completion blocking confirm) | Complete all | |

---

## 5. Empty states

| View | Headline | Subline | Warm? |
|---|---|---|---|
| Today (regular — non-first-run) | Nothing due today. | You're caught up. Enjoy the day. | **\*** |
| Today (first-run) | Welcome to Tasko. | Add your first task above — type it and press Enter. | **\*\*** (both lines flourishes) |
| Tomorrow | Nothing scheduled for tomorrow. | Plan ahead — add a task. | |
| Next 7 Days | Nothing in the next seven days. | A quiet week. Or just unscheduled. | |
| Inbox | Inbox is clear. | Quick-add lands here when no project is picked. | |
| All | No active items. | Add a task or start a project. | |
| Completed | Nothing completed yet. | Done tasks land here. | |
| Trash | Trash is empty. | Deleted items land here. Restore or permanently delete from here. | |
| Per-project (flat) | No tasks in <Project> yet. | Add one above. | |
| Per-project (hierarchical) | No work in <Project> yet. | Add an Epic to start organizing, or a Task to keep it loose. | |
| Per-tag | No items tagged "<tag>". | Tag tasks in the Task modal to surface them here. | |
| Calendar (empty month) | No events this month. | Press N to create one on the focused day. | |
| Kanban (whole board empty) | No tasks here yet. | Drag from another project or add one. | |
| Kanban (per-column empty) | No items | (no subline — inline-tight space) | |
| Filtered-down-to-nothing | No matches. | Try removing a filter. | (CTA: Clear filters) |
| Trash filtered? (n/a in v1 — Trash has no filter chips) | — | — | |

The two warm flourishes are explicitly marked above (`*`). All other strings follow terse-neutral.

---

## 6. Confirmation prompts

### 6.1 Parent completion blocking

| Element | String |
|---|---|
| Title | Complete all children and continue? |
| Body | This task has <N> incomplete subtasks. Completing it will mark them all done. |
| Body (variant for Feature with incomplete Tasks) | This feature has <N> incomplete tasks. Completing it will mark them all done. |
| Body (variant for Epic with incomplete children) | This epic has <N> incomplete items. Completing it will mark them all done. |
| Cancel button | Cancel |
| Primary button | Complete all |

### 6.2 Soft-delete (single item)

| Element | String |
|---|---|
| Title | Move to Trash? |
| Body | "<Title>" will be moved to Trash. You can restore it later. |
| Cancel | Cancel |
| Primary | Move to Trash |

### 6.3 Soft-delete (parent with children)

| Element | String |
|---|---|
| Title | Move to Trash? |
| Body | "<Title>" and its <N> children will be moved to Trash. You can restore them later. |
| Primary | Move to Trash |

### 6.4 Permanent delete (single, from Trash)

| Element | String |
|---|---|
| Title | Permanently delete? |
| Body | This cannot be undone. |
| Cancel | Cancel |
| Primary | Delete forever |

### 6.5 Empty Trash

| Element | String |
|---|---|
| Title | Empty Trash? |
| Body | All <N> items in Trash will be permanently deleted. This cannot be undone. |
| Cancel | Cancel |
| Primary | Empty Trash |

### 6.6 Move all overdue to today

| Element | String |
|---|---|
| Title | Move <N> overdue items to today? |
| Body | Their due dates will be set to today. |
| Cancel | Cancel |
| Primary | Move all |

### 6.7 Unsaved changes guard (modal close)

| Element | String |
|---|---|
| Title | Discard changes? |
| Body | You have unsaved edits. |
| Cancel | Keep editing |
| Primary | Discard |

### 6.8 Delete folder (preserves projects)

| Element | String |
|---|---|
| Title | Delete folder "<name>"? |
| Body | Projects inside will move to no folder. |
| Cancel | Cancel |
| Primary | Delete folder |

### 6.9 Delete project (with tasks)

| Element | String |
|---|---|
| Title | Delete project "<name>"? |
| Body | <N> active items will be moved to Trash. |
| Cancel | Cancel |
| Primary | Delete project |

---

## 7. Snackbar variants

| Trigger | Snackbar text | Action button | Auto-dismiss |
|---|---|---|---|
| Task completed (non-recurring) | Task completed. | Undo | 5s |
| Task completed (recurring) | Task completed. Next: <Jul 1>. | Undo | 5s |
| Task reopened (from Completed or via Undo) | Task reopened. | — | 5s |
| Recurring instance reopened (from Completed; next instance kept) | Task reopened. Next instance kept. | — | 5s |
| Task moved to Trash | Task moved to Trash. | Undo | 5s |
| Task and N children moved to Trash | <Title> and <N> items moved to Trash. | Undo | 5s |
| Task restored from Trash | Task restored. | — | 5s |
| Task permanently deleted | Task permanently deleted. | — | 5s |
| Trash emptied | Trash emptied. <N> items deleted. | — | 5s |
| Bulk overdue moved to today | <N> items moved to today. | Undo | 5s |
| Multiple tasks moved to project | <N> tasks moved to <Project>. | Undo | 5s |
| Task rescheduled (date change) | Task rescheduled to <date>. | — | 5s |
| Task time changed | Time changed to <HH:MM>. | — | 5s |
| Task moved between Kanban columns | Status: <In Progress / Done / To Do>. | — | 5s |
| Multi-day task moved (drag in calendar) | Multi-day task moved. | Undo | 5s |
| Task moved to another parent (re-parent) | Task moved to <new parent>. | Undo | 5s |
| Project moved into folder | Project moved to <Folder>. | Undo | 5s |
| Project moved out of folder | Project moved out of <Folder>. | Undo | 5s |
| Folder deleted | Folder deleted. Projects moved to top level. | — | 5s |
| Depth-cap violation (drop blocked) | Can't move there: would exceed nesting depth. | — | 5s |
| Sync state — going offline | Offline. Changes are saved locally. | — | 5s |
| Sync state — back online (after offline period) | Back online. Syncing your changes. | — | 5s |
| Sync state — sync complete after offline period | Synced. | — | 3s |
| Sync error | Sync error. | Retry | 5s |
| Modal saved | (No snackbar — modal close + new row appearance is sufficient feedback.) | — | — |
| Filter applied | (No snackbar — filter chip visible + screen reader announcement covers it.) | — | — |

---

## 8. Tooltip text (icon-only controls + terse controls)

| Icon / Control | Tooltip text |
|---|---|
| Hamburger menu (mobile top bar) | Menu |
| Sidebar toggle (desktop hamburger) | Toggle sidebar (⌘\) |
| Quick-add input + button | Add task (N) |
| Sort dropdown trigger | Sort |
| Filter dropdown trigger | Filter |
| View toggle — List icon | List view |
| View toggle — Tree icon | Tree view |
| View toggle — Kanban icon | Kanban view |
| View toggle — Calendar icon (global) | Calendar |
| Row hover ⋯ icon | More actions |
| Row hover Open chevron | Open (O) |
| Row hover delete (in Trash view) | Delete forever |
| Row hover restore (in Trash view) | Restore |
| Tag chip X | Remove tag |
| Filter chip X | Remove filter |
| Snackbar dismiss X (when no Undo) | Dismiss |
| Modal close X | Close (Esc) |
| Sheet drag handle | Drag to dismiss |
| Calendar month chevron < | Previous month |
| Calendar month chevron > | Next month |
| Calendar week toggle | Week view |
| Calendar month toggle | Month view |
| Calendar "+N more" | View <N> more |
| Add Epic (in project tree) | Add Epic |
| Add Feature (in Epic hover) | Add Feature |
| Add Task (in Feature hover) | Add Task |
| Add Task in project (project-level button) | Add Task at project root |
| Tree row chevron (collapsed) | Expand |
| Tree row chevron (expanded) | Collapse |
| Move to picker (⋯ menu or shortcut) | Move to… (⌘⇧M) |
| Settings link in sidebar | Settings |
| Theme radio Light | Light |
| Theme radio Dark | Dark |
| Theme radio System | Match system theme |
| Week-start radio Sunday | Sunday |
| Week-start radio Monday | Monday |
| Sync indicator (synced) | Synced <relative time>. Click to refresh now. |
| Sync indicator (syncing) | Syncing… |
| Sync indicator (offline) | Offline. Changes saved locally. |
| Sync indicator (sync error) | Sync error. Click to retry. |
| Subtask checkbox in Task modal | Mark complete |
| Subtask drag handle in Task modal | Reorder |
| Subtask delete X in Task modal | Delete subtask |
| Recurrence icon on row | Recurring task |
| Time icon on row | <time> |
| Priority dot on row (no priority) | No priority |
| Priority dot on row (low) | Low priority |
| Priority dot on row (medium) | Medium priority |
| Priority dot on row (high) | High priority |
| Multi-day chip "Day N of M" | (no tooltip — text is self-explanatory) |
| Subtask progress chip "2/5" | 2 of 5 subtasks complete |
| Today indicator (calendar) | Today |
| Keyboard shortcut help icon (?) | Keyboard shortcuts (?) |
| Command palette trigger (⌘K) | Command palette (⌘K) |

---

## 9. Sort dropdown

| Position | String |
|---|---|
| Dropdown label (closed) | Sort: <current value> |
| Option (default) | Due date (earliest) |
| Option | Priority (high to low) |
| Option | Title (A–Z) |
| Option | Created (newest) |
| Trash sort default | Recently trashed |
| Completed sort default | Recently completed |

---

## 10. Filter chips

| Context | Label format |
|---|---|
| Project filter | Project: <Project name> |
| Tag filter | Tag: <tag name> |
| Priority filter | Priority: <level> |
| Status filter (in Kanban, post-v1) | Status: <level> |
| Clear-all indicator | Clear all |

---

## 11. Settings page

| Element | String |
|---|---|
| Page title | Settings |
| Section header (small, all-caps) | APPEARANCE |
| Section header | WEEK |
| Section header | ABOUT |
| Field label | Theme |
| Field label | Start of week |
| Radio Light | Light |
| Radio Dark | Dark |
| Radio System | System (default) |
| Radio Sunday | Sunday |
| Radio Monday | Monday (default) |
| About content | Tasko v1.0 · Local-first · Synced to cloud |
| About link | View keyboard shortcuts |

(No save button — settings auto-apply.)

---

## 12. Command palette

### 12.1 Palette chrome

| Element | String |
|---|---|
| Input placeholder | Type a command… |
| Section header (no query) | Recent |
| Section header | Navigate |
| Section header | Create |
| Section header | View |
| Section header | Settings |
| Empty results | No matching commands. Try a different word. |

### 12.2 Command list

| Command | Visible label | Shortcut hint |
|---|---|---|
| Navigate to Today | Go to Today | T |
| Navigate to Tomorrow | Go to Tomorrow | — |
| Navigate to Next 7 Days | Go to Next 7 Days | — |
| Navigate to Inbox | Go to Inbox | I |
| Navigate to Calendar | Go to Calendar | — |
| Navigate to All | Go to All | — |
| Navigate to Completed | Go to Completed | — |
| Navigate to Trash | Go to Trash | — |
| Navigate to a project (dynamically generated) | Go to <Project name> | — |
| Navigate to a tag (dynamically generated) | Go to #<tag name> | — |
| Add task | Add task | N |
| Add project | Add project | — |
| New folder | New folder | — |
| Add Epic in <current project, if hierarchical> | Add Epic in <project> | — |
| Add Feature (when in tree with focused Epic) | Add Feature under <Epic> | — |
| Add Task (when in tree with focused Feature) | Add Task under <Feature> | — |
| Toggle sidebar | Toggle sidebar | ⌘\ |
| Show / hide completed (in project view) | Show completed / Hide completed | — |
| Sort by priority | Sort by priority | — |
| Sort by due date | Sort by due date | — |
| Sort by title | Sort by title | — |
| Open settings | Settings | — |
| Switch theme (toggle) | Switch theme to dark / Switch theme to light | — |
| View keyboard shortcuts | View keyboard shortcuts | ? |
| Move to… (when single row focused) | Move <Title> to… | ⌘⇧M |

---

## 13. Keyboard shortcut help overlay (`?` panel)

Headings and entries — visible text in the overlay:

```
Keyboard shortcuts

NAVIGATE
  T          Today
  I          Inbox
  N          New task (quick-add)
  /          Focus quick-add input
  ⌘K         Command palette
  ⌘\         Toggle sidebar

ROW (when focused, no input active)
  ↑ ↓        Move focus
  Space      Toggle checkbox
  Enter / O  Open modal
  1–4        Set priority
  T          Schedule to today
  ⌘⇧M        Move to project…
  Backspace  Soft-delete

MODAL
  ⌘Enter / ⌘S    Save
  Esc            Cancel

CALENDAR
  ← →        Day
  ↑ ↓        Week
  PgUp/PgDn  Month
  T          Jump to today
  N          New task on focused day

GLOBAL
  ?          Show / hide this panel
```

---

## 14. Inbox-specific copy

| Context | String |
|---|---|
| Subline above row list when items present | <N> items waiting to be filed. |
| Subline when 0 items | (Empty state copy — see §5) |

---

## 15. All view copy

| Context | String |
|---|---|
| Subline above list | Showing <N> active items across all projects. |

---

## 16. Trash view copy

| Context | String |
|---|---|
| Subline above list | <N> items in Trash. Restored items return to their previous state. |
| Empty | Trash is empty. |
| Empty subline | Deleted items land here. Restore or permanently delete from here. |
| Empty Trash button (top-right) | Empty Trash |

---

## 17. Per-tag view copy

| Context | String |
|---|---|
| Subline | <N> items tagged "<tag>" across all projects. |

---

## 18. Per-project (flat) copy

| Context | String |
|---|---|
| Page title format | <Project name> (in <Folder name>) |
| Page title (no folder) | <Project name> |
| Group header — active items | Active (<N>) |
| Group header — completed (collapsed by default) | Show <N> completed |
| Group header — expanded | Hide completed |

---

## 19. Per-project (hierarchical) copy

| Context | String |
|---|---|
| Page title format | <Project name> (in <Folder name>) |
| Add Epic button (top of tree) | + Add Epic |
| Add Task at project root button | + Add Task in project |
| Loose-tasks divider label | Loose tasks in project (no Epic parent) |
| Rollup chip format on Epic/Feature | <N> / <M> | (e.g., "2/9") |

---

## 20. Today view copy

| Context | String |
|---|---|
| Page title | Today |
| Overdue strip header (when N overdue) | Overdue (<N>) |
| Today section header | Today |
| Today section subheader (date stamp) | <Day, Mon DD> | (e.g., "Wed, May 18") |
| Move all button | Move all overdue to today |

---

## 21. Next 7 Days copy

| Context | String |
|---|---|
| Page title | Next 7 Days |
| Day group header (today) | Today, <Day Mon DD> | (e.g., "Today, Wed May 18") |
| Day group header (tomorrow) | Tomorrow, <Day Mon DD> |
| Day group header (other) | <Day, Mon DD> |
| Day group with count | <Day, Mon DD>  (<N>) |
| Day group empty | <Day, Mon DD> — empty |

---

## 22. Tomorrow copy

| Context | String |
|---|---|
| Page title | Tomorrow |
| Section header | <Day, Mon DD> | (the literal next-day date) |

---

## 23. Completed view copy

| Context | String |
|---|---|
| Page title | Completed |
| Time-group header | Today |
| Time-group header | Yesterday |
| Time-group header | Earlier this week |
| Time-group header | Last week |
| Time-group header | Earlier this month |
| Time-group header | Earlier |
| Empty | Nothing completed yet. |
| Empty subline | Done tasks land here. |

(Sort default: Recently completed. Sort options: Recently completed, Title.)

---

## 24. Calendar view copy

| Context | String |
|---|---|
| Page title | Calendar |
| Month/year header (clickable) | <Month> <Year> | (e.g., "May 2026") |
| Today button (if surfaced; v1 ships keyboard `T` only) | Today |
| Month view toggle | Month |
| Week view toggle | Week |
| Week range header | <Mon DD> – <Mon DD>, <Year> | (e.g., "May 18 – May 24, 2026") |
| Filter label | Filter |
| "+N more" overflow | +<N> more |
| Day-detail popover title | <Day, Mon DD> |
| Day-detail subline | <N> items |
| Day-detail add | Add task on <Mon DD> | (e.g., "Add task on May 22") |
| Empty month | No events this month. |
| Empty month subline | Press N to create one on the focused day. |

---

## 25. Kanban view copy

| Context | String |
|---|---|
| Column 1 | To Do |
| Column 2 | In Progress |
| Column 3 | Done |
| Column header count | <column> (<N>) |
| Column add button | + |
| Done column overflow (after 50 items) | Showing recent 50, <[Show all]> |
| Per-column empty | No items |
| Whole board empty | No tasks here yet. |
| Whole board empty subline | Drag from another project or add one. |

---

## 26. Drag interactions copy (live region announcements; not visible text)

| Event | SR announcement |
|---|---|
| Drag start | Dragging "<Title>". Drop on a project, folder, or feature. |
| Hover over valid drop target | Drop on <target name>. |
| Hover over invalid drop target (depth cap) | Cannot drop on <target name>: would exceed nesting depth. |
| Drag cancel (Esc) | Drag cancelled. |
| Drop success | Dropped onto <target name>. |

---

## 27. Sync indicator labels (sidebar bottom)

| State | Visible label | SR announcement |
|---|---|---|
| Synced (just now / N min ago) | Synced just now | (same — `aria-label`) |
| Synced (N min ago) | Synced <N>m ago | Synced <N> minutes ago. |
| Syncing | Syncing… | Syncing in progress. |
| Offline | Offline | Offline. Changes are saved locally. |
| Sync error | Sync error. Retry | Sync error. Click to retry. |

---

## 28. Errors

### 28.1 Form validation errors

| Field | Empty / invalid | Length |
|---|---|---|
| Title | Add a title. | — |
| Due date | Pick a due date. | — |
| Project | Pick a project. | — |
| Start date (when later than due date) | Start date must be before due date. | — |
| Tag name | — | Tag names are limited to 32 characters. |
| Project name | Add a project name. | Project names are limited to 80 characters. |
| Folder name | Add a folder name. | Folder names are limited to 60 characters. |
| Subtask title | Add a title. | Subtask titles are limited to 200 characters. |

### 28.2 Operational errors

| Error | Message | Where shown |
|---|---|---|
| Sync failure (transient) | Sync error. | Snackbar (with Retry action). |
| Sync failure (persistent) | Sync error. Tap to retry. | Sync indicator + Snackbar if user-triggered. |
| Depth-cap violation (drag-drop) | Can't move there: would exceed nesting depth. | Snackbar (assertive). |
| Optimistic write failed (rollback) | Couldn't save. Try again. | Snackbar (assertive) + row briefly tints overdue-subtle. |
| Local storage unavailable | Tasko needs local storage to work. Check your browser settings. | Full-screen warning (no app shell until resolved). |
| Network unreachable (sync-only — local works) | (No error — sync indicator shows "Offline.") | Sync indicator. |
| Invalid date (e.g., user types "Feb 30" in free-text) | Pick a valid date. | Field helper error. |
| Recurrence — day of month overflow (e.g., monthly day 31 when month is Feb) | This recurrence will use the last day of the month when needed. | Helper text under the recurrence picker. (Informational, not an error.) |

---

## 29. ARIA labels (full long-form text for screen readers)

These are not visible strings but they are user-facing and shipped as content. Engineering must use these patterns.

| Element | aria-label pattern |
|---|---|
| Date chip (visible "Today") | <Day, Month DD, Year> | (e.g., "Wednesday, May 18, 2026") |
| Date chip (visible "Today" + accent treatment) | <Day, Month DD, Year> — today |
| Date chip overdue (visible "May 14 (4d)") | <Day, Month DD, Year>, <N> days overdue |
| Time chip (visible "09:00") | At nine AM | (or 24h equivalent) |
| Multi-day chip "Day 2 of 5" | Day <N> of <M> | (read literally; meaning is contextual) |
| Subtask progress "2/5" | <N> of <M> subtasks complete |
| Priority dot (none) | Priority: none |
| Priority dot (low) | Priority: low |
| Priority dot (medium) | Priority: medium |
| Priority dot (high) | Priority: high |
| Today indicator in calendar (the accent-filled circle on a day number) | Today, <Day, Month DD, Year> |
| Recurrence icon on row | Recurring |
| Task row complete (full row label format) | Task: "<Title>", priority <level>, due <date>, <N> tags<, recurring><, day <N> of <M>><, in <Project>> |
| Task row overdue | (above pattern) + ", overdue by <N> days" |
| Tree row Epic | Epic: "<Title>", <N> of <M> tasks complete |
| Tree row Feature | Feature: "<Title>", <N> of <M> tasks complete |
| Tree row Task | (use Task row label) |
| Kanban card | Task: "<Title>", priority <level>, status <column>, <N> tags<, due today><, due <date>><, overdue> |
| Sidebar item with count | <Label>, <N> items | (e.g., "Today, 5 items") |
| Sidebar Today with overdue | Today, <N> items, <O> overdue | (e.g., "Today, 5 items, 3 overdue") |
| Bottom nav tab | <Label> tab |
| Bottom nav center "+" | Add task |
| Bottom nav More | More options |

---

## 30. Localization notes (post-v1)

The strings here are English source. When translation comes (post-v1):

1. Avoid string interpolation that depends on English grammar (e.g., "<N> items" works in many languages but English-specific pluralization rules need locale-aware infrastructure).
2. Reserve max-width budgets in UI surfaces — German strings can be 40% longer than English; the Sidebar's `Next 7 Days` label is `Nächste 7 Tage` (~14 chars vs 11).
3. Date / time formats are locale-bound — don't hardcode "May 18, 2026" in non-English builds; use the platform's locale-aware date formatter.

---

## 31. Tone audit checklist

Before any string ships:

- [ ] Sentence case (unless explicitly noted, like section header all-caps "PROJECTS").
- [ ] No exclamation marks.
- [ ] No "please".
- [ ] No emoji.
- [ ] Imperative for CTAs.
- [ ] Specific number when applicable.
- [ ] Error messages give a path forward ("Try again", "Pick a date") rather than apologizing.
- [ ] Warmth restricted to the three locked flourishes.

If a string violates the above and there's no documented exception, it's a copy bug.
