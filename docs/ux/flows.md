---
title: Tasko — UX Flows
date: 2026-05-18
phase: ux
scope: project
status: draft
---

# Tasko — UX Flows

Concrete, step-by-step UX sequences for every load-bearing flow in v1. Wireframes for each surface live in `screens.md`; this doc focuses on the **sequence of actions and system responses**. Where a step references a screen or component, the cross-reference is implicit.

Conventions:
- **`>>>`** = user action.
- **`<<<`** = system response (visual or state).
- **`!!!`** = a branch / failure condition with its handling.

---

## 1. First-time use — welcome, first project, first task

**Pre-state**: Brand-new install. Local DB is empty (besides built-in Inbox). User is on desktop browser. Theme = System.

1. `>>>` User opens Tasko URL.
2. `<<<` App boots. Sidebar renders with: Today (0), Tomorrow (0), Next 7 Days (0), Inbox (0), All (0), Calendar, Completed, Trash (0), Settings. Projects section shows only Inbox under it. No user projects, no folders, no tags.
3. `<<<` Today view is the default landing. Empty state (first-run variant) renders:
   - Lucide `sunrise` icon, 48px.
   - "Welcome to Tasko."
   - "Add your first task above — type it and press Enter."
   - A small "↑ start here" hint anchored to the quick-add input.
4. `<<<` Quick-add input is auto-focused (cursor blinking in the input).

### Create first task

5. `>>>` User types "Buy laptop charger" in the quick-add input.
6. `>>>` User presses Enter.
7. `<<<` Task modal opens centered, with:
   - Title pre-filled to "Buy laptop charger".
   - Focus on the Due date field.
   - Project field empty (per §9.4 #8 — no auto-fill).
8. `>>>` User clicks the Due date picker, picks Today (May 18).
9. `<<<` Date chip updates to "Today, May 18".
10. `>>>` User clicks the Project picker, picks "Inbox".
11. `<<<` Project field shows "Inbox".
12. `>>>` User presses `⌘Enter` (Save).
13. `<<<` Modal closes (`motion-medium` fade + scale). The new task appears at the top of Today's list, animating in (`motion-medium` `ease-decelerate`).
14. `<<<` First-run empty state is replaced by the populated Today view.
15. `<<<` The "start here" pointer disappears.
16. `<<<` Sidebar updates: Today (1), Inbox (1), All (1).

### Create first project (hierarchical)

17. `>>>` User clicks the `+` next to "PROJECTS" section header in the sidebar.
18. `<<<` A small menu appears: "New project", "New folder".
19. `>>>` User picks "New project".
20. `<<<` New project modal opens. Name field is focused.
21. `>>>` User types "Q3 Launch", picks "No folder", flips the hierarchy toggle on.
22. `>>>` User clicks "Create project".
23. `<<<` Modal closes. Sidebar now shows "Q3 Launch" under "Inbox" in the Projects section.
24. `<<<` View navigates to the new project's Tree view, which is empty.
25. `<<<` Empty state for hierarchical project: "No work in Q3 Launch yet." subline: "Add an Epic to start organizing, or a Task to keep it loose." CTA: "+ Add Epic".

### First Epic / Feature / Task in the new project

26. `>>>` User clicks "+ Add Epic".
27. `<<<` Inline new-Epic row appears at the top of the tree, with the Epic glyph + an active text input.
28. `>>>` User types "Marketing site relaunch", presses Enter.
29. `<<<` Epic is created. Tree shows the new Epic, expanded by default. Hover-only "+ Add Feature" appears within the Epic.
30. `>>>` User hovers, clicks "+ Add Feature".
31. `<<<` Inline new-Feature row appears, indented under the Epic.
32. `>>>` User types "Hero section copy", Enter.
33. `<<<` Feature created and visible.
34. `>>>` User hovers Feature, clicks "+ Add Task".
35. `<<<` Inline new-Task row appears, indented under the Feature.
36. `>>>` User types "Draft hero copy", Enter.
37. `<<<` **Task modal opens** (because Tasks require a due date — quick inline doesn't suffice). Title pre-filled "Draft hero copy", focus on Due date. Project pre-filled to "Q3 Launch" since this is being created inside the project tree (this is **not** a contradiction with §9.4 #8; that resolution applies to the quick-add input on views like Today/Calendar, where the user is in "capture mode." In the project tree's own "+ Add Task" affordance, the user has explicitly named the destination already.)
38. `>>>` User picks date, Save.
39. `<<<` Task appears in the tree under its Feature.

**End state**: 2 tasks in the system (Buy laptop charger in Inbox; Draft hero copy in Q3 Launch / Marketing site relaunch / Hero section copy). Sidebar reflects: Today (2 — both due today), Inbox (1), Q3 Launch (1), All (2).

---

## 2. Daily flow — open → Today → triage overdue → complete → quick-add

**Pre-state**: Returning user. Has 8 tasks total (3 overdue, 5 due today, 2 multi-day in progress).

1. `>>>` User opens Tasko (or refreshes the tab).
2. `<<<` App boots. Today view renders with the layout shown in screens.md:
   - Overdue strip (3 items) at the top with "Move all overdue to today" Ghost button.
   - Today section (5 items, including the multi-day "Write conf talk" at Day 1 of 5).
3. `<<<` Sidebar shows Today (5) ·3 (the `·3` is the overdue sub-badge in amber).

### Triage overdue

4. `>>>` User reads the overdue list. Decides one item ("Pay electric bill") is now obsolete.
5. `>>>` User hovers row, clicks ⋯ menu → "Delete".
6. `<<<` Confirmation prompt (mini-modal): "Move 'Pay electric bill' to Trash?" — defaults to Cancel focus. User clicks "Move to Trash".
7. `<<<` Row fade-and-collapses. Snackbar "Task moved to Trash. Undo." appears for 5s.
8. `<<<` Overdue strip header updates to "Overdue (2)". Sidebar Today (4) ·2.
9. `>>>` User decides to reschedule "Send invoice" — clicks the date chip.
10. `<<<` Date picker popover opens, anchored to the chip.
11. `>>>` User picks Tomorrow.
12. `<<<` Popover closes. Row fade-and-collapses out of Today's overdue strip. Snackbar "Task rescheduled to tomorrow." (no undo for reschedule — it's reversible by editing).
13. `<<<` Today (3) ·1.
14. `>>>` For "Reschedule dentist", user decides to bulk-defer everything left. Clicks "Move all overdue to today".
15. `<<<` Confirmation prompt: "Move 1 overdue item to today?" — note count shows what remains, not the original count. User clicks "Move all".
16. `<<<` The remaining overdue item animates upward into the Today section (`motion-slow` `ease-standard` "fly to today"). Overdue strip disappears. Snackbar "1 item moved to today. Undo." for 5s.
17. `<<<` Today (3), no overdue badge.

