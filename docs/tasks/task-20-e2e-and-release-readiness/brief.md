# Task 20 — E2E hardening + Biome lint sweep + bundle audit + README + known-issues

## Goal

Cross the v1 finish line: write the full Playwright E2E suite enumerated in `frontend-architecture.md` §19.2, run a final Biome lint sweep + ensure formatting is consistent across the entire codebase, audit the production bundle size, write the `README.md` with the run instructions + binding-resolution highlights, and create `docs/known-issues.md` documenting every deferral from the implementation plan. The release artifact at the end of this task: a green CI run + a runnable production build.

## Context files

- `docs/engineering/2026-05-18-frontend-architecture.md#19-2-playwright-e2e` — the canonical list of E2E scenarios (today-overdue, recurring-monthly, hierarchy-depth-cap, kanban-drag, calendar-multi-day-drag — though drag is CUT so this becomes click-to-modal-reschedule, quick-add-no-project, undo-5s, multi-tab-sse).
- `docs/engineering/2026-05-18-feature-mapping.md#21-v1-risk-grid--priority-ordered-` — the risks; each should have an E2E covering it.
- `docs/engineering/2026-05-18-architecture.md#7-build--dev-workflow`, §8 deployment — `pnpm install`, `pnpm build`, `pnpm start`, distribution model (source).
- `docs/engineering/2026-05-18-architecture.md#1-3-dependency-count-budget` — runtime deps ≤ 35; budget audit.
- `docs/engineering/2026-05-18-feature-mapping.md#23-out-of-scope-summary--v1-` — the deferral list source.
- `docs/engineering/2026-05-18-open-questions.md#0-binding-resolutions-user-2026-05-18` — every binding resolution to document in README + known-issues.
- The plan's "Explicit deferrals" section in `docs/plan/implementation-plan.md` — every deferral row maps to a `known-issues.md` entry.

## Downstream dependencies

This is the last task — no downstream dependencies. The completion of this task marks v1 ready for daily use.

## Steps

1. **Playwright config** — `apps/web/playwright.config.ts`:
   - `webServer`: start the server + the web in production mode (`pnpm build` then `pnpm start` with a fresh temp data dir). Use `playwright.config`'s `webServer` to manage lifecycle.
   - Browsers: Chromium + WebKit (desktop only per locked decision).
   - `testDir: 'test/e2e'`. Parallel: serial by default for tests that share the server (each test seeds + tears down its data via the API).
   - `expect.timeout: 5000` for assertions.
   - Reporter: `html` + `list`.
2. **Test fixtures** — `apps/web/test/e2e/_helpers/`:
   - `setup.ts` — fixture that, for each test, POST a known set of items via the API before the page navigates.
   - `cleanup.ts` — DELETE everything (POST /api/trash/empty + DELETE every active item) after each test.
   - OR per `playwright.config`: spawn the server with a different `--data-dir` per test (a `mkdtemp` per test). Cleaner for isolation. Decision: per-test temp data dir, with the webServer config dynamically picking the dir per test. Implement via a Playwright `globalSetup` that creates a temp dir per worker.
