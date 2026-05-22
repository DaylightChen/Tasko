# Changelog

All notable changes to Tasko will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for software releases. Pre-1.0 (`0.x.y`) means the public API/UX may change between minor versions; breaking changes are documented in their release section.

Note on terminology: "v1" in `docs/` refers to **version 1 of the product spec** (the brainstorm/UX/engineering deliverables produced in the phased-dev pipeline). It is not the same thing as a software version. The software is versioned independently using semver — see `apps/*/package.json`.

## [Unreleased]

_Nothing yet._

## [0.1.0] — 2026-05-22

First public source release of Tasko. Implements the full v1 product spec end-to-end (all 20 phased-dev tasks under `docs/tasks/`) plus a post-task-20 polish sweep that hardened the shipped behavior against real-use bugs surfaced during hands-on testing.

### Added — core product

- Local-first task tracker with optional Epic → Feature → Task hierarchy (4-level depth cap)
- Today, Tomorrow, Next 7 Days, Inbox, All, Trash, Completed smart-list views
- Per-project Tree view and per-project Kanban view (Tasks only — Epics/Features stay in Tree)
- Global Calendar (month + week) with project/tag filter chips
- Per-tag view and Completed view with date-bucketed grouping
- Task modal with title, notes (markdown), date/time, priority, project, parent, tags, subtasks
- Recurrence engine (daily / every-n-days / weekly / monthly / yearly with `on_schedule` / `after_completion` anchor modes; multi-day span preservation; ~80 covered cases)
- Drag-and-drop reordering and re-parenting across Sidebar, lists, tree, and Calendar week (where applicable); Kanban cross-column drag
- Bulk select + bulk actions (complete / move-to / delete) on flat lists and per-kanban-column
- Soft-delete with Trash view (restore / permanent delete / empty trash; project delete cascades to items)
- Single-step undo (5-second snackbar window, ⌘Z)
- Markdown notes (render + edit with ⌘B / ⌘I / ⌘K, Tab/Shift+Tab indent, Enter list continuation)
- Command palette (⌘K) with static commands, dynamic project/tag commands, and tree-context commands
- Hotkey registry with mode stack (T / I / N / O / / / ? / 1–4 in no-input mode; ⌘-modifier shortcuts always available)
- Light / Dark / System theme with WCAG 2.1 AA contrast in both modes
- Reduced-motion + virtualization (`@tanstack/react-virtual`) at documented thresholds
- Server-Sent Events at `/api/events` for multi-tab consistency without polling
- Inline subtask visibility in tree + flat-list views (level-aware indent)

### Added — engineering

- Monorepo: `apps/server` (Fastify 5, Node 20+), `apps/web` (React 19 + Vite + TanStack Router/Query, Zustand), `packages/types` (Zod schemas shared between server and client)
- Flat-JSON store under `<data-dir>` (default `~/Documents/.tasko-data`) with atomic-write (tmp + rename) and a single-writer mutex
- ULID identifiers, Inbox sentinel `00000000000000000000INBOX0`
- REST API at `/api/*` (CRUD for items / projects / folders / tags + bulk endpoints + `/subtasks` endpoints + `/api/events` SSE + `/api/health`)
- The Fastify server now serves the built SPA at `/` via `@fastify/static`, with a SPA fallback for client-side routes (`/today`, `/calendar`, …). `TASKO_SPA_DIR` overrides the auto-discovered web dist location. Auto-discovery tries source-layout (`apps/server/dist → apps/web/dist`) and bundled-release-layout (`<root>/server.js` next to `<root>/web/`).
- Playwright + `@axe-core/playwright` E2E suite (6 representative specs; 11 deferred — see `docs/known-issues.md`)
- GitHub Actions CI (typecheck + lint + test on PR / push to `main`, plus on the release branch and on `v*.*.*` tag pushes)
- GitHub Actions release workflow that runs on `v*.*.*` tag push: builds, runs tests, packages a `tasko-<version>.tar.gz` bundle (server.js + web/ + README + RUN), and publishes a draft GitHub release with the tarball attached and release notes pulled from this CHANGELOG
- Husky pre-push hook (typecheck + lint)
- Bundle: ~203 kB gzipped main chunk; ~1.8 MB single-file ESM server bundle; 26 runtime dependencies (≤35 budget)
- Tests: **1568** passed (`@tasko/types` 35 · `@tasko/server` 389 · `@tasko/web` 1144)

### Fixed — production-mode release blockers (caught during release prep)

- Production server bundle (`apps/server/dist/server.js`) was crashing on `node dist/server.js` with `Error: Dynamic require of "node:events"` because esbuild's CJS-to-ESM conversion of `avvio` (a Fastify dependency) generated unresolved dynamic `require()` calls. Fixed by adding a `--banner:js` shim that exposes a CommonJS-style `require` derived from `import.meta.url`. A second crash from `pino-pretty`'s worker-thread loader (`__dirname is not defined in ES module scope`) was eliminated by baking `process.env.NODE_ENV='production'` into the bundle via esbuild `--define`, which dead-code-eliminates the pretty-print path entirely.
- Production server was returning JSON 404 at `/` instead of the SPA. `@fastify/static` was listed as a dependency but never registered. Fixed (see "Added — engineering" above).
- `setErrorHandler(envelope)` was registered after `@fastify/static`, which caused the static plugin's own error handler to take precedence for routes registered earlier — POST/PATCH validation errors leaked as Fastify default 500 envelopes instead of the project's 400 / `VALIDATION` envelope. Fixed by moving `setErrorHandler` to the top of `buildServer` (called before any route or plugin).

### Configuration

- `--data-dir <path>` / `TASKO_DATA_DIR` — data directory (default `~/Documents/.tasko-data`)
- `--port <n>` / `TASKO_PORT` — server port (default `7373`)
- `--host <addr>` — bind address (default `127.0.0.1`; no auth, do not expose)
- `--init` — create the data directory and Inbox sentinel on first run

### Known limits (v0.1)

See [docs/known-issues.md](docs/known-issues.md) for the full v1.1-spec candidate registry. The highlights:

- Calendar drag-to-reschedule — modal-only in v0.1 (binding cut)
- Multi-step undo — single-step only
- Project restore from Trash — items restore, project record does not
- Tag management UI (rename / delete / merge) — find-or-create only
- Global search — `⌘F` shows a toast directing to `⌘K` or browser find
- Mobile QA — responsive CSS ships, not actively tested
- 11 of 17 planned E2E specs deferred to v1.1 spec (kanban-drag, recurring-monthly, hierarchy-depth-cap, multi-tab-sse, etc. — see known-issues)
- No installer / auto-start / multi-machine sync; manual `git pull` / `git push` on `<data-dir>` is the supported sync workflow

### Distribution

Two install paths:

1. **Prebuilt bundle (recommended for users who just want to run it).** Download `tasko-0.1.0.tar.gz` from the GitHub release page, `tar xzf` it, `cd tasko-0.1.0`, then `node server.js --init` (first run) or `node server.js` (subsequent). Requires Node 20+ only — no pnpm, no build step. Open `http://127.0.0.1:7373`. The bundle's `RUN.md` repeats this.
2. **From source (for development).** `pnpm install && pnpm build && pnpm start -- --init`, then open `http://127.0.0.1:7373`. Requires Node 20+ and pnpm 9. See [README.md](README.md) for full instructions.

### License

[MIT](LICENSE) © 2026 DaylightChen. See `LICENSE` at the repo root or inside the release tarball.

[Unreleased]: https://github.com/DaylightChen/Tasko/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/DaylightChen/Tasko/releases/tag/v0.1.0
