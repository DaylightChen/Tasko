---
title: Tasko — Architecture Exploration Log
date: 2026-05-18
phase: engineering
scope: project
status: draft
---

# Tasko — Architecture Exploration Log

Rejected alternatives and the trade-offs that led to the chosen design. This is the "why not X" doc; the canonical "what we do" is `architecture.md`.

Each entry: what we considered, what we picked, why.

---

## 1. The macro architecture

### 1.1 Pure browser-only (IndexedDB / SQLite-in-WASM)

**The shape**: A static site (CDN-hosted). User opens it; data lives in IndexedDB or a SQLite-in-WASM blob in OPFS. Sync via a backend service that the user signs into.

**Why we did NOT pick this**:
- The product's locked architecture is "JSON files in a git directory" as the backup story. IndexedDB blobs are opaque; they don't `git diff`.
- The user explicitly said "this is not for human reading" — but they also chose a git-friendly format, which is a per-entity JSON file the user could in fact read if they wanted to. The two-process model serves the git ergonomics, not the readability.
- Cross-machine sync via a centralized service requires auth, which is explicitly rejected (no users, no accounts).

### 1.2 Single embedded SQLite file

**The shape**: A Node service plus `better-sqlite3` with a single `tasko.db` file. The user backs up that file.

**Why we did NOT pick this**:
- A single SQLite file is a binary blob. `git diff` on a SQLite change is meaningless; merge conflicts in a binary file are unresolvable.
- The user's locked decision is "user manages git manually." For git to be useful, the on-disk format must be merge-friendly.
- The performance argument for SQLite (indices, queries) doesn't pay back at the scale we target (≤ 10k items). An in-memory index over JSON files is comfortable.

**When we'd revisit**: v1.x if user scale grows past 10k items and JSON-file boot becomes a real perf wall. SQLite can be added as a derived cache (build from JSON files on boot) without changing the on-disk format.

### 1.3 Two-process with WebSocket sync

**The shape**: Same as locked, but use WebSockets for full bidirectional events between server and frontend.

**Why we did NOT pick this**:
- We don't need bidirectional. The frontend talks to the server via REST; the server only pushes events to the frontend (one-way). SSE is exactly this shape with less complexity than a WebSocket protocol.
- WebSockets need keepalive handling, framing, reconnect logic. SSE has it built into the browser.

**When we'd revisit**: if v1.x adds a feature that requires the frontend to push events outside of REST (e.g., a presence indicator). Not foreseeable in v1.

### 1.4 No service, just CLI + browser file:// URL

**The shape**: A CLI that's a static-site bundler + JSON file watcher. The user opens `file:///path/to/tasko/index.html` in their browser. All persistence is via... browser-side fs access (with the File System Access API).

**Why we did NOT pick this**:
- File System Access API is Chromium-only as of late 2025; Firefox and Safari don't support it.
- The user said "regular browser" — we don't want to lock to Chromium.
- Cross-origin restrictions on `file://` URLs are inconsistent.

### 1.5 Tauri / Electron desktop app

**The shape**: A native-shell desktop app that wraps the Node service and the React UI in one binary.

**Why we did NOT pick this in v1**:
- Single-binary distribution adds significant packaging overhead.
- v1's "user runs `pnpm start` and opens browser" is fine; we don't need the windowing.
- Tauri's Rust requirement adds toolchain complexity.

**When we'd revisit**: v1.1+. Tauri is the most promising path because of small bundle size and good cross-platform story. It would also enable a system tray / dock icon / "always-on" UX.

---

## 2. The frontend framework

### 2.1 Vue / Svelte / SolidJS

**Why we did NOT pick these**:
- The user has no preference; React 19 is the safe default and the largest ecosystem.
- The UX spec doesn't pull on any feature unique to those frameworks.
- TanStack Query / Router / Virtual all have first-class React support.

### 2.2 Next.js

**Why we did NOT pick it**:
- We are NOT building an SSR app. The frontend is a SPA that runs in the user's local browser, served by our own Node process. Next.js's server-rendering, RSCs, image optimization, etc. are all out of scope.
- Vite + React + TanStack Router is the lean equivalent.

---

## 3. State management

### 3.1 Redux Toolkit + RTK Query

**Why we did NOT pick it**:
- TanStack Query has the same superset of features with less ceremony.
- Zustand for UI state is lighter than slices.

### 3.2 Jotai (atom-based)