3. **E2E suite** — `apps/web/test/e2e/`:
   - `today-overdue.spec.ts`: per `code-architecture.md` §5.4 — seed 3 overdue items via POST /api/items, navigate to /today, assert "Overdue (3)" visible, click "Move all overdue to today", confirm prompt, assert the strip disappears + all 3 items in the Today section, click Undo within 5s, assert the 3 are back in Overdue.
   - `recurring-monthly.spec.ts`: create a monthly day=15 recurring task with due 2026-05-15 + anchor on_schedule. Mock the server's date (or just verify via API: POST /api/items with status=done, assert response `{completed, next}` with `next.due_date === '2026-06-15'`).
   - `hierarchy-depth-cap.spec.ts`: build Epic → Feature → Task → Subtask. Attempt to add a Feature as a child of the inner Task → server returns 409 DEPTH_CAP. Attempt via drag in the tree → reject visual + assertive snackbar.
   - `kanban-drag.spec.ts`: hierarchical project with 3 To Do Tasks. Switch to Kanban view. Drag a card from To Do to In Progress → status mutates. Drag to Done → completion snackbar with Undo.
   - `calendar-reschedule-modal.spec.ts` (replaces the originally-planned drag test per binding decision §1.1): seed a single-day task on May 18; navigate to /calendar/month; click the event chip → Task modal opens with the right due_date; change due_date to May 22; Save → event moves to May 22 in the calendar grid.
   - `calendar-multi-day-modal.spec.ts`: seed a multi-day item start May 18, due May 22. Verify the bar spans 5 days. Click → modal → change due_date to May 25 → bar now spans May 18–25 (start preserved). Per spec §7.4, the start-to-due delta is preserved on recurrence; on manual edit, the user picked due 25 — the start remains 18 (since only due was changed). Verify.
   - `multi-tab-sse.spec.ts` (from task-17): open two browser contexts; create in A → appears in B within 1s; edit title in B → appears in A.
   - `quick-add-no-project.spec.ts`: from /today, type "X" in quick-add + Enter → modal opens; click Save without picking a project → validation error "Pick a project." inline; field gets focus.
   - `undo-5s.spec.ts`: complete a task → snackbar with Undo for 5s. Click Undo within window → task reverts. Repeat: complete + wait 6s → Undo button gone.
   - `parent-completion-blocking.spec.ts`: task with 3 incomplete subtasks; check the parent → ConfirmationPrompt body says "This task has 3 incomplete subtasks. Completing it will mark them all done."; Confirm → all 4 (parent + 3 subtasks) done.
   - `tag-create-and-apply.spec.ts`: in modal, type "urgent" in Tags field → "Create 'urgent'" suggestion → Enter → tag created; save task. Open another task, type "URGENT" → matches existing case-insensitively → suggestion shows existing tag with its preserved casing.
   - `trash-cascade-and-restore.spec.ts`: delete an Epic with 3 descendants → all in trash; restore the Epic → all 4 return.
   - `theme-switch.spec.ts`: from /settings, click Dark radio → `document.documentElement.dataset.theme === 'dark'`; click System → matches `prefers-color-scheme` (mock).
   - `quick-add-project-context-exception.spec.ts`: navigate to a project's Tree view; click "+ Add Task" inside a Feature → modal opens with `project_id` AND `parent_id` pre-filled (the destination-context exception per §9.4 #8). Confirm via DevTools / the project select shows the project.
   - `command-palette.spec.ts`: open palette via Mod+K; type "today" → "Go to Today" highlighted; Enter → navigates. Verify "Go to <Project>" dynamic commands appear.
   - `keyboard-help.spec.ts`: press `?` → help overlay; press `?` again → dismisses.
4. **Biome lint sweep** — at the repo root, run `pnpm format` then `pnpm lint`. Resolve every reported issue. Common cleanups:
   - Unused imports.
   - Inconsistent quote style (Biome enforces single quotes per `biome.json` from task-01).
   - Missing trailing commas.
   - Inconsistent indentation.
   - `noUnusedImports` rule violations.
   Commit the formatting changes as a clearly-scoped change.
5. **Bundle audit** — after `pnpm --filter @tasko/web build`:
   - Print bundle sizes per chunk via `vite build` output. Expected: `vendor-react` ~150kB gzipped, `vendor-tanstack` ~80kB gzipped, `vendor-dnd` ~40kB gzipped, `vendor-markdown` ~50kB gzipped (marked + DOMPurify), app code ~250kB gzipped. Total ~600-700kB gzipped target.
   - If any chunk is unexpectedly large, investigate. Run `npx vite-bundle-visualizer` (or `rollup-plugin-visualizer` added to dev deps) to find the culprit.
   - Verify `dependencies` runtime list (`apps/web/package.json` + `apps/server/package.json` + `packages/types/package.json`) sums to ≤ 35 packages per architecture.md §1.3.
6. **README.md** — at the repo root:
   - Project name + one-paragraph elevator pitch from `product-spec.md`.
   - **Quick start**:
     ```bash
     pnpm install
     pnpm --filter @tasko/types build
     pnpm build           # builds server + web
     pnpm start           # starts the server; binds to 127.0.0.1:7373
     # In your browser: open http://127.0.0.1:7373
     ```
   - **Configuration**:
     - `--data-dir <path>` or `TASKO_DATA_DIR` — default `~/Documents/.tasko-data` (per binding resolution).
     - `--port <n>` or `TASKO_PORT` — default 7373. Server errors out if taken; no fallback.
     - `--host <addr>` — default 127.0.0.1; don't change unless you know what you're doing (no auth in v1).
     - `--init` — create a fresh data dir + Inbox sentinel.
   - **Data layout**: brief explanation that `<data-dir>` is a flat directory of per-entity JSON files; users CAN treat it as a git repo. Tasko itself does not know git — users run `git pull`/`git push` manually.
   - **Multi-device** (the binding-resolution sentence): "Tasko has no built-in cloud sync. Use git in your terminal to sync your data dir across machines."
   - **v1 limits** (link to `docs/known-issues.md`).
   - **Development**: `pnpm dev` (concurrently runs server + Vite); `pnpm test`; `pnpm test:e2e`; `pnpm typecheck`; `pnpm lint`.
   - **License**: TBD (placeholder; user picks).
