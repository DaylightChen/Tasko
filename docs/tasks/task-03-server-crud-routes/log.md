# Execution Log — Task 03: Server REST CRUD routes

**Scope:** `project`

## Iteration 1

### Implement

**Files created:**
- `apps/server/src/middleware/error-envelope.ts` (HttpError + envelope handler)
- `apps/server/src/middleware/sse-broker.ts` (buildBroker stub)
- `apps/server/src/routes/items.ts`, `projects.ts`, `folders.ts`, `tags.ts`, `config.ts`
- 9 test files under `apps/server/test/integration/` per brief step 9

**Files modified:**
- `apps/server/src/server.ts` — wired all new routes, decorated `app.broker`, set `envelope` error handler, 404 handler, augmented `FastifyInstance` types

**Decisions not in plan:**
- Created **route-level relaxed schemas** (`ItemCreateRouteSchema`, `ItemPatchRouteSchema`) in `items.ts` that accept any string for `project_id`. Necessary because `INBOX_PROJECT_ID = '00000000000000000000INBOX0'` contains `I`/`O` outside ULID base32, and the strict `ProjectIdSchema` would reject Inbox as a valid project_id from a user POST. Mirrors the existing `ProjectDiskSchema` mitigation in `indexer.ts`. Tracked under the same INBOX known issue. Lives only in the route file (not exported).

**Deviations from plan:** none.

**Issues encountered:**
- INBOX spec bug surfacing again at the route layer (resolved as above).
- `exactOptionalPropertyTypes: true` prevents `{ ...source, ...patch }` spread for partial Item construction. Resolved by explicit field-by-field construction.

**Confirmed:** server typecheck 0 errors. types typecheck 0 errors. lint clean (68 files). server tests 98/98 pass.

### Test

**New tests written:**
- `apps/server/test/integration/broker-publish.spec.ts` — 17 tests verifying every mutation route publishes the correct SSE event shape via `app.broker.publish` (with `x-tasko-tab-id` header forwarded as `tabId`)

**Failures: 1**
- `broker-publish.spec.ts:401 — POST /api/trash/empty returns 501 (task-12 stub)` — expected 501, got 404. The implementer overlooked the stub route per the brief's task-12 downstream-dependencies note. Single-line fix: register the route returning 501 with code `INTERNAL` and message "Trash flow not yet implemented (task-12)."

**Full suite output (after this task's tests):**
```
Test Files  1 failed | 18 passed (19)
     Tests  1 failed | 114 passed (115)
```

**Per-criterion:** all but the `POST /api/trash/empty` 501 stub pass. All other 9 acceptance criteria + all 4 TODO comments verified in place.

**Notes on implementer's route-level relaxed schemas:** justified and tightly scoped — same pattern as `indexer.ts`. Strict schemas used at ID-generation time; existence checks against the in-memory index. Acceptable.

### Review

Skipped at iteration 1 — proceeded directly to fix iteration since the test failure was a clear stub-route omission.

---

## Iteration 2

### Fix

**What was fixed:** Added `POST /api/trash/empty` 501 stub in `apps/server/src/routes/items.ts` alongside the existing task-12 stubs. Throws `HttpError(501, 'INTERNAL', 'Trash flow not yet implemented (task-12).')`.

**Files modified:**
- `apps/server/src/routes/items.ts` — added trash-empty stub route

**Deviations from plan:** none.

### Test

**Failures:** none.

**Full suite output:**
```
$ pnpm --filter @tasko/server test
Test Files  19 passed (19)
     Tests  115 passed (115)

$ pnpm lint
Checked 69 files. No fixes applied.

$ pnpm --filter @tasko/server typecheck → 0 errors
$ pnpm --filter @tasko/types typecheck → 0 errors
$ pnpm --filter @tasko/web typecheck → 0 errors
```

### Review

**Verdict:** Approved.

**Stub fix status:** correct. `POST /api/trash/empty` returns 501 with the exact error envelope.

**Per-criterion:** all acceptance criteria pass. Error envelope shape matches `ApiErrorSchema` exactly. Every mutation publishes to broker. All 4 TODO comments in place. INBOX_IMMUTABLE 409 enforced. Tag find-or-create 200/201. Folder DELETE cascade verified. Cross-project move cascades to descendants.

**Downstream-contract findings:** all preserved.
- Task 04: error envelope `safeParse`-compatible with `ApiErrorSchema`
- Task 08: ViewSchema is strict enum; unknown views fail 400
- Task 09: 3 depth-cap TODO comments at `items.ts:283, 391, 545`
- Task 11: recurrence TODO at `items.ts:411`
- Task 12: 5 stub routes (items DELETE/restore, project DELETE, trash-empty, tag DELETE) all return 501
- Task 17: every mutation calls `app.broker.publish(...)` with typed payload

**Code quality:** clean. Route-level relaxed schemas tightly scoped (INBOX mitigation only).

**Test quality:** adequate (115 tests across 19 files cover happy paths, validation, edge cases).

**Regressions:** none.

**Issues to fix:** none.

---

## Completion

- **Commit:** `0736f3d` — "Task 03: Server REST CRUD routes"
- **Iterations:** 2 (one fix iteration to add the overlooked trash-empty 501 stub)
- **Verification evidence:**
  ```
  $ pnpm --filter @tasko/server test
  Test Files  19 passed (19)  Tests  115 passed (115)

  $ pnpm --filter @tasko/types test
  Test Files  2 passed (2)  Tests  30 passed (30)

  $ pnpm --filter @tasko/{types,server,web} typecheck → all 0 errors
  $ pnpm lint → Checked 69 files. No fixes applied.
  ```
- **Acceptance criteria:** all verified. Every curl example mapped to specific assertions. Stubs in place. SSE publish verified end-to-end.
- **Regressions:** none.
- **Deviations from plan:** route-level relaxed schemas for INBOX mitigation (same root cause as known-issue #1 in `docs/known-issues.md`). Otherwise none.

### Review
_(filled in after reviewer returns)_
