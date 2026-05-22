# Decision Log

> Record significant decisions with rationale. Each entry should be self-contained — a future reader should understand both what was decided and why without needing additional context.

## Format

```
## YYYY-MM-DD — [Decision title]

**Phase:** [phase name]

**Decision:** [What was decided]

**Rationale:** [Why this option was chosen — what trade-offs were considered, what alternatives were rejected and why]

**Consequences:** [What this enables, constrains, or commits the project to]
```

---

## 2026-05-18 — Visual personality: minimalist with a hint of warmth

**Phase:** ux

**Decision:** Tasko's visual language is minimalist (in the Linear / Notion / Things 3 lineage) with a single warm accent. Slightly rounded corners (6-8px), single warm accent color (amber), type-led hierarchy, generous whitespace, "calm-not-cold."

**Rationale:** The target user values a clean, fast, predictable interface (per brainstorm §2). The product is a daily-driver task tool, used every morning — a personality that feels heavy or playful would wear thin. Amber as a warm accent humanizes the otherwise neutral palette without making the product feel decorative. Alternatives considered: a colder Linear-pure aesthetic (rejected: too austere for a personal tool the user opens with their morning coffee), a more decorative Notion-like approach (rejected: clutters the row-dense list views Tasko depends on).

**Consequences:** All surfaces inherit the minimalist baseline. Amber is the only accent — status colors (red overdue, blue in-progress, green done) are reserved for specific semantic roles and never used decoratively. Component styling commits to subtle elevation and minimal chrome.

---

## 2026-05-18 — True light/dark mode parity, system as default

**Phase:** ux

**Decision:** Light and dark modes are first-class. Every semantic token is defined as a light/dark pair. System (matching OS theme) is the default. No "auto-switch by time of day" or other heuristics.

**Rationale:** A nontrivial fraction of users live in dark mode permanently; deferring dark mode to "phase 2" is a well-known anti-pattern. Defining tokens semantically (rather than hex literals scattered through components) keeps both modes maintainable from day one. System default respects user OS preference without requiring an explicit choice.

**Consequences:** Every component spec includes both light and dark visual treatments. Engineering must implement a token-aware theming layer. Contrast verification (WCAG AA) is required for both modes; both modes are equally tested.

---

## 2026-05-18 — Cozy desktop density (~38-40px task rows), comfortable mobile (~44px), no user toggle

**Phase:** ux

**Decision:** Single density per form factor. Desktop task rows are 38-40px ("cozy"); mobile rows are 44px ("comfortable"). No user-facing density toggle in v1.

**Rationale:** Density toggles are a defer-the-decision anti-pattern. Pick the density that serves the daily-use case: cozy desktop maximizes the number of visible Today/Inbox items without cramping; mobile 44px hits the WCAG touch-target minimum. A user toggle introduces a permutation matrix engineering and design must support.

**Consequences:** All row-based components honor these row heights. v1.1 may introduce a density setting; until then, the cozy/comfortable baseline is final.

---

## 2026-05-18 — Lucide as the only icon library, 1.5px stroke, 24/20/16 sizes

**Phase:** ux

**Decision:** Use Lucide (MIT licensed) exclusively. Default stroke 1.5px. Three size tiers: 24px (hero/nav), 20px (row controls), 16px (inline).

**Rationale:** Mixing icon libraries fragments the visual language. Lucide is broad, maintained, and matches the minimalist personality. Item-type icons (`layers` Epic, `layout-grid` Feature, `square-check-big` Task, `corner-down-right` Subtask) are load-bearing — they distinguish hierarchy without relying on color.

**Consequences:** Item type is communicated by glyph (color-independent), satisfying WCAG 1.4.1. Engineering must inline or tree-shake Lucide for performance. Replacing an icon downstream requires updating the design-language doc.

---

## 2026-05-18 — Amber as the single accent color

**Phase:** ux