7. **known-issues.md** — `docs/known-issues.md`:
   - Header: "Known issues and v1.1+ candidates".
   - For each row in the implementation plan's "Explicit deferrals" table, write a short entry:
     - **Title** (e.g., "Calendar drag-to-reschedule").
     - **Status**: deferred to v1.1.
     - **Why**: brief one-line rationale.
     - **Reference**: link to the binding-resolution or upstream spec section.
     - **Workaround in v1**: how the user accomplishes the related task in v1 (e.g., "Reschedule via click → modal → pick new date.").
   - Group by category: "Cut from v1", "Mobile (ships, not QA-targeted)", "Sync / multi-machine", "Convenience features", "Out of scope forever".
8. **Project conventions doc** — `apps/web/CLAUDE.md` and `apps/server/CLAUDE.md` if needed: brief notes on the conventions established. Skip if redundant with the engineering specs. (Optional.)
9. **Final smoke test** — manual:
   - `rm -rf /tmp/tasko-smoke && pnpm install && pnpm build && TASKO_DATA_DIR=/tmp/tasko-smoke pnpm start --init`.
   - Open `http://127.0.0.1:7373`.
   - First-run empty state: "Welcome to Tasko." (warm flourish #2).
   - Create a project (hierarchical). Add an Epic + Feature + 2 Tasks. Add a subtask on one.
   - Today view shows the Tasks (due today). Complete one → animation + snackbar → Undo within 5s → row returns.
   - Open Calendar → today's accent-filled cell + the multi-day item rendering.
   - Settings: switch to Dark theme → repaints. Switch to System → reverts to OS preference.
   - Quit with Ctrl+C. Restart `pnpm start`. Verify data persists (the JSON files are in `/tmp/tasko-smoke/`).
10. **CI workflow** — `apps/.github/workflows/ci.yml` (or `.github/workflows/ci.yml` at repo root):
    - Trigger: pull_request + push to main.
    - Steps: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @tasko/web test:e2e`.
    - Cache pnpm store + Playwright browsers.
    - Don't actually push to a public repo — this is a v1 local-only project. Drop CI if unwanted; skip the GitHub workflow if the user hasn't asked for CI.
    
    **Decision**: include the CI workflow as a skeleton for future use. If the user doesn't host on GitHub, it's a no-op file.
11. **Final verification**:
    - `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` — all green at the repo root.
    - `pnpm build` produces `apps/server/dist/server.js` + `apps/web/dist/` static bundle.
    - `pnpm start` runs the production build.
    - Open the URL → app loads.

## Acceptance criteria

- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm typecheck` reports 0 errors across all 3 packages.
- [ ] `pnpm lint` reports 0 issues.
- [ ] `pnpm format` is a no-op (everything formatted).
- [ ] `pnpm test` — all Vitest tests pass.
- [ ] `pnpm test:e2e` — every spec in step 3 passes.
- [ ] `pnpm build` produces production artifacts; bundle size summary printed; total app bundle ≤ ~700kB gzipped.
- [ ] Runtime dependency count audit: `cat apps/server/package.json apps/web/package.json packages/types/package.json | jq '.dependencies | keys[]' | sort -u | wc -l` returns ≤ 35.
- [ ] `pnpm start` brings up the production server; `curl http://127.0.0.1:7373/api/health` returns 200.
- [ ] Browser opens to the app; first-run empty state shows warm flourish #2.
- [ ] Full manual smoke test per step 9 passes.
- [ ] `README.md` exists with the run instructions + binding-resolution highlights.
- [ ] `docs/known-issues.md` exists with one entry per deferral from the plan's "Explicit deferrals" table.

## Output files

- Created:
  - `apps/web/test/e2e/_helpers/setup.ts`, `cleanup.ts`
  - `apps/web/test/e2e/*.spec.ts` (every spec listed in step 3)
  - `apps/web/playwright.config.ts` (if not already shipped)
  - `README.md` (rewrites the placeholder from task-01)
  - `docs/known-issues.md`
  - `.github/workflows/ci.yml` (optional)
- Modified:
  - Any files touched by Biome formatting sweep.
  - `apps/web/package.json` — add `rollup-plugin-visualizer` to dev deps if used.
  - `apps/web/vite.config.ts` — confirm the chunk-splitting config from task-01 is final.