**Why we did NOT pick it**:
- Fine alternative. We picked Zustand because the boilerplate is lower for our store count (~8). Jotai's atom-graph composition is a strength we don't lean on.

### 3.3 React Query alone (no Zustand)

**Why we did NOT pick it**:
- React Query is for server-state. Command palette open state, snackbar queue, hotkey mode stack, multi-select set — these are not server state. Forcing them into RQ "store" patterns is awkward.
- Pure `useState` + `useContext` would also work but is more prop-drilling at our scale.

### 3.4 Effect / Effect-TS

**Why we did NOT pick it**:
- Steep learning curve relative to the team's likely familiarity.
- The win from typed effects is real but the cost is a paradigm shift.

---

## 4. Routing

### 4.1 React Router 6.x

**Why we did NOT pick it**:
- TanStack Router has typed routes and typed search params; React Router is mostly typed but the search-param API requires manual schemas.
- We rely on typed search params for filter chips.
- React Router is more mature / bigger ecosystem; not a deciding factor for a personal app.

### 4.2 Wouter (tiny router)

**Why we did NOT pick it**:
- Too small. No typed routes, no nested route loaders, no preloading.

---

## 5. Drag-and-drop

### 5.1 react-beautiful-dnd

**Why we did NOT pick it**:
- Unmaintained as of 2024.

### 5.2 react-dnd

**Why we did NOT pick it**:
- Older API, less ergonomic with React 19, weaker a11y story.

### 5.3 Roll our own

**Why we did NOT pick it**:
- Drag is complex (a11y, keyboard, screen reader announcements, multi-target). Rolling our own would cost 4+ weeks for parity with dnd-kit.

### 5.4 Why dnd-kit

- a11y-first (built-in `useKeyboardSensor`, screen reader announcements).
- React 19 compatible.
- Modular (we import `@dnd-kit/core` + `@dnd-kit/sortable`, not the whole library).
- Active maintenance.

---

## 6. Markdown editor for the Notes field

### 6.1 CodeMirror 6

**Why we did NOT pick it**:
- ~250kB minified. We're saving the bundle.
- The locked pre-decision is "plain textarea."
- Markdown notes are a low-frequency field; a heavy editor doesn't pay back.

### 6.2 ProseMirror / Lexical / Slate

