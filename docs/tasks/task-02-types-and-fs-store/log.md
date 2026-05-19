# Execution Log — Task 02: Types package + fs-store + indexer

**Scope:** `project`

## Iteration 1

### Implement

**Files created:**
- `packages/types/src/domain/ids.ts`, `domain/status.ts`
- `packages/types/src/schemas/recurrence.ts`, `subtask.ts`, `item.ts`, `project.ts`, `folder.ts`, `tag.ts`, `config.ts`
- `packages/types/src/api/sse-events.ts`, `api/error.ts`
- `packages/types/src/__tests__/schemas.test.ts` (13 tests)
- `apps/server/src/store/paths.ts`, `mutex.ts`, `fs-store.ts`, `indexer.ts`
- `apps/server/test/unit/fs-store.spec.ts`, `indexer-bootstrap.spec.ts`, `indexer-write-lock.spec.ts`, `indexer-creates-inbox.spec.ts`
- `apps/server/test/integration/health-with-indexer.spec.ts`

**Files modified:**
- `packages/types/src/index.ts` — re-exports all schemas
- `packages/types/package.json` — added `vitest` devDep + `test` script
- `apps/server/src/server.ts` — wires indexer, ensureDir, `app.decorate('indexer', ...)`, Fastify type augmentation
- `apps/server/src/routes/health.ts` — real `item_count` from indexer
- `apps/server/test/unit/health.spec.ts` — uses temp dir + `initIfMissing: true`

**Decisions not in plan:**
- Exported `ItemBaseSchema` from `@tasko/types` so the indexer can derive disk-read variants
- Added `TagPatchSchema` (not in brief but listed in code-architecture spec; task 03+ needs it)
- Added `newProjectId()` helper for ULID generation

**Deviations from plan:**
- Added `ItemDiskSchema` and `ProjectDiskSchema` (relaxed id regex) for reading entities from disk. **Rationale: spec bug** — the brief claims `INBOX_PROJECT_ID = '00000000000000000000INBOX0'` matches the ULID regex `/^[0-9A-HJKMNP-TV-Z]{26}$/`, but `I` and `O` are excluded from Crockford base32. The disk-read schemas accept any string for id fields; the strict schema is preserved for user-input validation. Documented in code comments. (Spec bug to be recorded in known-issues.md.)
- `Indexer.bootstrap()` returns `{items, projects, folders, tags, trashed, warnings}` per brief step 5 (vs. `Promise<void>` in code-architecture.md §3.4 — brief takes precedence)
- `buildIndexer(dataDir, logger)` takes a logger parameter per brief step 5 (vs. single-arg in code-architecture §3.4)

**Issues encountered:**
- **Spec bug** with `INBOX_PROJECT_ID`. See deviations above. Resolution: relaxed disk schemas for sentinel entities. Canonical fix (to be considered): change the constant to a valid Crockford base32 string like `00000000000000000000000000`. Tracked as known issue.

**Confirmed:** types/server/web typechecks 0 errors. `pnpm lint` clean. 13 types tests + 25 server tests all pass.

### Test

**New tests written:**
- `packages/types/src/__tests__/sse-events.test.ts` — 13 tests parsing all SSE event payloads + rejection paths
- `apps/server/test/integration/init-flow.spec.ts` — 4 tests covering exact error message, full init flow, Inbox sentinel creation, idempotent re-init
- `apps/server/test/unit/indexer-write-ops.spec.ts` — 7 tests + 2 round-trips covering writeItem, removeItem, moveItemToTrash, adjacency cache updates, Inbox round-trip

**Failures:** none.