### Complete tasks

18. `>>>` User scans Today. Clicks the checkbox on "Buy laptop charger".
19. `<<<` Strike-through draws across title (200ms), then row fades and collapses (300ms). Snackbar "Task completed. Undo." appears bottom-center for 5s. `aria-live` announces "Buy laptop charger completed. Undo available."
20. `<<<` Today (2).
21. `>>>` User repeats for "Reply to Alice" and "Take dog to vet".

### Quick-add a new task

22. `>>>` User presses `N` (single-key, since no input is focused).
23. `<<<` Focus moves to the quick-add input at the top.
24. `>>>` User types "Order birthday gift for Sam" and presses Enter.
25. `<<<` Task modal opens with title pre-filled, focus on Due date.
26. `>>>` User picks date (May 25), picks Project (Personal / Errands), sets priority Medium, picks the `#urgent` tag, presses `⌘Enter`.
27. `<<<` Modal closes. New task does NOT appear in Today (it's May 25, not today). Sidebar updates: All (8), Errands (4).

**End state**: 4 tasks done today, 1 task created for May 25. User closes laptop, day continues offline if device goes offline.

---

## 3. Weekly review — Inbox triage + Next 7 Days planning

**Pre-state**: User has accumulated 8 items in Inbox over the week. They want to file them.

1. `>>>` User opens Tasko. Clicks "Inbox" in the sidebar (or presses `I`).
2. `<<<` Inbox view renders with the "8 items waiting to be filed" subline + 8 rows.

### Triage one item at a time

3. `>>>` User clicks the first row "Investigate that podcast Alice mentioned" (anywhere on row except active controls).
4. `<<<` Task modal opens (Edit mode), all fields pre-filled.
5. `>>>` User picks Project = "Personal / Reading list", clicks Save.
6. `<<<` Modal closes. The item disappears from Inbox (it now belongs to Personal/Reading list).
7. `<<<` Inbox count drops to 7. Sidebar Personal/Reading list increases by 1.

### Bulk-select for a batch move

8. `>>>` User shift-clicks the next item, then ⌘-clicks 3 more (4 selected total).
9. `<<<` Each row gets the multi-selected treatment (bg=`accent-subtle`, 2px `accent` left-stripe). A toolbar slides in at the top of the view: "4 selected · Move to… · Delete · Cancel".
10. `>>>` User clicks "Move to…".
11. `<<<` A move-to picker opens (typeahead dropdown listing projects).
12. `>>>` User types "Read", selects "Reading list" from the suggestions.
13. `<<<` 4 items animate out of Inbox into the Reading list project. Snackbar "4 tasks moved to Reading list. Undo." for 5s.
14. `<<<` Inbox count drops to 3.

### Delete a stale item

15. `>>>` User looks at "Reschedule (test)" — clicks ⋯ → Delete.
16. `<<<` Confirmation: "Move this item to Trash?" → Confirm. Row collapses, snackbar "Task moved to Trash. Undo."

### Plan the next 7 days

17. `>>>` User clicks "Next 7 Days" in sidebar.
18. `<<<` Next 7 Days view renders, grouped by day.
19. `>>>` User notices "Submit expenses" on Saturday (May 21) is misplaced — should be Tuesday.
20. `>>>` User drags the row from Saturday's group up to Tuesday's group (drag-and-drop within Next 7 Days reorders/reschedules).
21. `<<<` During drag, a thin `accent` line indicates drop position. On drop, the row animates to its new position. Item's `due_date` is updated to Tuesday's date. Snackbar "Task rescheduled."
22. `<<<` Saturday's group decrements; Tuesday's group increments. Day-group counts update.

**End state**: Inbox down to 2 items (left for next week). User has 12 well-scheduled items across the next 7 days.

---

## 4. Multi-day work creation + lifecycle

**Pre-state**: User wants to create "Write conference talk" spanning Mon May 18 – Fri May 22.

### Day 1 — creation

1. `>>>` User presses `N` to open quick-add focused, types "Write conference talk", Enter.
2. `<<<` Task modal opens, focus on Due date.
3. `>>>` User clicks Start date field, picks Mon May 18.
4. `>>>` User clicks Due date field, picks Fri May 22.
5. `>>>` User picks Project = "Work / Side project", priority Medium, no tags, no time.
6. `>>>` Save.
7. `<<<` Modal closes. Task appears in Today (because Mon May 18 ≤ today ≤ Fri May 22 — today is May 18). Multi-day chip "Day 1 of 5" appears with `accent-subtle` start-day treatment.
8. `<<<` In Next 7 Days, the task appears on Mon, Tue, Wed, Thu, Fri — each with its own "Day N of 5" chip.
9. `<<<` In Calendar (month view), a continuous bar spans Mon-Fri across those 5 day cells.

### Day 2 — mid-span

10. `>>>` User opens Tasko the next morning (Tue May 19).
11. `<<<` Today view shows the task with chip "Day 2 of 5", neutral chip treatment (not start, not end).
12. `<<<` The user has not completed it. The task remains in active state.

### Day 5 — final day

13. `>>>` User opens Tasko on Fri May 22.
14. `<<<` Today shows the task with chip "Day 5 of 5", `accent-subtle` end-day treatment.
15. `>>>` User completes the work. Clicks checkbox.
16. `<<<` Strike-through, fade-collapse, snackbar "Task completed. Undo." Task disappears from Today, Calendar month-bar disappears, Next-7-Days group counts adjust.

### Branch: not completed by end of span

17. `!!!` If the user does not complete the task by May 22, on May 23 it becomes **overdue** and appears at the top of Today's Overdue strip with the standard overdue treatment.
18. `!!!` Multi-day chip is no longer shown for an overdue task — the overdue status is the dominant signal. The user can reschedule (via date chip) or complete.

### Branch: completed mid-span

19. `!!!` If user completes on May 20 (Wed, Day 3 of 5), the task is done. It disappears from May 20 onward. The Calendar month-bar truncates at May 19 (the actual span shrinks visually to Mon-Wed).
20. `!!!` Per spec §7.16, completing mid-span ends the task. It does not "stay open until May 22."

---

## 5. Hierarchical project — create + re-parent

**Pre-state**: Existing hierarchical project "Q3 Launch" with one Epic ("Marketing site relaunch") having 2 Features and a few Tasks.

### Add a second Epic

1. `>>>` User opens Q3 Launch project (Tree view).
2. `>>>` User clicks "+ Add Epic" at the top.
3. `<<<` Inline new-Epic row opens at the top.
4. `>>>` Types "Backend rewrite", Enter.
5. `<<<` Epic added.

### Add a Feature under it

6. `>>>` User hovers the new Epic, clicks "+ Add Feature".
7. `<<<` Inline new-Feature row appears indented.
8. `>>>` Types "Schema design", Enter.
9. `<<<` Feature added.

### Add Tasks (via the inline + with required modal)

10. `>>>` User hovers Feature, clicks "+ Add Task".
11. `<<<` Inline editable row appears for title, then opens the Task modal (since Tasks need a due date and other meta). Project pre-filled = Q3 Launch.
12. `>>>` Types "Draft entity model", picks date Today, Save.
13. `<<<` Task added under the Feature in the tree. Today view now shows this task too (because date = today).

### Add Subtask via Task modal

14. `>>>` User clicks the Task row to open its modal.
15. `<<<` Task modal opens in Edit mode. User expands "More" → Subtasks section visible.
16. `>>>` User clicks "+ Add subtask", types "Sketch ERD", Enter.
17. `<<<` Subtask row appears with empty checkbox. A new "+ Add subtask" row appears beneath, ready for the next.
18. `>>>` Adds two more: "Review with team", "Finalize and commit". Closes modal.
19. `<<<` Task row in the tree now shows a subtask progress chip `0/3`.

### Re-parent a Task

20. `>>>` User decides "Draft entity model" should live under a different Feature ("Migrations") — but Migrations doesn't exist yet.
21. `>>>` User hovers the "Backend rewrite" Epic, clicks "+ Add Feature", creates "Migrations".
22. `>>>` Now user moves "Draft entity model" from "Schema design" to "Migrations".

**Path A (drag-and-drop)**:
23a. `>>>` User drags the "Draft entity model" row.
24a. `<<<` Drag ghost follows pointer, original dims to 0.4. Drop targets highlight on hover: parent rows show dashed `accent` outline, collapsed nodes auto-expand after 300ms hover.
25a. `>>>` User hovers "Migrations" Feature.
26a. `<<<` "Migrations" highlights as drop target.
27a. `>>>` User releases.
28a. `<<<` Task animates into its new position under Migrations. `parent_id` updates. Snackbar "Task moved to Migrations. Undo." for 5s.

**Path B (move-to picker)**:
23b. `>>>` User selects the row, presses `⌘⇧M`.
24b. `<<<` Move-to picker opens with a typeahead input + list of valid destinations (filtered for depth-cap validity).
25b. `>>>` User types "Migr", picks "Backend rewrite / Migrations".
26b. `<<<` Same animation + snackbar.

### Depth-cap rejection

29. `!!!` If user tries to drop "Draft entity model" (Task type, leaf) onto a Task instead of a Feature, the drop is blocked: `overdue` outline + no-drop cursor. Releasing does nothing. Snackbar "Can't move there: would exceed nesting depth." (per microcopy doc).
30. `!!!` Same in the move-to picker — invalid destinations are disabled.

---

## 6. Recurring task lifecycle

**Pre-state**: User wants a recurring "Pay rent" task on the 1st of each month, with on_schedule anchor.

### Create the recurring task

1. `>>>` User quick-adds "Pay rent" → modal opens.
2. `>>>` User picks Due date = Jun 1.
3. `>>>` User picks Project = "Personal / Errands".
4. `>>>` User clicks the Recurrence dropdown (in "More" disclosure or visible if engineering chooses to keep it surfaced).
5. `<<<` Recurrence picker opens with options: Never, Daily, Every N days, Weekly, Monthly, Yearly + Anchor toggle.
6. `>>>` User picks "Monthly", day of month auto-defaults to Due date's day (1). Anchor = "On schedule".
7. `>>>` Save.
8. `<<<` Task is created with `due_date = Jun 1`, recurrence rule attached. A small `repeat` icon appears next to its title to indicate recurrence.

### Complete the recurring instance

9. `>>>` On Jun 1, user opens Tasko. Today view shows "Pay rent". User checks it off.
10. `<<<` Strike-through, fade-collapse. Snackbar "Task completed. Next: Jul 1." (extended snackbar variant — see microcopy doc).
11. `<<<` Under the hood:
    - Jun 1 instance: `status = done`, `completed_at` stamped, recurrence rule snapshotted.
    - New instance auto-generated: same title, recurrence rule attached, `due_date = Jul 1`.
12. `<<<` Sidebar Inbox / All counts reflect the change (one done, one new pending for Jul).
13. `<<<` Today no longer shows the task. The Jul 1 instance does not show in Today (it's not today).

### Un-check the completed instance

14. `>>>` User navigates to Completed view. Sees "Pay rent" with timestamp.
15. `>>>` User un-checks (clicks the green checkbox).
16. `<<<` Per spec §9.4 #5 (and §7.5), un-check **only reopens that instance**. The Jul 1 next-instance is **not** deleted.
17. `<<<` Snackbar "Task reopened. Next instance kept."
18. `<<<` Now there are 2 active instances: the original Jun 1 (now overdue if today > Jun 1), and Jul 1 (pending).
19. `!!!` User decides they don't want both. They navigate to the project view (Personal / Errands), find the Jul 1 instance, delete it.

### Every-N-days with after-completion anchor

20. `>>>` Separate flow: User creates "Water plants" with every-3-days, anchor = after_completion, Due date = today.
21. `>>>` User completes on Day 1.
22. `<<<` Next instance generated with `due_date = Day 4`.
23. `>>>` User doesn't complete on Day 4. On Day 5 they complete it (overdue completion).
24. `<<<` Next instance: `due_date = Day 8` (Day 5 + 3).

---

## 7. Overdue clearing — encountering 12 overdue + bulk + per-item reschedule

**Pre-state**: User returns from a 3-day trip. 12 overdue tasks. Today has 4 due-today items.

1. `>>>` User opens Tasko.
2. `<<<` Today view loads. Overdue strip shows "(12)" with "Move all overdue to today" button. Today section below shows 4 items.
3. `<<<` Sidebar Today (4) ·12 (the amber overdue pill is now showing 12, a big number — the design tolerates this gracefully via tabular numerals).

### Triage choice 1: bulk-move all (blunt)

4. `>>>` User clicks "Move all overdue to today".
5. `<<<` Confirmation: "Move 12 overdue items to today?" subline "Their due dates will be set to today." → Confirm.
6. `<<<` 12 rows animate upward into the Today section (`motion-slow` "fly to today"). Overdue strip vanishes. Today (16) ·0.
7. `<<<` Snackbar "12 items moved to today. Undo." for 5s.

### Triage choice 2: per-item — alternative path

8. `!!!` If the user instead wants to handle each individually:
9. `>>>` Click date chip on overdue row → date popover.
10. `>>>` Pick a new date (e.g., next Monday).
11. `<<<` Row collapses out of Overdue. Snackbar "Task rescheduled to Mon May 23."
12. `>>>` Repeat for each — slower but more deliberate.

### Triage choice 3: complete or delete during overdue

13. `!!!` User can check off an overdue item if they actually did it but forgot to mark. Behaves like normal completion + snackbar.
14. `!!!` User can delete an overdue item via ⋯ → Delete if it's no longer relevant. Confirmation → Trash.

---

## 8. Kanban use — open project → switch view → drag across columns

**Pre-state**: Existing project "Q3 Launch" (hierarchical) with 8 To Do, 3 In Progress, 12 Done Tasks. Other items (Epics, Features) are not in Kanban per §9.4 #1.

1. `>>>` User opens Q3 Launch project.
2. `<<<` Tree view renders (default for hierarchical).
3. `>>>` User clicks the Kanban icon (`columns-3`) in the view toggle.
4. `<<<` View switches to Kanban with 3 columns. `motion-base` `ease-standard` fade transition between views.
5. `<<<` Project remembers Kanban as last-chosen view for this project.

### Drag a card from To Do to In Progress

6. `>>>` User picks a card "Draft pricing tiers" in To Do.
7. `>>>` User drags it horizontally.
8. `<<<` Drag ghost follows, source dims to 0.2 + placeholder rectangle pulses.
9. `<<<` In Progress column body highlights with `accent-subtle` bg + dashed accent border.
10. `>>>` User releases over In Progress.
11. `<<<` Card animates to its position in In Progress (`motion-base` FLIP reflow). `status` mutates to `in_progress`. Sidebar counts unchanged (still belongs to same project). Snackbar "Status: In Progress" — neutral variant, no undo button (the user can just drag it back).

### Drag from In Progress to Done

12. `>>>` User drags another card to Done.
13. `<<<` Card moves to Done. `status = done`, `completed_at` stamped.
14. `<<<` If the task was recurring, the next instance auto-generates silently. Snackbar "Task completed. Undo."
15. `<<<` Today / Calendar / etc. update if the task had visibility there.

### Drag from Done back to To Do (reopen)

16. `>>>` User drags a Done card back to To Do (reopen).
17. `<<<` `status = todo`, `completed_at = null`. Card moves visually. Snackbar "Task reopened."

### Keyboard equivalent

18. `>>>` User keyboards focus to a card via Tab.
19. `>>>` Presses Right arrow.
20. `<<<` Card moves to next column (status mutates).

### Empty Done collapsed (post-v1 stretch)

21. `!!!` v1 ships without explicit Done-collapse; the column just scrolls. If Done has > 50 items, a footer "Showing recent 50, [Show all]" appears.

---

## 9. Calendar use — switch views → drag-reschedule → multi-day move

**Pre-state**: User has various tasks across a couple of weeks.

### Open calendar, switch views

1. `>>>` User clicks "Calendar" in sidebar (or presses the calendar shortcut).
2. `<<<` Calendar opens, default Month view, current month (May 2026).
3. `>>>` User clicks "Week" in the Month/Week toggle.
4. `<<<` Week view loads, showing this week (Mon May 18 – Sun May 24).

### Drag-reschedule (single day)

5. `>>>` User picks an event chip in Tuesday's cell.
6. `>>>` Drags it to Thursday's cell.
7. `<<<` During drag, Thursday cell highlights as drop target, its day-number becomes `accent`-filled.
8. `<<<` Tuesday's cell becomes empty visually (the source chip fades during the drag).
9. `>>>` User releases.
10. `<<<` Event re-anchors to Thursday. `due_date` updates. Snackbar "Task rescheduled to Thu May 21. Undo."
11. `<<<` If the task appears in Today or Next 7 Days, those views reflect the change on next render.

### Drag a multi-day span

12. `>>>` User picks the "Write conf talk" multi-day bar.
13. `>>>` Drags it to a new starting day.
14. `<<<` The whole bar follows the pointer as a single drag entity. Drop target shows the new starting cell.
15. `>>>` Releases.
16. `<<<` `start_date` and `due_date` both shift by the same delta (preserving span length). Bar redraws starting at the new day. Snackbar "Multi-day task moved. Undo."

### Time-edit in Week view (drag vertically)

17. `>>>` In Week view, user picks the 09:00 "Reply Alice" 30-min block.
18. `>>>` Drags it down to 11:00 within the same column.
19. `<<<` Block animates to new position. `due_time` updates to 11:00 (snap to 15-min). Snackbar "Time changed to 11:00."

### Click chip to edit

20. `>>>` User clicks a chip (not drag).
21. `<<<` Task modal opens.

### Add task on focused day

22. `>>>` User presses `N` while a day cell has keyboard focus.
23. `<<<` Quick-add modal opens with date pre-filled to that day. Project remains empty (per §9.4 #8 — Calendar is a view, the date context is allowed to flow but the project context is not).

### Filter

24. `>>>` User clicks "Filter ▾" → picks "Project: Work / Q3 Launch".
25. `<<<` Filter chip appears: `Project: Q3 Launch`. Only Q3 Launch tasks render in the calendar. Other tasks fade out / disappear.
26. `>>>` User clicks the chip's X to dismiss.
27. `<<<` Calendar returns to showing all tasks.

---

## 10. Completion + Trash — complete → undo → soft-delete → restore → empty

**Pre-state**: Today view with several tasks.

### Complete + undo via snackbar

1. `>>>` User checks "Reply to Alice".
2. `<<<` 200ms strike-through. 300ms fade-collapse. Snackbar "Task completed. Undo." appears for 5s.
3. `>>>` Within the 5s, user clicks "Undo" in the snackbar.
4. `<<<` Task reappears in its original position (instant — no animation reversal needed; the Undo is fast). `status` reverts to its previous value, `completed_at` cleared.

### Soft-delete via menu

5. `>>>` User hovers a row, clicks ⋯ → Delete.
6. `<<<` Confirmation: "Move 'Pricing call' to Trash?" → Confirm.
7. `<<<` Row fade-collapses. Snackbar "Task moved to Trash. Undo." 5s.
8. `<<<` Sidebar Today count decrements. Trash count increments.

### Restore from Trash

9. `>>>` User navigates to Trash.
10. `<<<` Trash view renders with "5 items in Trash."
11. `>>>` User clicks ↩ (Restore) on "Pricing call".
12. `<<<` Row fade-collapses out of Trash. Snackbar "Task restored."
13. `<<<` Task returns to wherever it was (Today, in this case). Sidebar Today increments. Trash count decrements.

### Empty Trash

14. `>>>` User clicks "Empty Trash" (Destructive button, top-right of Trash view).
15. `<<<` Confirmation: "Empty Trash? All 4 items in Trash will be permanently deleted. This cannot be undone." → Confirm.
16. `<<<` Trash view fades to empty state. Sidebar Trash count → 0.

### Branch: permanently delete a single item

17. `!!!` User clicks ✕ on a specific Trash row → Confirmation "Permanently delete this item? This cannot be undone." → Confirm → single-row removal.

### Branch: restore-with-children

18. `!!!` If the restored item was an Epic with descendants trashed alongside it, restoring brings them all back to their prior states (active or completed). Per spec §6.10 + §7.7.

---

## 11. Parent completion blocking

**Pre-state**: A Task with 3 subtasks (1 done, 2 todo).

1. `>>>` User clicks the parent Task's checkbox in any view (Today, project tree, Kanban).
2. `<<<` Confirmation prompt appears: "Complete all children and continue?" subline "This task has 2 incomplete subtasks. Completing it will mark them all done." Buttons: Cancel (focused) | Complete all.
3. `>>>` User picks Complete all.
4. `<<<` Parent Task and both incomplete subtasks all transition to `done` in one operation. Strike-through animation on the parent row. Snackbar "Task and 2 subtasks completed. Undo."
5. `>>>` (Alternative) User picks Cancel.
6. `<<<` Prompt closes. Nothing changes. Focus returns to the checkbox.

### Same flow at Feature level

7. `>>>` User checks a Feature's "completion" checkbox (Features can be marked done in v1 — the type label is loose).

Wait — does a Feature have a checkbox? Per the entity model (§4.3), all Items have `status`. Tree rows for Epics/Features show their type icon + rollup progress, **not** a checkbox. Per the locked decision, only Tasks show checkboxes in the tree row.

**Resolution**: Epic/Feature "completion" is **not user-toggleable via a checkbox in v1**. They are containers; their roll-up reflects their children's state. If the user truly wants to mark a Feature done with incomplete Tasks under it, they use the row's ⋯ menu → "Mark complete" — which triggers the same parent-completion-blocking prompt with all descendant Tasks listed.

This is consistent with the spec's intent (Epics/Features as containers) and with §9.4 #1 (Kanban shows only Tasks).

---

## 12. Folder management — create + drag projects in / out / between

**Pre-state**: User has 4 user-projects, all top-level (no folders yet).

### Create a folder

1. `>>>` User clicks the `+` next to "PROJECTS" sidebar header → "New folder".
2. `<<<` Inline editable folder row appears at the top of the Projects section.
3. `>>>` Types "Work", Enter.
4. `<<<` Folder created, empty.

### Drag a project into the folder

5. `>>>` User drags "Q3 Launch" project row.
6. `<<<` Drag ghost. As the pointer hovers over the "Work" folder header, the folder highlights with dashed accent outline. After 300ms hover, folder auto-expands (no children yet, so it just shows itself open).
7. `>>>` User releases inside the folder.
8. `<<<` "Q3 Launch" animates into the folder's child slot. `folder_id` updates. Snackbar "Project moved to Work. Undo."

### Drag a project to a different folder

9. `>>>` User creates a second folder "Personal".
10. `>>>` User drags "Errands" (currently top-level) onto "Personal".
11. `<<<` Same flow — drop, animation, snackbar.

### Move a project out of a folder

12. `>>>` User drags "Errands" out of "Personal" folder and into the **empty space between folders** (or below all folders, at the top-level area).
13. `<<<` A drop indicator line appears at the insert position. Release sets `folder_id = null`. Snackbar "Project moved out of Personal. Undo."

### Right-click alternative

14. `!!!` User right-clicks a project → "Move to folder…" → submenu lists existing folders + "No folder" + "New folder…". Picking creates / moves accordingly.

### Folder rename / delete

15. `>>>` User right-clicks "Personal" folder → "Rename folder".
16. `<<<` Folder header switches to inline edit.
17. `>>>` Types new name, Enter.
18. `<<<` Saved. Sidebar updates.
19. `>>>` User right-clicks → "Delete folder".
20. `<<<` Confirmation: "Delete folder 'Personal'? Projects inside will move to no folder." → Confirm.
21. `<<<` Folder vanishes. Projects inside become top-level. Snackbar "Folder deleted. Projects moved to top level."

---

## 13. Tag use — create via modal → apply to multiple → cross-project per-tag view

**Pre-state**: A task is being edited. No tags exist in the system yet.

### Create a tag via Task modal

1. `>>>` User opens a Task modal (any task).
2. `>>>` Clicks into the Tags field.
3. `<<<` Tag input is focused. Empty.
4. `>>>` Types "urgent".
5. `<<<` Autocomplete dropdown appears below input. No matches. Bottom row shows: "Create 'urgent'".
6. `>>>` Presses Enter.
7. `<<<` Tag is created. Chip "urgent" appears in the input. Cursor remains in input for adding more.
8. `>>>` Types "#waiting", Enter.
9. `<<<` Tag "waiting" created. Chip added.
10. `>>>` Save modal.
11. `<<<` Modal closes. Sidebar "TAGS" section now lists "# urgent (1)" and "# waiting (1)".

### Apply existing tag to another task

12. `>>>` User opens another Task modal.
13. `>>>` In Tags field, types "urg".
14. `<<<` Dropdown shows the existing "urgent" tag at the top.
15. `>>>` Presses Enter or clicks.
16. `<<<` Chip "urgent" added. (Existing tag, not a new one.)
17. `>>>` Save.
18. `<<<` Sidebar "# urgent (2)".

### View all tasks with a tag

19. `>>>` User clicks "# urgent" in the sidebar.
20. `<<<` Navigates to Per-tag view. Subline "2 items tagged 'urgent' across all projects." Two rows shown, each with their project breadcrumb.

### Tag chip on a row navigates to per-tag view

21. `>>>` From any list view (Today, Inbox), user clicks an inline tag chip like `#urgent` on a row.
22. `<<<` Navigates to Per-tag view for "urgent".

### Tag autocomplete edge: existing tag with different casing

23. `!!!` User types "URGENT" in a new Tag input. Autocomplete matches "urgent" (case-insensitive) and shows it as a suggestion. Selecting attaches the existing tag — does NOT create a duplicate. The chip displays in the original casing "urgent".

### Tag limit / no tag-management UI in v1

24. `!!!` Per spec §4.5 and §5.2, tag rename / delete / merge is post-v1. The "# urgent" tag cannot be renamed in v1. If the user typos a tag, they live with it (or stop using it — orphaned tags vanish from the sidebar).

---

## 14. Settings change — theme + week-start

**Pre-state**: User on Today view. Default settings (Theme = System, Week start = Monday).

1. `>>>` User clicks "Settings" in sidebar (or presses `,` if engineering binds it; otherwise via ⌘K).
2. `<<<` Settings view renders.

### Change theme

3. `>>>` User clicks the "Dark" radio.
4. `<<<` Theme switches **immediately** to Dark. The entire app re-paints with dark tokens, `motion-fast` crossfade. No save button needed — settings are auto-applied.

### Change week-start

5. `>>>` User clicks "Sunday" radio under Week section.
6. `<<<` Week start changes. Calendar (if visible later) starts on Sunday.

### Return to Today

7. `>>>` User clicks Today in sidebar.
8. `<<<` Today view renders, all in dark theme.

### System theme behavior

9. `!!!` If user picks "System" and their OS is in light mode, the app is light. If they then change OS to dark, the app auto-switches without a refresh (listening to `prefers-color-scheme` media query).

---

## 15. Mobile day — open phone → swipe-to-complete → swipe-drawer → modal-sheet edit

**Pre-state**: User on phone (mobile browser) opening Tasko after morning coffee.

1. `>>>` User taps the Tasko bookmark.
2. `<<<` App loads. Today view (mobile layout) renders. Bottom nav visible: Today (selected), Calendar, ⊕ Add, Inbox, More.

### Swipe-to-complete

3. `>>>` User swipes right on a row "Take vitamins".
4. `<<<` Row strikes through, fades, and collapses. Snackbar "Task completed. Undo." appears above bottom nav for 5s.

### Swipe-to-action drawer

5. `>>>` User swipes left on a row "Pay electric bill" (overdue).
6. `<<<` A drawer reveals from the right edge: [Schedule] [Delete] buttons.
7. `>>>` User taps "Schedule".
8. `<<<` Drawer slides closed. A bottom sheet opens with a date picker.
9. `>>>` User picks "Tomorrow" via the quick-select row.
10. `<<<` Sheet closes. Row collapses out of Overdue (it's now scheduled to tomorrow, not today). Snackbar "Task rescheduled to tomorrow."

### Edit via modal-sheet

11. `>>>` User taps a row "Pricing call" (mid-row, not on the swipe gestures).
12. `<<<` Task modal opens as a bottom sheet, sliding up.
13. `>>>` User changes priority to High (taps the High pill).
14. `>>>` User adds a note in the Notes field.
15. `>>>` Taps Save.
16. `<<<` Sheet slides down and closes. Row in Today now shows the High priority dot (larger, red).

### Use the quick-add center tab

17. `>>>` User taps ⊕ in bottom nav.
18. `<<<` A small input sheet slides up with a single text input and a "Next" button (collapsed mobile-quick-add).
19. `>>>` User types "Order book", taps Next.
20. `<<<` Full task creation sheet opens with title pre-filled, focus on Due date. Same as desktop modal but as a sheet.

### Long-press to multi-select

21. `>>>` User long-presses (300ms+) on a row.
22. `<<<` Row enters selected state. Other rows show checkboxes on their left side. A top-bar slides in: "1 selected · ⋯".
23. `>>>` User taps a second row to add to selection.
24. `>>>` User taps "⋯" → "Move to project…" → picks a project.
25. `<<<` Both rows animate out (they no longer belong to this view's project context, or stay if the view is All). Snackbar "2 tasks moved. Undo."

### Pull-not-for-refresh

26. `!!!` Per locked decision: v1 mobile **does not** support pull-to-refresh. Sync happens automatically in the background. If the user pulls down, nothing happens (the gesture is suppressed at the app surface so it doesn't trigger browser refresh either).