**Why we did NOT pick them**:
- Same as CodeMirror — heavy for our use case.
- Lexical (Meta's editor) is a 100kB+ peer dep.

### 6.3 Why plain textarea + custom keybindings + marked

- ~150 LOC for keybindings.
- ~30kB for marked + DOMPurify (acceptable; marked is the smallest viable markdown renderer).
- Editing UX is identical to typing in any other textarea — predictable.

---

## 7. Date picker

### 7.1 Roll our own with @floating-ui

**Why we did NOT pick it**:
- The UX spec's date picker has rich behavior (today highlight, disabled dates, locale weekday header, quick-select, keyboard nav per WCAG). Re-implementing is ~600 LOC.
- A maintained library does this for us.

### 7.2 React-datepicker / mui

**Why we did NOT pick them**:
- React-datepicker is large + a11y story is OK but not great.
- MUI is a whole component library we don't want.

### 7.3 Why react-day-picker

- a11y-tested per WCAG.
- Customizable enough for our quick-select row.
- 30kB, no peer dependencies on a bigger system.

---

## 8. Backend framework

### 8.1 Express

**Why we did NOT pick it**:
- TS types are weaker (require @types/express).
- zod integration is more boilerplate (custom middleware).
- The "Express is everywhere" argument doesn't matter when our REST surface is ~20 routes.

### 8.2 Hono

**Why we did NOT pick it**:
- Lovely runtime-agnostic framework, but our target IS Node, so the abstraction doesn't pay back.
- Smaller ecosystem of plugins (rate-limit, sensible, etc.) than Fastify.

### 8.3 Why Fastify

- Schema validation built-in with JSON schemas (we use zod, but Fastify's schema-mode pre-validates inputs natively if needed).
- TS types are first-class.
- ~30% faster than Express in synthetic benchmarks (doesn't matter on localhost but doesn't hurt).
- Active maintenance.

---

## 9. ID strategy

### 9.1 UUID v4

**Why we did NOT pick it**:
- Not sortable. Directory listings of `items/` would be random-order.
- Git diff for renames doesn't benefit.

### 9.2 nanoid

**Why we did NOT pick it**:
- Smaller than UUID, but also not sortable.

### 9.3 Sequential integers (1, 2, 3, ...)

**Why we did NOT pick it**:
- Coordination problem: two devices both create item #5. With ULID, both have unique IDs.
- Even on single-machine v1, the multi-tab case has the same issue (Tab A's create races with Tab B's create).

### 9.4 Why ULID

- 26 chars, lexicographically sortable by creation time.
- URL-safe.
- 1.21e+24 randomness in the trailing portion — collision risk vanishes.
- Sortable IDs mean a `git log` of an `items/` directory is roughly chronological — a nice ergonomic.

---

## 10. Schema validation

### 10.1 io-ts

**Why we did NOT pick it**:
- Higher learning curve than zod.
- Smaller ecosystem of integrations.

### 10.2 Yup / Joi / class-validator

**Why we did NOT pick them**:
- Yup / Joi are older designs without zod's TS-first-class types.
- class-validator requires decorators and class instances; zod's plain-object approach is friendlier for JSON.

### 10.3 valibot

**Why we did NOT pick it** (close call):
- Smaller bundle than zod, similar API. Acceptable alternative.
- We pick zod for ecosystem maturity (more middleware, more SO answers).

### 10.4 Why zod

- TypeScript-first; `z.infer<typeof X>` gives us a typed schema for free.
- One source of truth for: request bodies (server), response bodies (frontend), on-disk file contents (server parse), TS types (both sides).
- Active maintenance.

---

## 11. Storage layout

### 11.1 One big `items.json` array

**Why we did NOT pick it**:
- Worst-case git merge surface: every edit modifies the same file. Two devices editing different items = merge conflict on the same lines.
- Reading the file is O(N) on every load; writing is O(N) (we'd have to rewrite the whole file even for one item change). Per-item files are O(1).

### 11.2 SQLite (covered above)

### 11.3 One file per project, with items inlined

**Why we did NOT pick it**:
- A user with a 500-item project has a 500-item file. Same problem as 11.1 at project scale.
- Cross-project moves become two-file edits.

### 11.4 Why one file per Item, flat `items/` directory

- Best git-merge friendliness: per-item edits, per-item diff lines, per-item rename detection.
- O(1) read of a single Item; O(N) initial indexer build amortized to boot cost only.
- The cost (more inodes, slightly slower `ls`) is acceptable up to ~5k items per directory.

### 11.5 Subtasks: separate dir vs inlined

**Why we picked inlined**:
- Per product spec, subtasks have no independent lifecycle (no `due_date`, etc.). They cascade with the parent.
- The 3-10 subtasks per Task don't bloat the parent file.
- Avoids the separate-file complexity for a type that doesn't earn it.

**Trade-off accepted**: A single subtask check toggles the parent's `updated_at` and writes the parent file. Two devices toggling different subtasks of the same Task would merge-conflict on the parent file. (Single-machine v1 doesn't care.)

---

## 12. SSE: ship or not in v1?

### 12.1 Don't ship: rely on `refetchOnWindowFocus`

**Pro**: Less code (~110 lines).
**Con**: Multi-tab inconsistency until the user clicks back into a tab. With a service that responds in milliseconds, the user might notice.

### 12.2 Ship SSE

**Pro**: Multi-tab consistency is "live." Two tabs feel like one.
**Con**: ~110 lines + a reconnect / error path.

**Picked**: Ship. The implementation cost is bounded; the UX win for the multi-tab case is real (the user opens Tasko in two tabs at least sometimes).

---

## 13. CSS strategy

### 13.1 Tailwind

**Why we did NOT pick it**:
- Atomic classes don't beat CSS Modules + tokens for our component-driven approach.
- The token system in `design-language.md` is small enough to map cleanly to CSS custom properties.
- Tailwind's bundle (even with PurgeCSS) is meaningful for a small app.

### 13.2 styled-components / Emotion

**Why we did NOT pick them**:
- Runtime CSS-in-JS has a small but real perf cost.
- React 19 + emotion has some integration friction.
- Tokens in CSS custom properties are simpler.

### 13.3 vanilla-extract

**Why we did NOT pick it** (close call):
- Zero-runtime CSS-in-TS, type-safe tokens. Lovely.
- We pick CSS Modules because the simpler "two files per component" structure is faster to teach.

### 13.4 Why CSS Modules + tokens

- Zero runtime cost.
- Per-component isolation (no class-name collisions).
- Tokens as CSS custom properties enable instant theme switching without React re-renders.
- Familiar to anyone who's done CSS.

---

## 14. The pulse of the file-watch question

This is one of the engineering risks the user surfaced (chokidar in/out). The exploration:

### 14.1 No file watching at all

**Pro**: Simpler code; no library dep.
**Con**: If we don't watch our own writes (for cache consistency), we have to trust that every write succeeds and that our in-memory index is correct after each write. We DO have to do that anyway because every write goes through our mutex + write-then-update-index pattern. So no chokidar needed.

### 14.2 chokidar to detect external file changes (e.g., user git pulls)

**Pro**: The app auto-updates after a git pull.
**Con**: The locked decision says NO — user manually refreshes. Building this complicates the cache-consistency story (the index is now mutable from outside the server).

### 14.3 chokidar internally as a safety net only

**Pro**: Detects if our own atomic-write succeeded; can log / alert on inconsistency.
**Con**: Possibly fragile across OSes; possibly overkill if our write pattern is correct.

**Picked**: Option 14.1 by default. If we add chokidar (option 14.3), it's pure logging / safety net. If chokidar proves fragile, we drop it.

---

## 15. Auth / port binding

### 15.1 Bind to 0.0.0.0 with a shared secret

**Why we did NOT pick it**:
- Adds auth machinery (a header, a secret-storage prompt, rotation).
- v1 has no need to be reachable from another device on the LAN. The user is at their machine.

### 15.2 Bind to 127.0.0.1, no auth

**Picked.** The OS-level "only this machine can reach the port" is sufficient.

**Future**: v1.1+ may add an opt-in `--bind 0.0.0.0 --token <abc>` flag for LAN use. Documented in `open-questions.md`.

---

## 16. Process management

### 16.1 launchd / systemd / Windows Service templates

**Why we did NOT pick it (v1)**:
- Locked decision: manual `pnpm start` only.
- Platform-specific templates add docs and surface area.

### 16.2 PM2 / Forever

**Why we did NOT pick it**:
- The user's machine is single-user. Adding a daemon manager is overkill.

### 16.3 Why manual

- Simplest possible v1.
- The user opens a terminal, runs the command, opens the browser. Same flow as `npm run dev` for a frontend dev.

---

## 17. Tests

### 17.1 Jest

**Why we did NOT pick it**:
- Vitest is the modern Vite-native equivalent. Faster, native ESM.
- Same test API (`describe`, `it`, `expect`).

### 17.2 Cypress for E2E

**Why we did NOT pick it**:
- Playwright is the modern equivalent. Better parallelism, native multi-browser.
- Cypress is fine; not a deal-breaker.

### 17.3 Why Vitest + Playwright

- Same toolchain front + back.
- Vite's HMR + Vitest's watch mode + Playwright's UI mode = excellent feedback loop.

---

## 18. Lint + format

### 18.1 ESLint + Prettier

**Why we did NOT pick it**:
- Biome replaces both with a single tool.
- ESLint config drift (typescript-eslint, eslint-plugin-react, etc.) is real.

### 18.2 Why Biome

- One tool, one config.
- ~10× faster than ESLint.
- TypeScript-native (no parsing pipeline).
- Active maintenance.

---

## 19. The rejected "data dir is a separate workspace" idea

We considered: make the data directory a workspace pattern, like `packages/data/`, so that the user clones the repo + their data is right there.

**Why we did NOT pick it**:
- The data directory location is a user choice — they want it under their personal cloud-synced folder, not in the source repo.
- Mixing source + data complicates `.gitignore` and accidental commits of personal data into the source repo.
- The user runs Tasko against an external data dir; the source repo is just code.

---

## 20. The rejected "PWA / offline support" path

**Why we did NOT pick it**:
- The frontend is **always** running against a local server. There's no "offline" — if the server is up, you have data; if it's down, you have no app.
- A service worker doesn't help here (cf. a typical cloud SaaS where SW caches the SaaS shell).

**v1.1+**: if we add mobile, PWA install affordance becomes valuable (so the user can open Tasko as a standalone app). But not before the mobile QA target.

---

## Final word

These rejections are not "we'd never do this." They are "we don't do this for v1 given the locked scope." Each has an "if we did this later, here's the migration path" implied. The doc shows the trade-off space so a future engineer can make informed changes.