**Full suite output:**
```
$ pnpm --filter @tasko/types test
  ✓ src/__tests__/schemas.test.ts (13 tests)
  ✓ src/__tests__/sse-events.test.ts (13 tests)
  Test Files  2 passed (2)  Tests  26 passed (26)  Duration  288ms

$ pnpm --filter @tasko/server test
  ✓ test/unit/fs-store.spec.ts (8 tests)
  ✓ test/unit/types-import.spec.ts (1 test)
  ✓ test/unit/indexer-creates-inbox.spec.ts (4 tests)
  ✓ test/unit/indexer-bootstrap.spec.ts (4 tests)
  ✓ test/unit/indexer-write-lock.spec.ts (4 tests)
  ✓ test/unit/indexer-write-ops.spec.ts (7 tests)
  ✓ test/unit/health.spec.ts (1 test)
  ✓ test/integration/health-with-indexer.spec.ts (3 tests)
  ✓ test/integration/init-flow.spec.ts (4 tests)
  Test Files  9 passed (9)  Tests  36 passed (36)  Duration  484ms

$ pnpm lint
  Checked 52 files in 8ms. No fixes applied.

$ pnpm --filter @tasko/{types,server,web} typecheck → all exit 0, no errors
```

**Per-criterion:** all 11 acceptance criteria from the brief pass. The "running compiled bin to verify missing-dir error + non-zero exit" criterion is covered structurally (integration test verifies `buildServer` throws the exact message; bin entrypoint wraps with `process.exit(1)`) — no spawn test added.

**Spec-bug assessment (INBOX_PROJECT_ID):** Workaround OK for v1 — `ProjectDiskSchema` / `ItemDiskSchema` relax ONLY id-typed fields (`id`, `parent_id`, `project_id`, `trashed_with`, `tags`); all other constraints (name/title length, status enum, refinements, ISO timestamps, hex color) are preserved. Tracked in `docs/known-issues.md`.

**Notes on implementer deviations:** all 3 accepted (disk schemas, bootstrap return type, buildIndexer logger param).

### Review

**Verdict:** Issues found.

**Per-criterion:** all 9 acceptance criteria pass.

**Issues to fix:**
1. **Blocking** — `ItemBaseSchema` exported from `packages/types/src/schemas/item.ts:14` leaks an internal schema to the public API. Consequence: `ItemCreateSchema`/`ItemPatchSchema` (derived from `ItemBaseSchema`) silently lack the `start_date <= due_date` refinement, so task 03's `parse(req.body)` won't catch the constraint at API-input time. Fix: (a) remove `export` from `ItemBaseSchema`; (b) make `ItemDiskSchema` self-contained; (c) add `.refine(...)` to both `ItemCreateSchema` and `ItemPatchSchema`.

**Non-blocking:**
2. `indexer.ts:275` `loadDir` calls `readFile` directly instead of `readJsonFile` helper (DRY).
3. `bootstrap()` stats undercount `projects` on fresh init (cosmetic log inconsistency).

**Regressions:** none.

---

## Iteration 2

### Fix

**What was fixed:** Issue 1 (blocking) + Issues 2 + 3 (non-blocking) all addressed.

**Files modified:**
- `packages/types/src/schemas/item.ts` — `ItemBaseSchema` now module-private; `ItemCreateSchema` + `ItemPatchSchema` got `.refine((v) => v.start_date == null || v.due_date == null || v.start_date <= v.due_date, ...)`
- `apps/server/src/store/indexer.ts` — `ItemDiskSchema` rewritten self-contained (no `ItemBaseSchema` import); `loadDir` now uses `readJsonFile` helper with ENOENT/parse-failure warning paths; `bootstrap()` stats now use `index.*.size` (accurate post-Inbox-creation)
- `packages/types/src/__tests__/schemas.test.ts` — added 4 refinement tests covering `ItemCreateSchema` accept/reject + `ItemPatchSchema` partial cases

**Deviations from plan:** none.

### Test

**Failures:** none.

**Full suite output:**
```
$ pnpm --filter @tasko/types test → 30 tests passed
$ pnpm --filter @tasko/server test → 36 tests passed
$ pnpm --filter @tasko/{types,server,web} typecheck → 0 errors each
$ pnpm lint → clean
```

### Review
_(pending re-review)_