**Decision:** Amber is the only accent. Light mode: `#D97706` (amber-600). Dark mode: `#F59E0B` (amber-500). Overdue uses red sparingly (`#DC2626` light, `#EF4444` dark). Blue is reserved for the "in_progress" status only.

**Rationale:** A single accent reduces decision fatigue and visual noise. Amber feels warmer than blue / purple / teal options without slipping into casual or playful territory. The contrast pair `text-on-accent #FFFFFF` on `accent #D97706` measures 4.65:1 — passes AA for non-text and for the specific case of large/bold button labels.

**Consequences:** Designers and engineers cannot introduce a second accent for v1 without revisiting this decision. All "primary" affordances draw from amber. Status colors are siloed to their semantic roles (red = overdue/destructive, blue = in_progress, green = done/success).

---

## 2026-05-18 — Hybrid keyboard shortcuts: single-key context + ⌘-modifier global

**Phase:** ux

**Decision:** Single-key shortcuts (`T`, `I`, `N`, `O`, `/`, `?`, `1-4`, etc.) when no input is focused. ⌘-modifier shortcuts always available (`⌘K` palette, `⌘\` sidebar, `⌘Enter` save, `⌘⇧M` move-to). The command palette (`⌘K`) is the discoverability story — there is no global search in v1.

**Rationale:** Power users expect Linear-style single-key navigation when their hands are on the keyboard outside an input. Mode-sensitivity (suppression while typing) prevents accidental triggers. The command palette gives a discoverable surface for every action, mitigating the lack of global search.

**Consequences:** Every action must be reachable via either single-key, ⌘-combo, or the command palette. Engineering needs a centralized shortcut registry. `⌘F` is a deliberate no-op-with-toast ("Use ⌘K to navigate.").

---

## 2026-05-18 — Inline editing default; modal for full surface

**Phase:** ux

**Decision:** Linear / Things-style inline editing. Click on title → inline edit. Click date chip → date popover. Click priority dot → priority menu. Click tag chip → navigate (edit tags via ⋯ → Edit tags). Click anywhere else on row → open modal. Modal opens via `O`, hover chevron, or right-click "Open."

**Rationale:** Most edits are single-field. Forcing a modal for every change is high friction and disrupts the list-scanning flow that makes Today views useful. Reserve the modal for: creating new tasks (where field count is high), editing markdown notes, configuring recurrence, managing subtasks.

**Consequences:** Each editable field needs a click target + inline popover. Engineering implements per-field popovers (Date, Time, Priority, Tag) that share a base popover primitive.

---

## 2026-05-18 — Today completion animation: 200ms strike-through → 300ms fade-collapse → 5s undo snackbar

**Phase:** ux

**Decision:** When a task is checked off in Today (and similar list views), the row strikes through over 200ms, then fades and collapses (~300ms), then a bottom-anchored snackbar "Task completed. Undo." appears for 5 seconds. Reuse this pattern for soft-delete, bulk-overdue move, parent-completion, restore.

**Rationale:** The animation signals causality (the check did this) and gives the user a forgiving 5-second window to undo. Snackbar is non-focus-stealing and non-modal. The sequence is deliberately calm — no celebration, no confetti, no sound.

**Consequences:** Every reversible row action follows the same pattern. The snackbar component supports a uniform variant catalog. Reduced motion suppresses the strike-through draw and the slide-up animation but keeps the snackbar functional (opacity-only).

---

## 2026-05-18 — Kanban shows only Tasks (no Epics/Features as cards)

**Phase:** ux

**Decision:** Per-project Kanban shows only `type = task` items. Epics and Features (containers) and Subtasks do not appear as cards. Subtasks remain inside their parent Task's modal; Epics and Features remain visible only in the Tree view.

**Rationale:** Kanban is a status-flow view for work units. Containers (Epics, Features) are organizational, not work units — they have no meaningful "In Progress" state outside of their children's progress. Mixing containers and tasks would clutter the board and break the mental model.

**Consequences:** The view toggle for a hierarchical project is **Tree ↔ Kanban**. Engineering filters by `type = task` when rendering Kanban. This is binding per §9.4 #1.

---

## 2026-05-18 — Calendar is a global view with optional filter chips

**Phase:** ux

**Decision:** Calendar is a top-level navigation destination in the sidebar (not per-project). Optional filter chips at the top let the user narrow by project or tag, session-only (consistent with per-view filter convention).

**Rationale:** A user's daily life crosses projects — looking only at one project's calendar misses errands, multi-day work, recurring habits. Global calendar with optional filters honors both the cross-cutting view and the per-project drill-down. Session-only filters keep the simple default behavior obvious.

**Consequences:** No per-project calendar view in v1. The calendar surface is rendered once, globally, with project/tag filters as session state.

---

## 2026-05-18 — Tags via dedicated modal field; `#tag` in title is literal text

**Phase:** ux

**Decision:** Tags are added via a chip-style multi-select field in the Task modal with autocomplete. The leading `#` in input is optional (`urgent` and `#urgent` resolve to the same tag). `#tag` typed inside the title field is literal text, not parsed as a tag.

**Rationale:** NLP parsing in the title field is unreliable and visually noisy (the `#` in the title makes the title look messy in lists). A dedicated field is explicit, learnable, and accessible. Autocomplete prevents typo-fragmentation of the tag namespace.

**Consequences:** No quick-add inline tag syntax in v1. The Tag input component must support both `urgent` and `#urgent` inputs and de-duplicate case-insensitively. Tag chips on rows are clickable to navigate to the per-tag view.

---

## 2026-05-18 — Today is strictly date-driven; status field does not affect inclusion

**Phase:** ux

**Decision:** Today view shows items whose due_date is today OR whose start_date ≤ today ≤ due_date (multi-day span). Items with `status = in_progress` but a future due_date do NOT surface in Today.

**Rationale:** The Today view's commitment is "this is what's due today, plus what's overdue." Mixing in items based on status would fragment that contract — an in_progress item scheduled for next week is not what "today" means.

**Consequences:** In-progress items live in their project's Kanban / tree view + Calendar; they appear in Today only if their date falls today. Sidebar Today count uses the same date-only rule.

---

## 2026-05-18 — Quick-add never auto-fills the Project field

**Phase:** ux

**Decision:** Removed any "default project" setting. Quick-add modal always opens with the Project field empty, requiring the user to pick Inbox or a project before saving. This is true on Today, on per-project views, on Calendar, on per-tag — no view context pre-fills Project.

**Rationale:** Auto-fill from view context creates a hidden state the user must mentally track. Explicit picking takes one extra click but eliminates the "wait, why is this in the wrong project?" surprise. This was the team's biggest reversal during round-3 interrogation — and it stuck.

**Consequences:** Exception: when the user clicks "+ Add Task" on a Feature inside a project tree, the project IS pre-filled (the user explicitly navigated into that destination). The quick-add bar at the top of any view does not pre-fill, ever. Engineering enforces this via the modal's open-context contract.

---

## 2026-05-18 — Re-parenting: both drag-and-drop AND move-to picker

**Phase:** ux

**Decision:** Tasks (and Features, within their project) can be re-parented via two mechanisms: drag-and-drop (with depth-cap validation and hover-300ms-expand for collapsed nodes), and the move-to picker (`⌘⇧M`, typeahead). Mobile drag is deferred — mobile uses the picker only.

**Rationale:** Drag is fast for proximate moves; the picker is fast for distant moves and works for keyboard-only users. Supporting both is the common Linear / Things 3 pattern. The depth-cap (4 levels max) is enforced visually and via picker filtering.

**Consequences:** Two code paths to implement. Drag-and-drop on touch is deferred unless cheap to ship. Depth-cap rejection uses a snackbar (assertive) "Can't move there: would exceed nesting depth."

---

## 2026-05-18 — Three warm flourishes; everywhere else terse-neutral

**Phase:** ux

**Decision:** Microcopy voice is terse-neutral (Linear / Things 3 norm). Three specifically marked warm flourishes:
  1. Today empty (regular): "You're caught up. Enjoy the day."
  2. First-run welcome headline: "Welcome to Tasko."
  3. First-run welcome subline: "Add your first task above — type it and press Enter."

**Rationale:** A purely cold tone reads as engineering-first; a uniformly warm tone reads as marketing copy. Bracketing warmth to two specific moments (the daily zero-state and the first-ever open) honors the "calm-not-cold" personality without trickling chattiness through every error message.

**Consequences:** All other strings (error messages, confirmation prompts, tooltips, button labels) follow terse-neutral. The microcopy doc's tone audit checklist gates any future copy contributions.

---

## 2026-05-18 — WCAG 2.1 AA is the floor; documented exceptions only

**Phase:** ux

**Decision:** WCAG 2.1 Level AA is the compliance commitment for v1. Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and non-text UI. Every place color carries meaning has a non-color alternative (glyph, size, label). Reduced-motion override is applied. Mobile touch targets ≥ 44x44px.

**Rationale:** A daily-use task tool is load-bearing software for users with vision, motor, and cognitive accessibility needs. AA is well-understood, audit-able, and matches industry expectations for productivity tools. AAA is honored where it doesn't cost the design.

**Consequences:** Every component, screen, and state must pass the AA bar. The reviewer phase validates accessibility as a release gate. The single documented contrast exception (priority-medium amber dot at 2.9:1 light) is mitigated by dot-size and ARIA-label redundancy.

---

## 2026-05-18 — Two-process architecture: local Node service + browser UI; JSON files on disk

**Phase:** engineering

**Decision:** Tasko is two processes glued by HTTP on `127.0.0.1`. A Node.js + Fastify service owns a directory of one-file-per-entity JSON files (items, projects, folders, tags, plus a config.json and a trash/ directory) and exposes a REST API. A React 19 + Vite SPA runs in the user's regular browser and talks to that API. The data directory is git-friendly by design — but Tasko itself does NOT know git. The user runs `git pull / git push` manually in their terminal as a side activity. Single-machine v1.

**Rationale:** The user's locked product decisions required (a) a backup story that's git-compatible (excludes a single SQLite blob and IndexedDB), (b) no auth / no accounts (excludes a cloud sync service), (c) data the user can trust (excludes a black-box format). A per-entity JSON tree maximizes git-merge friendliness; running our own local Node service avoids browser-only fs limitations (File System Access API is Chromium-only). Alternatives explicitly considered and rejected in `docs/engineering/2026-05-18-architecture-exploration.md`: pure-browser IndexedDB, embedded SQLite, Electron/Tauri shell, file:// URLs.

**Consequences:** v1 ships as source distribution; user runs `pnpm start`, opens `http://127.0.0.1:7373`. No installer, no auto-start in v1. Multi-machine sync is whatever git provides (manual). No conflict resolution UI in v1 (locked). v1.1+ could add a Tauri shell, sync engine, or CLI for autostart.

---

## 2026-05-18 — Stack: TypeScript strict, pnpm workspaces, Fastify, React 19 + Vite, TanStack Query/Router, Zustand, zod, ULID

**Phase:** engineering

**Decision:** TypeScript with `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` everywhere. pnpm workspaces with three packages: `apps/server`, `apps/web`, `packages/types`. Server: Fastify 5, zod for schema validation (shared with the frontend), ULID for IDs, `fs/promises` with atomic-write (tmp + rename), Vitest + Biome. Frontend: React 19, Vite, TanStack Query (server state) + TanStack Router (typed routes + typed search params) + Zustand (client UI state), CSS Modules + CSS custom properties for tokens, Lucide for icons, `@dnd-kit` for drag-and-drop, `cmdk` for command palette, `react-day-picker` for date picker, `marked` + `DOMPurify` for markdown render with plain `<textarea>` + custom keybindings for editing, `@tanstack/react-virtual` for conditional virtualization at 200+ rows. Vitest + Playwright (desktop only) + Biome.

**Rationale:** Zod is the single schema source: request bodies, on-disk file contents, response types, and TypeScript types all derive from `packages/types`. The frontend trio (Query + Router + Zustand) is the smallest viable surface for our state model. Plain textarea + marked is locked over CodeMirror/ProseMirror — ~150 LOC of keybindings vs ~250kB of editor. Each pick has a one-line rejection of its main alternative documented in `docs/engineering/2026-05-18-architecture.md` §1.

**Consequences:** Dependency budget capped at ~35 runtime packages. Biome replaces ESLint + Prettier; one config, ~10× faster. Tests are Vitest both sides; E2E is Playwright. Mobile-emulation tests deferred to v1.1.

---

## 2026-05-18 — Data layout: one JSON file per entity, soft-delete by moving to trash/

**Phase:** engineering

**Decision:** The data directory contains: `config.json`, `items/<ulid>.json` (Tasks, Features, Epics; subtasks are inlined arrays on their parent Task), `projects/<ulid>.json` (Inbox is a sentinel project with id `00000000000000000000INBOX0`), `folders/<ulid>.json`, `tags/<ulid>.json`, and `trash/<ulid>.json`. Soft-delete MOVES a file from `items/` to `trash/` (not flag-in-place). Each entity has `schema_version: 1`. The server keeps an in-memory index built on boot; all reads served from memory; all writes are atomic (tmp file + rename) and gated by a single-writer mutex.

**Rationale:** Per-entity files maximize git-merge friendliness; subtasks inlined because they have no independent lifecycle per the product spec. Move-on-trash means `items/` listing equals "active items" (no scan-and-filter on every read), the on-disk path encodes user mental model, and restore is a reverse move. The in-memory index is comfortable up to ~10k items at < 1.5s boot; v1.1+ may add a SQLite-backed derived cache if scale demands it (migration path documented).

**Consequences:** Single mutex on writes prevents corruption. Atomic writes survive process kill. JSON 2-space indent for git diff readability. No DB migration tooling in v1; `schema_version` allows future forward-only migrations. Subtask edits write the parent Item file (acceptable; subtask churn is bounded). Cross-project moves cascade `project_id` updates atomically.

---

## 2026-05-18 — Recurrence: pure function with anchor-mode + multi-day span preservation

**Phase:** engineering

**Decision:** Recurrence rule is a discriminated union by `frequency` (daily / every_n_days / weekly / monthly / yearly) with an `anchor_mode` of `on_schedule` (next due is previous due + delta) or `after_completion` (next due is completion + delta). Multi-day spans preserve `due - start` delta across recurrence. Next-instance generation happens server-side as a single atomic op (within the writer mutex) on the completion request — the response is `{ completed, next }` and both are written to disk before the lock releases. Un-checking a completed recurring instance reopens only that instance; the next instance is preserved (per product spec §9.4 #5).

**Rationale:** Pure functions in `domain/recurrence.ts` test cleanly (~80 cases planned, covering each frequency × anchor × edge case including Feb 31 → Feb 28, mid-cycle edits, overdue completions). The atomic op prevents "phantom states" if the process is killed mid-write. Multi-day-span preservation matches the spec's commitment and the calendar UX.

**Consequences:** Recurrence is the single highest-test-surface module in v1. Off-by-one or anchor confusion ruins user trust. The 80-test suite is a v1 release gate. The frontend handles the `{ completed, next }` response shape and surfaces "Task completed. Next: <date>." snackbar with undo. Undo reverses both the completion and the auto-generated instance.

---

## 2026-05-18 — Loose hierarchy typing with hard 4-level depth cap; subtasks attach only to Tasks

**Phase:** engineering

**Decision:** Items have a `type` field {`epic`, `feature`, `task`} that drives icon + display behavior but does NOT strictly enforce parent-child relationships. The only schema-enforced rule: subtasks attach only to `type=task` items (and are inlined on the parent Item, not their own files). The 4-level depth cap (Epic → Feature → Task → Subtask = 4) is enforced via a `canMove` predicate in `domain/depth-cap.ts` (server, authoritative) mirrored as `canMoveClient` in `lib/depth-cap-client.ts` (frontend, for instant drag/picker feedback). The server check is the source of truth.

**Rationale:** Strict type enforcement would prevent "loose tasks at project root" and "Feature without an Epic," both supported by the product spec. The depth cap is the actual constraint; the type field is the UX hint. Centralizing the predicate in a single function avoids missed enforcement paths (drag, picker, REST POST, REST PATCH parent change, bulk move).

**Consequences:** Every mutation that changes `parent_id` MUST call `canMove`. E2E tests attempt each invalid path. The cycle check (placing an item under its own descendant) lives in the same predicate. The depth-cap is a hard wall; the UI hides "+ Add child" affordances where the resulting nesting would exceed it.

---

## 2026-05-18 — SSE for self-confirmed writes (multi-tab consistency); no filesystem watching for external changes

**Phase:** engineering

**Decision:** Ship a server-sent-events stream at `GET /api/events`. Every server-side write broadcasts the post-write event to all subscribed tabs; receiving tabs check the `source` field (self vs other-tab) and invalidate TanStack Query caches as needed. This makes two browser tabs on the same machine eventually consistent without a stale-snackbar UX. We do NOT use chokidar to detect external file changes — if the user runs `git pull` and files change on disk, Tasko does NOT auto-detect. The user manually refreshes the browser.

**Rationale:** The multi-tab case is a real, frequent scenario; "refetch on focus" works but feels slightly behind. SSE costs ~110 LOC total. External file watching adds a "cache coherence with the filesystem" surface we don't want (the server's index becomes mutable from outside its own writes). Manual refresh is acceptable per the locked decision that the user owns the git lifecycle.

**Consequences:** Each tab generates a tab-id on load, sends it on every request, and receives it back in the SSE event for self/other-tab discrimination. EventSource auto-reconnects on disconnect; on reconnect, the frontend refetches all stale queries. If SSE proves flaky, drop and rely solely on `refetchOnWindowFocus: true` (already wired as fallback).

---

## 2026-05-18 — Sync state indicator (UX §42) DROPPED in v1; replaced by static footer

**Phase:** engineering

**Decision:** The sidebar's bottom "sync state" indicator component (UX `component-inventory.md` §42, with "Synced / Syncing / Offline / Sync error" variants) is NOT built in v1 because there is no sync. The same screen real estate becomes a static `Tasko v1.0 · Local files in <data-dir>` footer. The sync-related snackbars (microcopy §27 "Synced", "Back online", "Offline", "Sync error") and the "Changes from another device" snackbar (interaction-patterns §6.5) are also NOT built.

**Rationale:** Engineering surfacing the gap to the user: the UX spec was written assuming a sync backend exists. The locked v1 architecture has no sync. Building the sync UI without backing semantics is misleading. The footer keeps transparency about data location (where the user's files actually live).

**Consequences:** No false sense of "sync working." If v1.1 adds true sync, the §42 component re-appears with no other refactor. The "no sync indicator" change is a single component swap.

---

## 2026-05-18 — Single-step undo lives in frontend in-memory (5s window)

**Phase:** engineering

**Decision:** The 5-second snackbar-undo journal is a frontend-only Zustand store (`undoStore.current: UndoEntry | null`). Each mutation pushes an undo entry on `onMutate`; the timer clears at `expiresAt`; the user can `⌘Z` or click the Undo button to pop and apply. Single-step (replace on push) for v1; multi-step is post-v1.

**Rationale:** Lighter than server-side; latency-free; the 5s window is short enough that persistence isn't required. If the user refreshes during the window, undo is gone — acceptable, the user also lost the snackbar.

**Consequences:** Reverse operations (un-completing a recurring task whose next instance auto-generated) need to know how to reverse cascading state. Implemented as a custom `apply` callback per mutation (the mutation factory composes it).

---

## 2026-05-18 — v1 distribution: source + `pnpm start`; no installer or auto-start

**Phase:** engineering

**Decision:** v1 ships as source. The user clones the repo, runs `pnpm install && pnpm build && pnpm start`, opens `http://127.0.0.1:7373`. No installer, no system service, no launchd/systemd templates. `--data-dir` arg or `TASKO_DATA_DIR` env points the server at the user's chosen data directory; default `~/.tasko`. Port `7373` (`TASK`); host `127.0.0.1` only — no auth because the port is local-only.

**Rationale:** Simplest viable v1. v1.1+ may ship a `tasko` CLI binary (esbuild single-file output) plus optional autostart templates. Auth is unnecessary while the port is local-only.

**Consequences:** Users with technical comfort only in v1; the README is the entire onboarding surface. v1.1 can layer convenience on top without changing the architecture.

---

## 2026-05-18 — Data directory default is `~/Documents/.tasko-data` (supersedes the earlier `~/.tasko`)

**Phase:** plan

**Decision:** The default data directory is `~/Documents/.tasko-data` (hidden subfolder inside the user's Documents folder), per the binding resolution recorded in `docs/engineering/2026-05-18-open-questions.md` §0 item 4.1 (dated 2026-05-18). The earlier decision-log entry "v1 distribution: source + `pnpm start`" referenced `~/Documents/.tasko-data` only loosely (used the older `~/.tasko` shorthand in some prose). The binding resolution is the authoritative answer; the engineering architecture spec (`docs/engineering/2026-05-18-architecture.md` §3.1 and §7.4) already references the correct path.

**Rationale:** `~/Documents/.tasko-data` is predictable across macOS / Linux / Windows (every desktop OS has a Documents folder; hidden via the leading dot makes it unobtrusive). The earlier `~/.tasko` proposal was the architect's pre-binding default; the user picked Documents-rooted at the open-questions review.

**Consequences:** Task 02 implements `loadConfig` with `~/Documents/.tasko-data` as the fallback. The README and `known-issues.md` (both in task 20) document the default. If a user wants a different location they pass `--data-dir <path>` or `TASKO_DATA_DIR=<path>`.

---

## 2026-05-18 — Implementation plan structure: 20 sequential tasks, ~one Claude Code session each

**Phase:** plan

**Decision:** Tasko v1 is broken into exactly 20 sequential tasks under `docs/tasks/`. Each task is sized to fit a single Claude Code session including the full implement → test → review → fix loop. Task 1 is a vertical slice (monorepo + tokens + Fastify health + Vite shell); tasks 2–3 are the data layer + REST CRUD; tasks 4–7 are the frontend shell + component library + Task modal; tasks 8–16 are feature views (smart lists, hierarchy/tree, drag, recurrence, bulk/trash/undo, markdown, calendar month, calendar week + kanban, tag/completed); tasks 17–20 are SSE multi-tab + hotkeys/palette/a11y shell + a11y/perf audit + E2E/release-readiness.

**Rationale:** The architect's `feature-mapping.md` §22 outlined 8 phases (~1 week each with one engineer) — that's too coarse for Claude Code sessions. The planner split each phase into 1–3 tasks of session-sized scope, ordered to surface risk early (foundation before features; depth-cap and recurrence before the views that depend on them; calendar last because it's the largest UX surface and drag-CUT simplifies it). The final two tasks (a11y/perf audit + E2E/release) are intentionally cross-cutting passes that don't add new features but close gaps.

**Consequences:** Sequential execution: each task starts from the committed output of the previous. No parallel branches. Integration accumulates naturally — task 8's tests exercise tasks 1–7, task 17's tests exercise 1–16, task 20's E2E sweep is the final acceptance gate. If a task is found to be too large in practice during implement, the implementer agent can split it into `task-NN-a` / `task-NN-b` files — but the plan's sequencing must hold.

---
