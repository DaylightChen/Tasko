# Tasko

Tasko is a single-user, web-based personal task tracker that combines lightweight TickTick-style daily task management with an optional Epic → Feature → Task hierarchy for the user's larger projects — local-first, with manual git sync, no accounts, no notifications, no clutter.

The **Today view** is the home of the product. Open Tasko, see what is due, what is overdue, and what is in progress on multi-day work, and get through the day.

---

## Quick start

```bash
pnpm install
pnpm --filter @tasko/types build   # build the shared types package first
pnpm build                          # builds server + web
pnpm start                          # starts the server; binds to 127.0.0.1:7373
```

Open http://127.0.0.1:7373 in your browser.

On first run, create the data directory:

```bash
pnpm start -- --init
```

This creates `~/Documents/.tasko-data/` and the built-in Inbox project.

---

## Configuration

| Flag / Env var | Default | Description |
|---|---|---|
| `--data-dir <path>` / `TASKO_DATA_DIR` | `~/Documents/.tasko-data` | Directory where all task data is stored as JSON files |
| `--port <n>` / `TASKO_PORT` | `7373` | Server port. Errors out if taken — no automatic fallback |
| `--host <addr>` | `127.0.0.1` | Bind address. Do not change unless you know what you are doing — v1 has no authentication |
| `--init` | — | Create the data directory and Inbox sentinel on first run |

Example with custom data directory:

```bash
TASKO_DATA_DIR=/home/user/work/tasks pnpm start
```

---

## Data layout

`<data-dir>` is a flat directory of plain JSON files — one file per entity (project, item, folder, tag, config). The filenames are ULIDs.

```
~/Documents/.tasko-data/
  config.json
  projects/
    01HVXXXX....json    # Inbox
    01HVYYYY....json    # My Work Project
  items/
    01HW0000....json
    01HW0001....json
  folders/
  tags/
```

You can read, back up, and version-control these files directly. Tasko itself does not know git.

---

## Multi-device sync

Tasko has no built-in cloud sync. Use git in your terminal to sync your data directory across machines:

```bash
cd ~/Documents/.tasko-data
git init
git remote add origin git@github.com:you/tasko-data.git
git add . && git commit -m "init" && git push -u origin main
```

On another machine:

```bash
git clone git@github.com:you/tasko-data.git ~/Documents/.tasko-data
pnpm start
```

After pulling changes on any machine, refresh the browser (⌘R) to reload data.

---

## v1 limits

See [docs/known-issues.md](docs/known-issues.md) for the full list of deferrals and known limitations, including:

- Calendar drag-to-reschedule — deferred to v1.1 (use click → modal instead)
- Multi-step undo — single-step only in v1
- Mobile QA — CSS ships, not tested on mobile browsers
- No global search — use ⌘K command palette or browser ⌘F

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (hot reload on both server and frontend)
pnpm dev

# Run Vitest unit tests
pnpm test

# Run E2E tests (requires dev server running in another terminal)
pnpm test:e2e

# TypeScript typecheck (all packages)
pnpm typecheck

# Biome lint
pnpm lint

# Biome format
pnpm format
```

### E2E tests

The Playwright E2E suite requires the dev server to be running before tests execute:

```bash
# Terminal 1
pnpm dev

# Terminal 2
pnpm test:e2e
```

The test suite runs on Chromium only. See `apps/web/playwright.config.ts` for configuration.

### Manual smoke test checklist

Before releasing, verify the following manually:

- [ ] `pnpm install && pnpm build && pnpm start -- --init` completes without errors
- [ ] `http://127.0.0.1:7373` loads the app; first-run empty state shows "Welcome to Tasko."
- [ ] Create a project (hierarchical). Add an Epic + Feature + 2 Tasks. Add a subtask on one.
- [ ] Today view shows the Tasks (due today). Complete one → animation + snackbar → Undo within 5s → row returns.
- [ ] Open Calendar → today's cell is accent-filled; multi-day items render as a bar.
- [ ] Settings: switch to Dark theme → repaints. Switch to System → reverts to OS preference.
- [ ] Quit with Ctrl+C. Restart `pnpm start`. Verify data persists.
- [ ] `curl http://127.0.0.1:7373/api/health` returns 200.

---

## Architecture overview

- **Server:** Node.js + Fastify, serves the built SPA at `/` and the API at `/api/*`. No database — data is flat JSON files with atomic writes (write to temp + rename).
- **Frontend:** React 19 + Vite SPA, TanStack Router, TanStack Query, Zustand stores, `@dnd-kit` for drag-and-drop.
- **Packages:** `@tasko/types` — shared Zod schemas for items, projects, recurrence rules, SSE events.
- **SSE:** Server-Sent Events at `/api/events` keep multiple browser tabs consistent without polling.

Stack picks are documented in `docs/engineering/2026-05-18-architecture.md`.

---

## License

TBD — the author has not chosen a license yet.
