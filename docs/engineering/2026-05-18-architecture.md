---
title: Tasko — Engineering Architecture
date: 2026-05-18
phase: engineering
scope: project
status: draft
---

# Tasko — Engineering Architecture

## 0. Summary

Tasko v1 is a **single-user local desktop app distributed as a small monorepo the user runs on their own machine**. It is two processes glued together by HTTP on `localhost`:

1. A **Node.js + Fastify service** that owns a directory of JSON files and exposes a REST API on `http://127.0.0.1:<port>`.
2. A **React 19 + Vite browser UI** the user opens in their regular browser, which calls that API.

Storage is a flat tree of JSON files under a user-chosen data directory. **One file per entity** so that the data directory can be a git repo the user pushes/pulls manually — but **Tasko itself does not know git**. There is no library dependency on git, no PAT handling, no "sync now" button, no conflict resolution UI. The user owns the git lifecycle in their terminal; Tasko reads and writes files.

The product is intentionally **desktop-only and single-machine in v1**. Mobile responsive CSS ships (per the UX spec), but mobile is not a QA target. Multi-machine "conflicts" are deferred — if the user pulls two divergent branches, that is a `git merge conflict` they resolve in `vim`, not in Tasko.

This document is the canonical engineering spec. Data shapes live in `data-model.md`; REST endpoints in `api.md`; frontend module layout in `frontend-architecture.md`; per-v1-feature engineering mapping in `feature-mapping.md`; unresolved items in `open-questions.md`.

---

## 1. Tech stack

### 1.1 Stack table (the lockdown)

