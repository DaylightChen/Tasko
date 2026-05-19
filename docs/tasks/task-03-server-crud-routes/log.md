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
_(pending — fix iteration first)_

---

## Iteration 2

### Fix
_(pending fix-implementer)_

### Test
_(pending)_

### Review
_(pending)_

### Review
_(filled in after reviewer returns)_