| Layer | Pick | Reason |
|---|---|---|
| **Language (both sides)** | TypeScript 5.x, `strict: true` + `noUncheckedIndexedAccess` + `noFallthroughCasesInSwitch` + `exactOptionalPropertyTypes` | The whole codebase is small enough to type strictly; locked decision. |
| **Package manager** | pnpm 9.x with workspaces | Locked. Workspaces give us shared `@tasko/types` between server and web. |
| **Monorepo layout** | Single repo, three workspaces: `apps/server`, `apps/web`, `packages/types` | Smallest viable separation. Types are the only sharing surface. |
| **Node runtime** | Node.js 20.x LTS | Mature, native `fs/promises`, native `crypto.randomUUID`, native fetch (we don't need it server-side but nice to have). |
| **Backend framework** | Fastify 5.x | Locked over Express. Built-in zod-friendly schema validation hooks, faster, better TS types, ~30 lines fewer per route. |
| **Schema validation** | zod 3.x | Locked. One source of truth for: incoming request bodies, outgoing response bodies, on-disk file contents, and TS types (via `z.infer`). Shared in `packages/types`. |
| **ID generation** | ulid 3.x | Sortable + URL-safe + collision-resistant. Sortable IDs mean directory listings are roughly creation-ordered, which is a tiny but real ergonomic win for git diffs. |
| **File I/O** | `fs/promises` + atomic-write helper (write to `*.tmp` → `rename`) | No SQLite, no DB. Atomic-write avoids torn writes if the process is killed mid-write. |
| **Cache invalidation/internal pub-sub on the server** | `chokidar` 4.x (optional) | Wraps watching for **self-originated writes** to invalidate an in-memory index. We do NOT use it for cross-process file watching (see §2.6). May be replaced by direct cache invalidation if simpler. |
| **Frontend framework** | React 19.x | Locked. Native `use()`, transitions, `useOptimistic`, ref-as-prop. |
| **Build tool / dev server** | Vite 5.x | Locked. Fast HMR, native ESM, first-class TS. |
| **Routing** | TanStack Router 1.x | Typed routes — every navigation is a TS-checked link. The product has ~20 routes (Today, Tomorrow, Next 7 Days, Inbox, All, Completed, Trash, Calendar, Settings, per-project, per-tag) — typed routes pay back the bundle weight on every refactor. |
| **Server state** | TanStack Query 5.x | Locked pairing with TanStack Router. Handles request dedup, focus refetch (the v1 "refresh after git pull" story), cache invalidation per mutation. |
| **Local UI state** | Zustand 4.x | Tiny, no provider tree, great for the things React Query is wrong for: command-palette open state, current filter chips (session-only per UX), multi-select set, undo journal, hotkey-stack, theme. |
| **Drag-and-drop** | `@dnd-kit/core` + `@dnd-kit/sortable` 6.x | a11y-first (keyboard drag, screen-reader announcements), no jQuery legacy, plays well with React 19. Used for: reorder rows in lists, re-parent in tree, kanban column moves, calendar event drag. |
| **Command palette** | `cmdk` 1.x | Locked. Pre-built keyboard-correct primitive. Wrapped to integrate with our Zustand-backed command registry. |
| **Date picker** | `react-day-picker` 9.x | A11y-tested, supports keyboard nav per WCAG, week-start config. We could build it ourselves from `@floating-ui` but the UX spec's date popover is rich enough (today highlight, quick-select row, locale-aware) that re-implementing is wasted weeks. |
| **Popover positioning** | `@floating-ui/react` 0.27.x | Used by every non-date popover: priority menu, sort dropdown, tag autocomplete, day-detail popover, tooltip, context menu. Flipping, shifting, focus management, all sorted. |
| **Markdown rendering** | `marked` 14.x (or `markdown-it` 14.x — see §6.3) | Locked: rendered notes only. Editing is a plain `<textarea>`. Bundle <40kB, no plugin ecosystem we need. |
| **Virtualization** | `@tanstack/react-virtual` 3.x | Used **conditionally** — see §10 perf budget. Today, Inbox, per-project flat, per-tag, Completed views virtualize when row count > 200. Tree view virtualizes when expanded-visible row count > 200. |
| **Icons** | `lucide-react` 0.x | Locked by UX. Tree-shaken; only the ~35 icons in the design-language doc end up in the bundle. |
| **CSS** | CSS Modules + vanilla CSS + CSS custom properties | Locked. No styled-components, no Tailwind, no Emotion. Tokens from `design-language.md` become CSS custom properties under `:root[data-theme="light"]` / `:root[data-theme="dark"]`. |
| **Theming switch** | `:root[data-theme="..."]` attribute toggled by a Zustand selector that watches `prefers-color-scheme` when user setting is "system" | Standard. Live theme switch (per flow §14) is just a token swap; no re-render needed. |
| **HTTP client** | Native `fetch` + a thin typed wrapper (`apiCall<TIn, TOut>`) | TanStack Query handles caching; the wrapper handles the URL, the zod parse of the response, and error envelope. No axios. |
| **Optional SSE** | Native `EventSource` (frontend) + Fastify's `reply.raw` (server) | See §2.7 — we ship SSE for self-originated cache invalidation only, not for filesystem watching. |
| **Test runner** | Vitest 2.x | Locked. Same toolchain front + back. Runs unit + integration tests. |
| **E2E** | Playwright 1.x | Locked, desktop browsers only (Chromium + WebKit). Mobile-emulation tests are deferred to v1.1 alongside the mobile QA target. |
| **Lint + format** | Biome 1.x (stable as of late 2025) | Locked, replaces ESLint + Prettier. Single config, ~10× faster, native TS. |
| **Type-check in CI** | `tsc --noEmit` per workspace | Belt-and-suspenders next to Biome (which doesn't catch every TS error). |
| **Logging (server)** | `pino` 9.x (Fastify default) | JSON-line logs, pretty-print in dev. |
| **Config file format** | JSON for `config.json` (consistent with the rest of the on-disk format); no `.env` for v1 | The user starts the service from their data directory; CLI args + env vars > hidden config. |
| **Process management v1** | The user runs `pnpm start` from the data directory (or wherever they install Tasko). | Locked. No launchd / systemd / pm2. v1.1 may ship a `tasko` CLI binary. |

### 1.2 Why not <X>

| Rejected | Why |
|---|---|
| Electron / Tauri | The product runs in a regular browser tab — distribution as a desktop binary adds packaging cost without removing the local-service. v1.1 may revisit Tauri for a single-binary distribution. |
| SQLite (`better-sqlite3` or `bun:sqlite`) | The data directory must be **git-friendly with minimal merge conflicts**, which requires per-entity files. A SQLite file as one giant binary is the antithesis of that. (Migrating to SQLite is a viable v1.x option if the JSON-tree perf becomes a real problem; the migration path is documented in `data-model.md` §8.) |
| Express | Fastify wins on TS types and zod integration. Express's ecosystem advantage doesn't matter for a tiny REST surface (~20 endpoints). |
| Vue / Svelte / Solid | React 19 is the lock for the orchestrating user. The UX spec doesn't pull on any feature unique to those frameworks. |
| Tailwind | Token system is small (see §1.3 below), and "one big stylesheet of utilities" doesn't beat CSS Modules + custom properties for this size of app. The tokens come from the UX spec, not from atomic class names. |
| CodeMirror / ProseMirror / Lexical | Locked pre-decision: plain `<textarea>` + `marked` for the rendered preview. The note field is markdown, not rich text. CodeMirror is ~250kB; we save it. |
| `react-beautiful-dnd` | Unmaintained. `@dnd-kit` is the actively-maintained successor that does everything we need plus a11y. |
| `axios` | Native fetch covers our needs; TanStack Query layers on top of it. |
| `jest` | Vitest is the modern default with Vite; same tooling end-to-end. |
| `ESLint + Prettier` | Biome is a single tool that does both, with ~zero config and ~10× speed. |
| Service Workers / PWA | Per product spec §3 — no service workers in v1. We do not register one. |
| Auth / accounts | Locked decision: no users, no auth. The service binds to `127.0.0.1` only. |

### 1.3 Dependency count budget

Hard ceiling: the runtime dependencies of `apps/web` + `apps/server` should sum to **≤ 35 packages** at v1 ship (excluding peer deps of these). This is a budget check, not a target. Every added dependency requires a one-line justification in this file.

---

## 2. System architecture

### 2.1 The two processes

```
+----------------------------------------------------------+
|  USER'S MACHINE                                          |
|                                                          |
|  +-----------------------+   HTTP    +-----------------+ |
|  |  apps/server          |<--------->|  apps/web       | |
|  |  Node.js + Fastify    |  REST     |  Vite-served    | |
|  |                       |  (+SSE)   |  React 19 SPA   | |
|  |  127.0.0.1:7373       |           |                 | |
|  |                       |           |  user's browser | |
|  |  - REST API           |           |  http://...     | |
|  |  - JSON file I/O      |           |                 | |
|  |  - In-memory index    |           |                 | |
|  |  - SSE endpoint       |           |                 | |
|  +-----------+-----------+           +-----------------+ |
|              |                                           |
|              | fs/promises                               |
|              v                                           |
|  +-----------------------+                               |
|  |  DATA DIRECTORY       |                               |
|  |  ~/tasko-data/        |                               |
|  |   config.json         |                               |
|  |   items/<ulid>.json   |                               |
|  |   projects/<ulid>.json|                               |
|  |   folders/<ulid>.json |                               |
|  |   tags/<ulid>.json    |                               |
|  |   trash/<ulid>.json   |                               |
|  |                       |                               |
|  |  (this is also a      |                               |
|  |   git repo the user   |                               |
|  |   manages manually.   |                               |
|  |   Tasko doesn't know  |                               |
|  |   that.)              |                               |
|  +-----------------------+                               |
|                                                          |
+----------------------------------------------------------+
```

### 2.2 Why two processes (not just static site + IndexedDB)

The user explicitly chose a "Node service + JSON files in a git directory" architecture over the typical "browser-only IndexedDB" pattern. The trade-offs:

- **Why this wins**: The data directory is plain text JSON the user can `git diff`, `git merge`, and back up with their existing dotfiles workflow. They get cross-machine sync for free (git push/pull). No proprietary backup format.
- **What this costs**: The user must run `pnpm start` to use the app. There is no "open Tasko URL and it just works in any browser" story.
- **What's hidden**: The service is intentionally NOT the user's responsibility to understand. They start it, they refresh the browser, they git-pull/push when they want to sync devices. Everything Tasko does is plain CRUD on files in their git repo.

### 2.3 Why one local-only port

The service binds to `127.0.0.1:7373` (`tasko` on a phone keypad), not `0.0.0.0`. There is no auth because the only thing reaching the port is the user's own browser on the same machine. Other devices on the LAN cannot reach Tasko. v1.1 may add a LAN-binding flag with a token-based auth header if there's demand.

CORS: The server allows `http://127.0.0.1:5173` (Vite dev) and `http://127.0.0.1:7373` (prod). No other origins.

### 2.4 Read path

```
React component
  → useQuery(['items', ...]) (TanStack Query)
    → apiCall('GET /api/items?...') (fetch + zod parse)
      → Fastify route handler
        → Reads in-memory index (entire dataset is small — see §10)
        → Returns array of typed Items
      ← JSON response, zod-validated
    ← TanStack Query caches, dedupes, refetches on focus
  ← React renders
```

The server keeps an **in-memory index** of all items, projects, folders, and tags. The index is built on boot by reading every JSON file. After boot, all reads are served from memory; the filesystem is only touched on writes (and to rebuild the index on demand — see §2.6). This is comfortable up to ~10k items (see §10).

### 2.5 Write path

```
React component (optimistic)
  → useMutation (TanStack Query)
    → onMutate: apply change to local cache (instant UI)
    → apiCall('PATCH /api/items/:id', body)
      → Fastify route handler
        → zod-validate body
        → Apply mutation to in-memory index
        → Atomic write to disk: tmp file + rename
        → Emit SSE event to all subscribers (if SSE wired)
      ← 200 OK with updated entity
    → onSuccess: replace cache with server response (no-op if optimistic was correct)
    → onError: rollback optimistic change, surface error snackbar
  ← React renders rolled-back state
```

The server is the only writer of JSON files. The frontend never touches the filesystem.

### 2.6 Recurring task generation path (atomic op)

The recurring next-instance generation happens in a **single server-side mutation**, NOT two requests:

```
User checks off recurring task
  → PATCH /api/items/:id with { status: 'done' }
    → Server detects item.recurrence is set
    → In one transactional write set (single mutex):
        1. Mark current instance done + stamp completed_at + snapshot rule
        2. Compute next-instance fields per rule (see data-model.md §6)
        3. Write current instance to disk
        4. Write new instance to disk
    ← Returns { completed: Item, next: Item }
  → TanStack Query invalidates ['items'] cache
  → Both items reflected in next render
  → Snackbar "Task completed. Next: <date>."
```

The single-mutex transaction matters because if the process is killed between writing the current and the new instance, the user gets a phantom state. We use a tiny per-process mutex (`p-queue` size 1 or a hand-rolled async lock) keyed on "writes" — at most one write transaction at a time.

### 2.7 SSE — what we use it for (and what we don't)

The locked decisions are clear:

- **We do NOT design for cross-process change detection.** If the user runs `git pull` and the files change on disk, Tasko does not auto-detect. The user refreshes the browser.
- **We MAY use SSE for service-confirmed writes.** This lets two browser tabs (the same user opens Tasko twice) eventually agree without needing a stale-cache snackbar. Tab A writes → server confirms → SSE broadcasts → Tab B's TanStack Query cache invalidates.

**Decision: ship SSE in v1.** It's ~80 lines of server code, ~30 lines of frontend, and it solves the "I opened Tasko in two tabs" multi-tab case cleanly (per UX `interaction-patterns.md` §5 and `frontend-architecture.md` §11). It does NOT solve the "I git-pulled and the files changed" case — that requires manual refresh. SSE is a quality-of-life nicety for the multi-tab pattern; it is not a sync engine.

Endpoint: `GET /api/events` (SSE).
Event types: `item.changed`, `item.created`, `item.trashed`, `item.restored`, `project.*`, `folder.*`, `tag.*`, `config.changed`. Each event payload includes `{ id, type, source: 'self' | 'other-tab' }`. The frontend tab that sent the originating write ignores events with `source: 'self'` for its own changes (it already applied them optimistically); other tabs treat the event as a cache-invalidation signal.

If SSE turns out to be flaky or adds complexity beyond expected, we drop it and rely on `refetchOnWindowFocus: true` from TanStack Query. The fallback is in place even if SSE ships — every focus refetches the active query. SSE is purely an upgrade on top of that.

### 2.8 Filesystem watching (chokidar) — why we keep it (carefully)

We may run `chokidar` server-side scoped to **our own data directory** for one purpose only: to detect when the server itself wrote a file and confirm the index is consistent. This is **not** a feature; it's a safety net.

We **do not** advertise filesystem-watch as a v1 capability. If the user wants their git pull to flow into the app, they refresh the browser. The chokidar watcher's only public surface is internal logging.

If we find chokidar is fragile across macOS / Windows / Linux, we drop it. Direct cache invalidation on every server write is the primary mechanism; chokidar is belt-and-suspenders.

### 2.9 The data directory is just a directory

```
~/tasko-data/                     # user-chosen path (CLI arg / env var)
  config.json
  items/
    01HM5T...json
    01HM5U...json
    ...
  projects/
    01HM4A...json
    ...
  folders/
    01HM3Z...json
  tags/
    01HM2P...json
  trash/
    01HM5T...json   # soft-deleted items are MOVED here, not flagged in place
  .git/             # optional, owned by the user, not by Tasko
```

Why move-on-trash (not flag-in-place): if a Trashed item lives in `items/<id>.json` with a `trashed_at` flag, the git diff for the trash operation is one-line. If we move the file to `trash/<id>.json`, the git diff is a rename. Both work. We pick **move-on-trash** because:

1. The `items/` directory listing equals "active items" — no scan-and-filter needed on every read.
2. The on-disk file path encodes the user's mental model.
3. Restore is just moving the file back.

The `data-model.md` doc lists the schemas and field-by-field semantics.

---

## 3. Module boundaries

### 3.1 Backend modules (`apps/server`)

```
apps/server/
  src/
    server.ts                 # Fastify bootstrap, plugin registration, route mounting
    config/
      load.ts                 # Resolve --data-dir CLI arg + env + ~/Documents/.tasko-data default
      types.ts                # ServerConfig type
    routes/
      items.ts                # CRUD for items (the workhorse)
      projects.ts             # CRUD for projects
      folders.ts              # CRUD for folders
      tags.ts                 # CRUD for tags (+ autocomplete by prefix)
      trash.ts                # list, restore, permanent-delete, empty-trash
      bulk.ts                 # move-all-overdue-to-today, multi-select move/delete/complete
      config.ts               # GET/PATCH config
      events.ts               # SSE stream
    store/
      fs-store.ts             # Low-level: read/write/atomic-write/list/move
      indexer.ts              # Builds + maintains the in-memory index
      mutex.ts                # Single-writer mutex for transactional ops
      paths.ts                # Resolves data-dir paths
    domain/
      schemas.ts              # Re-exports from @tasko/types
      depth-cap.ts            # 4-level enforcement logic
      recurrence.ts           # Next-instance computation
      hierarchy.ts            # Parent/child traversal, descendant collection
      ids.ts                  # ULID wrapper
      time.ts                 # Local-date arithmetic (no TZ math)
    middleware/
      cors.ts
      error-envelope.ts       # Turns thrown errors into { error: { code, message } }
      sse-broker.ts           # In-process pub/sub for SSE
    bin/
      tasko-server.ts         # Entry point (the binary `pnpm start` runs)
  test/
    integration/              # Spin up real fs in a temp dir; hit routes end-to-end
    unit/                     # Pure functions: depth-cap, recurrence, hierarchy
  package.json
```

Module rules:

- `routes/*` only call into `domain/*` and `store/*`. They never read `fs` directly.
- `store/*` is the only module that touches the filesystem.
- `domain/*` is pure: deterministic given inputs. Recurrence math, depth-cap, hierarchy — all tested without fs.
- `middleware/sse-broker.ts` is a typed `EventEmitter`. Routes call `broker.publish(...)`; the SSE route subscribes.

### 3.2 Frontend modules (`apps/web`)

```
apps/web/
  src/
    main.tsx                  # Vite entry, mount React, providers
    app.tsx                   # Root layout + router outlet
    routes/                   # TanStack Router routes
      __root.tsx              # Root layout shell
      today.tsx
      tomorrow.tsx
      next-7-days.tsx
      inbox.tsx
      all.tsx
      completed.tsx
      trash.tsx
      calendar.tsx
      settings.tsx
      project.$id.tsx
      tag.$name.tsx
    views/                    # View-level orchestration components
      today-view/
      project-view/
        tree-view.tsx
        flat-list-view.tsx
        kanban-view.tsx
      calendar-view/
        month.tsx
        week.tsx
        day-detail-popover.tsx
      trash-view/
      completed-view/
      settings-view/
    components/               # Reusable UI primitives — 1:1 with component-inventory.md
      button/                 # §1
      icon-button/            # §2
      text-input/             # §3
      textarea-markdown/      # §4
      date-picker/            # §5
      time-picker/            # §6
      date-time-combined/     # §7
      dropdown/               # §8
      tag-input/              # §9
      priority-menu/          # §10
      checkbox/               # §11
      subtask-checkbox/       # §12
      card/                   # §13
      modal/                  # §14
      sheet/                  # §15 (mobile — ships, not QA-targeted in v1)
      snackbar/               # §16
      tooltip/                # §17
      sidebar-nav-item/       # §18
      folder-header/          # §19
      project-row/            # §20
      tree-row/               # §21
      subtask-row/            # §22
      task-list-row/          # §23
      kanban-column/          # §24
      kanban-card/            # §25
      calendar-day-cell/      # §26
      calendar-event-chip/    # §27
      calendar-week-block/    # §28
      filter-chip/            # §29
      sort-dropdown/          # §30
      view-toggle/            # §31
      multi-day-chip/         # §32
      command-palette/        # §33
      confirmation-prompt/    # §37
      drag-visuals/           # §38
      skeleton/               # §36
      empty-state/            # §35
    store/                    # Zustand stores
      command-palette.ts
      filters.ts              # session-only filter chip state
      multi-select.ts
      undo.ts                 # 5s in-memory journal
      theme.ts
      hotkey-registry.ts
      sse.ts                  # SSE subscription + reconnection
      snackbar.ts             # singleton snackbar manager
    api/
      client.ts               # apiCall<TIn, TOut> + error envelope
      items.ts                # query keys + mutation factories
      projects.ts
      folders.ts
      tags.ts
      trash.ts
      bulk.ts
      config.ts
      events.ts               # SSE client + dispatch into TanStack Query invalidate
    hooks/
      useHotkey.ts            # subscribes to hotkey-registry
      useFocusedRow.ts        # navigation across list rows
      useOptimisticMutation.ts # wraps useMutation with optimistic + undo journal entry
      usePrefersReducedMotion.ts
      useMatchMedia.ts        # prefers-color-scheme for theme=system
    lib/
      date-fmt.ts             # short/long-form date formatting (locale-aware)
      markdown.ts             # marked wrapper with safe HTML defaults
      depth-cap-client.ts     # mirror of server check, for instant UI feedback on drag
      keyboard.ts             # key event helpers
      a11y.ts                 # aria-live announcement helper
    styles/
      tokens.css              # design-language.md tokens, as CSS custom properties
      base.css                # reset + global typography
      theme.css               # data-theme="..." attribute selectors
  test/
    unit/                     # vitest, components rendered via Testing Library
    e2e/                      # playwright, desktop browsers
  index.html
  vite.config.ts
  package.json
```

Module rules:

- `views/*` consume `components/*` + `api/*` + `store/*` + `hooks/*`.
- `components/*` are presentation primitives. They do **not** call the API directly; they accept data and callbacks as props. (Some "container" components live inside `views/` for surfaces that have view-specific behavior.)
- `api/*` defines TanStack Query keys + mutations. View files import the hooks here.
- `store/*` is for client-only state that doesn't belong in the URL or the server cache.
- `lib/*` is pure utilities — no React.
- `styles/tokens.css` is auto-generated from `design-language.md` at lint time (a small script in `apps/web/scripts/build-tokens.ts`). Hand-editing the CSS is allowed if a token doesn't yet exist; the next build replaces it.

### 3.3 Shared (`packages/types`)

```
packages/types/
  src/
    schemas/
      item.ts          # ItemSchema, ItemCreateSchema, ItemPatchSchema
      project.ts
      folder.ts
      tag.ts
      subtask.ts
      recurrence.ts
      config.ts
      bulk.ts
    api/
      requests.ts      # zod schemas for all request bodies
      responses.ts     # zod schemas for all response bodies
      sse-events.ts    # zod schemas for SSE event payloads
    domain/
      ids.ts           # ULID brand
      status.ts        # 'todo' | 'in_progress' | 'done' union + brand
      item-type.ts     # 'epic' | 'feature' | 'task' union
      priority.ts      # 'none' | 'low' | 'medium' | 'high'
    index.ts
  package.json
```

The whole package is a single zod-based source of truth. Server reads request bodies through it; server parses files-on-disk through it; frontend types both requests and TanStack Query data through it.

---

## 4. State management

### 4.1 Three state surfaces

| Surface | Where it lives | Examples |
|---|---|---|
| **Server state** | TanStack Query | Items, projects, folders, tags, config. |
| **URL state** | TanStack Router search params | Current view, sort, filter chips (session-only — but represented in the URL so a refresh restores them). |
| **Local UI state** | Zustand | Command palette open, multi-select set, undo journal, hotkey registry, snackbar queue, theme (resolved value), SSE connection state. |

### 4.2 TanStack Query patterns

- **Query keys**: a small library of factories per resource:
  ```ts
  itemKeys.all() // ['items']
  itemKeys.list(filters) // ['items', 'list', { filters }]
  itemKeys.detail(id) // ['items', 'detail', id]
  itemKeys.byProject(projectId) // ['items', 'list', { projectId }]
  itemKeys.today() // ['items', 'list', { view: 'today' }]
  ```
- **Cache time**: `staleTime: 30s`, `gcTime: 5min`. We rely on SSE + focus-refetch to push fresh data; we don't aggressively re-poll.
- **Optimistic updates**: every mutation in `api/*` has an `onMutate` that patches the cache and pushes an undo entry into the Zustand undo store. `onError` rolls back.
- **Mutation queue**: TanStack Query handles this. We don't manually serialize mutations beyond what it provides; the server's mutex catches anything that races.

### 4.3 Zustand stores

Each store is small and independent. We do **not** put server data into Zustand — that's TanStack Query's job. Zustand holds UI-only state.

- `themeStore`: resolved theme `'light' | 'dark'`, user preference `'light' | 'dark' | 'system'`, listens to `prefers-color-scheme`.
- `commandPaletteStore`: open boolean, recent commands list (persisted to `localStorage`).
- `filterStore`: per-view filter chip state, derived to/from URL search params on route change.
- `multiSelectStore`: set of selected IDs, derived to/from view route.
- `undoStore`: stack of one `UndoEntry` (single-step undo — UX locked). Includes a 5s expiry timer.
- `hotkeyStore`: which mode is active (no-input vs input vs modal vs calendar vs kanban vs tree), the resolved binding map. Used by `useHotkey` hook.
- `snackbarStore`: singleton; at most one snackbar visible. Queue depth 2 (older dropped per UX spec).
- `sseStore`: connection state for the `/api/events` SSE channel.

### 4.4 Optimistic update + undo pattern

The combination of TanStack Query and the Zustand `undoStore` gives us a clean pattern:

```
useOptimisticMutation({
  mutationFn: api.items.patch,
  onMutate: ({ id, patch }) => {
    // 1. Snapshot the prior cache for this item
    const prior = queryClient.getQueryData(itemKeys.detail(id));
    // 2. Apply the optimistic patch
    queryClient.setQueryData(itemKeys.detail(id), { ...prior, ...patch });
    invalidateLists(id);
    // 3. Push undo entry
    undoStore.push({
      kind: 'patch-item',
      apply: () => api.items.patch({ id, patch: prior }), // reverse
      label: '<original item-modal-context-specific label>',
      expiresAt: Date.now() + 5000,
    });
    return { prior };
  },
  onError: (err, vars, ctx) => {
    queryClient.setQueryData(itemKeys.detail(vars.id), ctx.prior);
    invalidateLists(vars.id);
    snackbar.show({ variant: 'error', text: "Couldn't save. Try again." });
  },
  onSuccess: (server, vars) => {
    queryClient.setQueryData(itemKeys.detail(vars.id), server);
    invalidateLists(vars.id);
  },
});
```

`undoStore` exposes `⌘Z` (top of stack, expire after 5s) and `pop`. Snackbar's "Undo" button calls `undoStore.pop()` directly. Pop = call `.apply()` of the entry; if the apply itself optimistic-mutates, we get correct cascading undo of the undo.

**Where the journal lives**: frontend in-memory only. Locked recommendation. The 5s window is short; persisting it to disk via the server is over-engineering. If the user refreshes during the 5s window, undo is gone — which is also what would happen if they closed the browser tab. Acceptable.

---

## 5. Theming layer

### 5.1 Token surface

`design-language.md` §2 defines ~50 semantic tokens. They are emitted as CSS custom properties in `apps/web/src/styles/tokens.css`:

```css
:root[data-theme='light'] {
  --color-canvas: #FCFCFC;
  --color-canvas-subtle: #F6F6F6;
  --color-surface: #FFFFFF;
  /* ...all 50 tokens... */
  --space-1: 4px;
  --space-2: 8px;
  /* ...spacing scale... */
  --radius-sm: 6px;
  --motion-fast: 120ms;
  /* ...etc... */
}
:root[data-theme='dark'] {
  --color-canvas: #0E0F11;
  /* ...all dark variants... */
}
```

Components reference tokens by name:

```css
/* button/styles.module.css */
.primary {
  background-color: var(--color-accent);
  color: var(--color-text-on-accent);
  border-radius: var(--radius-sm);
  transition: background-color var(--motion-fast) var(--ease-standard);
}
```

### 5.2 Mode switching

The `themeStore` resolves a `'light' | 'dark'` value:

- User pref `'system'` → listens to `prefers-color-scheme` via a `useMatchMedia` hook.
- User pref `'light'` or `'dark'` → constant.

On change, `themeStore` sets `document.documentElement.dataset.theme = resolved`. CSS custom properties re-resolve; the browser handles transitions. Per UX, this is a `motion-fast` crossfade.

### 5.3 Reduced motion

`@media (prefers-reduced-motion: reduce)` applies the substitutions from `design-language.md` §6.4 + `interaction-patterns.md` §7. Implemented as a parallel `:root[data-theme="light"]@media(prefers-reduced-motion: reduce) { --motion-fast: 80ms; --motion-base: 80ms; ... }` block — the existing transition rules become near-instant without per-component changes.

Some motions are *functional* (drag shadow, focus ring rendering, drop-target highlight) and must NOT be suppressed. Those are implemented without a `transition` property; they're triggered by event handlers, not motion tokens.

---

## 6. Implementation choices that need a concrete pick

### 6.1 State management pick — confirmed

**TanStack Query (server) + Zustand (UI) + TanStack Router (URL).** Three small libraries each doing one thing well. Justified per UX `interaction-patterns.md` requiring URL-derivable filter state (Router), background-syncable server data with optimistic mutations (Query), and a few cross-cutting client-only stores (Zustand).

Rejected alternatives:
- Redux Toolkit + RTK Query: heavier; the boilerplate overhead doesn't pay back for a personal app.
- Jotai: fine alternative; we go with Zustand because the team-zero-context value of "everything is one hook with a setter" is higher than atom-graph composability for our small store count (~8).
- Pure React `useState` + `useReducer`: works but doesn't give us cross-component state for command palette, snackbar, undo, hotkeys without prop drilling or context-explosion.

### 6.2 Routing pick — confirmed

**TanStack Router 1.x.** Typed routes mean every `<Link to="/p/$id" params={...}/>` is TS-checked. Search-params are typed too (we use this for filter chips). The whole router config is ~200 lines for our ~13 routes.

Rejected: React Router 6.x. Mature, fine alternative. We go with TanStack Router because the typed search-params + automatic loader / preloading is a tighter fit for the optimistic-mutation pattern we use everywhere.

### 6.3 Markdown library — `marked` (recommended)

**Pick: `marked` 14.x.** Smaller (~30kB), CommonMark-compliant, fast, fewer plugin surfaces (we don't want plugins).

Configured with:
- `breaks: true` (CommonMark soft breaks render as `<br>`).
- A custom renderer for `[ ]` / `[x]` checklist items → render as visually-checked spans with **no click handler** (per UX: markdown checklists are display-only).
- All anchor tags get `target="_blank" rel="noopener noreferrer"`.
- HTML escaping is on by default; we don't pass user content through `dangerouslySetInnerHTML` unsanitized. (Marked handles this when `mangle: false, sanitize: false` is paired with our own escape — actually, we run output through `DOMPurify` 3.x because marked's sanitize was removed in v5+. DOMPurify adds ~20kB. Acceptable.)

Editing remains a plain `<textarea>` with custom keybindings:
- `⌘B` wraps selection with `**...**`.
- `⌘I` wraps with `*...*`.
- `⌘K` opens a link helper (small inline popover prompting for URL, inserts `[selected](url)`).
- `Tab` inside the textarea inserts two spaces.
- `Shift+Tab` removes two leading spaces from the line.
- `Enter` after `- [ ]` or `- ` continues the list (insert `- [ ] ` or `- `).

These are ~150 lines of plain-DOM event handlers; we don't pull in a markdown editor.

### 6.4 Date picker — `react-day-picker`

Justified: a11y-tested, supports keyboard nav (arrow keys, Page Up/Down per UX spec), supports week-start config, supports rangeless single-date selection. Wrapped in `<DatePickerPopover>` that adds the quick-select row ("Today / Tomorrow / Next week / No date") above the calendar, plus the close-on-outside-click behavior. ~120 lines of wrapper.

Rejected alternative: roll-our-own with `@floating-ui/react`. The UX spec's date picker has enough subtle behavior (focused-today highlight, disabled dates before start_date, locale weekday header) that writing it costs us 600+ lines of code we don't need to write.

### 6.5 Drag-and-drop — `@dnd-kit`

Justified: keyboard drag (Space to pick up, arrows to move, Enter to drop), screen-reader announcements built-in. Used for:

- **List reorder** (Today, Inbox, project flat, per-tag, etc.): `useSortable` per row.
- **Tree re-parent**: `useDraggable` per tree row + `useDroppable` per Epic / Feature target. Depth-cap check on drop (we expose a `canDrop({source, target})` predicate from `domain/depth-cap.ts` mirror in the frontend `lib/depth-cap-client.ts`).
- **Kanban**: `useSortable` within each column; `useDroppable` per column body.
- **Calendar drag-reschedule**: **CUT from v1** per `open-questions.md` §0. v1 reschedules via click-event → modal → date picker. Drag reschedule is a v1.1 feature.

The keyboard fallback for keyboard-only users (no drag): the move-to picker (`⌘⇧M`) per UX. dnd-kit's keyboard sensor works too, but for cross-tree re-parent we rely on the picker as the canonical path.

### 6.6 Virtualization — `@tanstack/react-virtual` (conditional)

Threshold:
- Flat list views virtualize when **row count > 200**.
- Tree views virtualize when **visible (expanded) row count > 200** — we lazy-flatten the tree to a row array, virtualize over the array.
- Kanban virtualizes per column when **column row count > 50**.
- Calendar month view never virtualizes (42 cells × maybe a few chips each is bounded).
- Calendar day-detail popover virtualizes when **count > 50**.
- Completed view virtualizes when **count > 200**.

The thresholds are designed so that v1 ships with virtualization wired but inactive for most users. For users with 1500-task projects, it kicks in.

### 6.7 Command palette — `cmdk`

Wrapped in `<CommandPalette>` that:
- Reads the command registry from `commandPaletteStore`.
- Adds dynamic commands ("Go to <Project>", "Go to #<tag>") from the TanStack Query cache.
- Uses cmdk's built-in fuzzy match.
- Replaces cmdk's default styling with our token-based CSS.

Per UX `microcopy.md` §12.2 — the catalog of commands is finite and well-defined.

### 6.8 Popover positioning — `@floating-ui/react`

Used inside: priority menu, sort dropdown, tag autocomplete, day-detail popover, tooltip, context menu, snackbar (positioning), date-time-combined picker (when sub-popovers anchor).

---

## 7. Build & dev workflow

### 7.1 Local development

```
# First time
pnpm install
pnpm --filter @tasko/types build  # bootstrap shared types

# Day-to-day (two terminals)
pnpm --filter @tasko/server dev   # tsx watch — restarts on TS change
pnpm --filter @tasko/web dev      # Vite with HMR
```

Or, via root-level convenience script: `pnpm dev` runs both in parallel via `concurrently`.

The Vite dev server proxies `/api` and `/events` (SSE) to `http://127.0.0.1:7373` so CORS isn't a dev-time concern.

### 7.2 Build

```
pnpm build
# = pnpm --filter @tasko/types build
#   pnpm --filter @tasko/server build  → dist/server.js (single esbuild bundle)
#   pnpm --filter @tasko/web build     → dist/* (Vite production build)
```

### 7.3 Run (production / user)

```
pnpm install --prod
TASKO_DATA_DIR=~/Documents/.tasko-data pnpm start
# This starts the server, which also serves the static frontend bundle from apps/web/dist
# User opens http://127.0.0.1:7373 in their browser
```

The server serves the frontend in production — one process, one URL. This is the **single-binary illusion** we ship: the user doesn't need to know there's a Vite dev server. They run one command, they hit one URL.

### 7.4 CLI args / env

| Arg / Env | Default | Purpose |
|---|---|---|
| `--data-dir <path>` / `TASKO_DATA_DIR` | `~/Documents/.tasko-data` | Data directory location. |
| `--port <n>` / `TASKO_PORT` | `7373` | HTTP port. |
| `--host <host>` / `TASKO_HOST` | `127.0.0.1` | Bind interface. Don't change unless you want to expose Tasko to the LAN — and we don't, because v1 has no auth. |
| `--init` | — | Create a fresh `config.json` and `items/`, `projects/`, `folders/`, `tags/`, `trash/` directories if they don't exist. |

### 7.5 Tests

```
pnpm test              # vitest on everything
pnpm test:e2e          # playwright (assumes server + web built)
pnpm typecheck         # tsc --noEmit per workspace
pnpm lint              # biome check
pnpm format            # biome format --write
```

CI runs typecheck + lint + test on every PR.

---

## 8. Deployment / distribution

**v1 deployment model: source distribution.**

- User clones the repo (or downloads a tarball).
- `pnpm install` (~15s).
- `pnpm build` (~10s).
- `pnpm start`.
- Open `http://127.0.0.1:7373`.

There is **no installer**, **no auto-start**, **no system service**. This is locked. v1.1 may ship a `tasko` CLI binary (esbuild single-file output) + optional launchd/systemd templates.

The data directory is anywhere the user wants. They are encouraged to point Tasko at a directory inside a private GitHub repo, which they git-pull and git-push manually for cross-machine sync.

---

## 9. Error handling philosophy

| Layer | Errors | Surface |
|---|---|---|
| **Server route** | zod validation fails, ULID malformed, depth-cap rejection, write fails | 4xx / 5xx with `{ error: { code, message } }` envelope. |
| **Server domain** | recurrence rule invalid, hierarchy cycle (shouldn't happen but defensive) | Throws a typed error caught by the error-envelope middleware. |
| **Server fs** | EACCES, ENOSPC, ENOENT (item missing) | Caught at the route level; turned into 5xx with a specific code. The user sees "Couldn't save. Try again." snackbar; the server logs the full stack. |
| **Frontend API call** | non-2xx response, network failure, zod parse of response fails | TanStack Query's `onError` → snackbar (assertive) + rollback of any optimistic mutation. |
| **Frontend rendering** | React error boundary at the route level catches and shows a fallback "Something went wrong. <Reload>" with the error logged to console. | Full-page error state. |

### 9.1 What gets retried automatically

- TanStack Query auto-retries GET queries 3× with backoff. Mutations: no auto-retry (the user re-triggers).
- SSE auto-reconnects on disconnect with exponential backoff (1s → 2s → 4s → 8s → capped at 8s).

### 9.2 What fails loudly

- Writes to disk that throw (EACCES, ENOSPC, EIO): surface immediately as an assertive snackbar. Optimistic mutation rolls back. This is the "you're out of disk space" scenario.
- Server bootstrap fails to read/parse a JSON file in `items/`: the indexer logs the bad file, **skips** it, and includes a `warning` in the boot log. The bad item does not appear in the UI. The user can git-checkout the file or fix it by hand. We do not delete a file we can't parse.
- ULID format invalid in a path or request: 400 with a clear error code.

### 9.3 Logging

Server uses `pino`:
- One JSON line per request (method, url, status, duration).
- Errors at `error` level with stack.
- Boot info (data-dir, port, host, item count) at `info`.

Frontend uses `console.error` for unexpected errors and a tiny `logger.ts` wrapper. We do not ship a telemetry pipeline in v1.

---

## 10. Performance budget

The biggest scalability risk is rendering 500+ items in a project tree or a calendar with 50+ items on a busy day. Per product spec §7.8-7.10.

| Surface | Target | Approach |
|---|---|---|
| App boot (first paint) | < 800ms on a mid-tier laptop | Vite production build, server-serves-static, no SSR. |
| API call latency (localhost) | < 10ms p95 | In-memory index. fs only touched on writes. |
| List view render with N items | 200 → no virtualization; 500 → virtualized; 2000 → still < 100ms render | `@tanstack/react-virtual` conditional. |
| Tree render with N visible rows | Same thresholds. | Same. |
| Kanban with M cards per column | M > 50 per column → virtualize. Done column with 5000 items shows "Showing recent 50, [Show all]" per UX. | Conditional virtualization + done-column slicing. |
| Calendar month with N events | Day cell caps at "first 4 + +N more" per UX. | Bounded by overflow popover. |
| Save round-trip (optimistic) | UI updates < 16ms; server write < 30ms; total perceived ~16ms because optimistic. | Local-process, no network. |
| Boot indexer read of 10k items | < 1.5s | `Promise.all` + chunked reads (`p-limit` 10). |

If the user grows beyond ~10k items, we hit boot-time and memory-footprint walls. v1.1 considers a SQLite-backed index built from JSON files (see migration plan in `data-model.md` §8). For v1 we accept the ceiling.

---

## 11. Engineering risks for v1

These are the items most likely to cost time, bite us in QA, or force scope cuts.

1. **Calendar + Kanban + Tree all in v1 is significant scope.** Each is a non-trivial component, each with its own a11y contract (calendar grid, kanban list, tree). UX-spec compliance for keyboard + screen reader on all three takes real test time. Per product spec §9.3 #5 — engineering should explicitly assess. The mitigation: **Tree first, then Kanban (per-project, only Tasks), then Calendar.** Calendar drag-to-reschedule **is now cut from v1** per `open-questions.md` §0 (decided 2026-05-18) — v1 reschedules via click → modal. Week view stays in v1; a "Show completed" filter chip is added to v1.

2. **Recurrence math correctness.** Five recurrence frequencies × two anchors × edge cases (Feb 31 → Feb 28; weekly with multi-weekday rule; mid-cycle edits; un-checking a completed recurring instance keeping the next one alive). High test surface; one off-by-one ruins user trust. Mitigation: pure functions in `domain/recurrence.ts` with a thick unit-test suite (~80 cases covering each frequency × edge case). See `data-model.md` §6.

3. **Hierarchy depth-cap enforcement across all paths.** The cap (4 levels) must be enforced in: drag-drop, move-to picker, REST POST, REST PATCH of `parent_id`, and the bulk move. One missed path = corrupted data. Mitigation: centralized in `domain/depth-cap.ts` (server) and `lib/depth-cap-client.ts` (client mirror). Every mutation that changes parent_id MUST call the predicate.

4. **Soft-delete cascade semantics.** Trashing an Epic moves the Epic + Features + Tasks + Subtasks to Trash. Restoring an Epic restores them all. Restoring a Task that was independently trashed before its parent was trashed — does it come back? Per product spec §9.1 #6 the answer is "engineering picks." We pick: **only items whose `trashed_at` was set in the same atomic operation as the parent's restore them with the parent.** Each item carries a `trashed_with: <ulid?>` field that points to the parent it was trashed alongside (null for individually-trashed). Restore-with-parent restores all items whose `trashed_with` equals the parent's id; restore-of-an-orphan restores only itself. Documented in `data-model.md` §3.4.

5. **Multi-day item edge cases in the calendar.** Drag a multi-day span across week boundaries; drag while the user has filter chips active; un-check a multi-day completed task — all must preserve the `start_date / due_date` delta. Has bitten every calendar implementation in history. Mitigation: explicit test cases in `apps/web/test/e2e/calendar-multi-day.spec.ts`.

6. **Atomic write reliability.** `fs.rename` is atomic on POSIX but the tmp-file-then-rename pattern still has corner cases on Windows network drives. Mitigation: on rename failure, log loudly and surface the rollback to the user. Document the recommended local data dir (not a network mount).

7. **The 4-level depth cap conflict with "loose tasks at project root."** A project root → Epic → Feature → Task → Subtask is the 4 levels we count. A project root → Task (loose) → Subtask is 2 levels, fine. But a project root → Feature (loose) → Task → Subtask is 3 in-project levels + 1 subtask = 4 total. The cap counts in-project depth + subtask = 4. The `depth-cap.ts` doc has the explicit formula and is the single source of truth. See `data-model.md` §3.7.

---

## 12. Open questions (UX-resolution)

Each is recorded in detail in `open-questions.md`. Quick decisions captured here:

1. **Single-step undo lives in frontend in-memory.** Locked. Lighter, latency-free, acceptable for the 5s window.
2. **Skeleton threshold (UX commits 300ms).** With local service over localhost, render delays should be < 10ms. Skeletons rarely fire. We keep the 300ms threshold; if a load exceeds it (e.g., first boot indexer build), skeletons appear. Real-world v1 expectation: they almost never appear.
3. **Per-row sync state indicator — DROPPED.** Confirmed. The sidebar's bottom-row sync indicator is also dropped — we don't have sync. The §42 component in the inventory is **not built in v1**. Replaced with a tiny "v1.0 · Local files in <data-dir>" footer for transparency. Documented in `open-questions.md` and `feature-mapping.md`.
4. **Markdown editor: plain textarea + custom keybindings.** Locked. `<textarea>` + ~150 lines of keyboard handlers + `marked`+ `DOMPurify` for render.
5. **Conflict resolution UX — DROPPED.** Single-machine v1. Multi-machine = git merge conflict, user resolves in terminal. The `interaction-patterns.md` §6.5 references are NOT built in v1; the "Changes from another device" snackbar is not implemented.

---

## 13. Headline architectural decisions

1. **Two processes: local Node service + browser UI on `localhost`, JSON files as storage.** Locked. The data directory happens to be a git repo, but Tasko has no git knowledge.
2. **Strict TypeScript everywhere; zod as the single schema source.** `packages/types` exports the schemas; both sides consume.
3. **One file per Item, flat directories.** Maximizes git-merge friendliness; per-entity moves on trash/restore.
4. **In-memory index on the server.** All reads served from memory; writes are atomic to disk + index update + SSE broadcast.
5. **TanStack Query + Zustand + TanStack Router** as the frontend state surfaces.
6. **Linear-style inline editing as the UX default**, modal as the full surface, per locked UX decisions.
7. **Loose hierarchy typing with hard 4-level depth cap.** Items have a `type` field; the only schema-enforced parent rule is "Subtasks attach only to Tasks." Everything else is depth-cap enforced.
8. **Optimistic UI with 5s in-memory undo journal.** Local-first feels instant because it is — there's no network round-trip.
9. **SSE for self-originated cache invalidation (multi-tab support); no filesystem watching.** Self-confirmed writes broadcast; external file changes require manual browser refresh.
10. **Desktop browsers only for v1 QA; mobile CSS ships but is not a release gate.** Locked.
