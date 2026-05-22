# Task 17 — SSE multi-tab consistency

## Goal

Wire the server-sent-events stream at `GET /api/events` so that every mutation broadcasts a typed event to all subscribed tabs. The broker (`apps/server/src/middleware/sse-broker.ts`) was instantiated in task-03 with `broker.publish(...)` calls scattered through every mutation route — those calls have been no-ops so far because nothing subscribes. This task adds the SSE route + heartbeat + a typed frontend `EventSource` client that dispatches events into TanStack Query (`invalidateQueries` / `setQueryData`) per event type. The `tab_id` discriminator (sent via `X-Tasko-Tab-Id` header and reflected on every event) tells each tab whether it originated the event (`source: 'self'` — ignore; the optimistic update already happened) vs another tab (`source: 'other-tab'` — invalidate). Reconnection on disconnect uses the native `EventSource` retry; on `onopen` (after reconnect), we refetch all stale queries to recover any events missed during the gap.

## Context files

- `docs/engineering/2026-05-18-architecture.md#2-7-sse---what-we-use-it-for--and-what-we-don-t-` — what SSE is for (multi-tab consistency) and what it ISN'T (no filesystem watching).
- `docs/engineering/2026-05-18-api.md#9-server-sent-events` — full event type catalog + payload shapes + heartbeat (25s ping comment).
- `docs/engineering/2026-05-18-code-architecture.md#3-7-sse-broker` and the `/api/events` route shape.
- `docs/engineering/2026-05-18-frontend-architecture.md#9-multi-tab-handling`, §13 SSE client (full implementation skeleton).
- `docs/engineering/2026-05-18-open-questions.md#0-binding-resolutions-user-2026-05-18` — #4.3 SSE wired in v1.
- `docs/ux/interaction-patterns.md` — §5 modal stacking (irrelevant to SSE itself but the multi-tab case may affect modal state — we don't need to handle modal-state sync, just data sync).

## Downstream dependencies

- **Task 18** — no direct dependency, but the SSE store's connection state may be surfaced in a debug-only UI (not in v1; the static footer just shows the data dir).
- **Task 19** verifies SSE doesn't break a11y (no focus-stealing, no surprise re-renders during user interaction).
- **Task 20** writes the E2E test for multi-tab consistency.

## Steps

1. **Server: SSE route** — `apps/server/src/routes/events.ts` per `code-architecture.md` §3.7:
   ```ts
   import { FastifyInstance } from 'fastify';
   import { z } from 'zod';

   const EventsQuerySchema = z.object({ tab_id: z.string().optional() });

   export function registerEventsRoute(app: FastifyInstance) {
     app.get('/api/events', async (req, reply) => {
       const { tab_id } = EventsQuerySchema.parse(req.query);
       reply.raw.writeHead(200, {
         'Content-Type': 'text/event-stream',
         'Cache-Control': 'no-cache',
         'Connection': 'keep-alive',
         'X-Accel-Buffering': 'no', // disable proxy buffering if any
       });
       reply.raw.flushHeaders?.();

       const unsubscribe = app.broker.subscribe((event) => {
         const source = event.tabId === tab_id ? 'self' : 'other-tab';
         const data = JSON.stringify({ ...(event.payload as object), source, timestamp: new Date().toISOString() });
         reply.raw.write(`event: ${event.type}\n`);
         reply.raw.write(`data: ${data}\n\n`);
       });

       const heartbeat = setInterval(() => reply.raw.write(`: ping\n\n`), 25_000);

       req.raw.on('close', () => {
         clearInterval(heartbeat);
         unsubscribe();
       });
     });
   }
   ```
   - Register in `server.ts`: `registerEventsRoute(app)`.
   - Each mutation route already calls `app.broker.publish({ type, payload, tabId })` (task-03+) — verify that every mutation in `items.ts`, `projects.ts`, `folders.ts`, `tags.ts`, `bulk.ts`, `trash.ts`, `config.ts` includes the publish call. Where missing, add it.
   - The `tabId` argument comes from the request header `X-Tasko-Tab-Id` (set in task-04's `apiCall`). Read it inside each route handler:
     ```ts
     const tabId = req.headers['x-tasko-tab-id'] as string | undefined ?? null;
     ```
2. **Server test** — `apps/server/test/integration/sse.spec.ts`:
   - Use Fastify's `inject` for a long-lived response is awkward; instead, use Node's `http` module to do a real HTTP connection to a listening Fastify instance.
   - Spin up the server on a free port + a test fixture data dir.
   - Open an HTTP connection to `/api/events?tab_id=tabA`. Parse incoming `text/event-stream` chunks.
   - In a separate request (with header `X-Tasko-Tab-Id: tabB`), POST `/api/items` — assert the SSE stream receives an `event: item.created` line and a `data: {...}` line where `source: 'other-tab'` (since tabA != tabB).
   - In another request with header `X-Tasko-Tab-Id: tabA`, POST another item — assert the SSE stream receives the event with `source: 'self'`.
   - Disconnect; assert no errors.
   - Heartbeat: leave the connection open ~30s with no other traffic; assert a `: ping` comment line arrives.
   - Or simulate the heartbeat by reducing the interval for the test build (export a config knob); v1 implementation can keep 25s.
3. **Frontend: SSE store + client** — `apps/web/src/api/events.ts` per `frontend-architecture.md` §13:
   ```ts
   import type { QueryClient } from '@tanstack/react-query';
   import { ItemSchema, ProjectSchema, FolderSchema, TagSchema, ConfigSchema, ItemChangedEventSchema, ItemCreatedEventSchema, /* ... */ } from '@tasko/types';
   import { itemKeys, projectKeys, folderKeys, tagKeys, trashKeys, configKeys } from './keys';
   import { z, ZodSchema } from 'zod';
   import { useSSEStore } from '@/store/sse';

   export function createSSEClient(tabId: string, queryClient: QueryClient): () => void {
     const url = new URL('/api/events', window.location.origin);
     url.searchParams.set('tab_id', tabId);
     const es = new EventSource(url.toString());

     function on<T>(type: string, schema: ZodSchema<T>, handler: (payload: T) => void) {
       es.addEventListener(type, (e: MessageEvent) => {
         const parsed = schema.safeParse(JSON.parse(e.data));
         if (!parsed.success) { console.warn('SSE schema mismatch', type, parsed.error); return; }
         handler(parsed.data);
       });
     }

     on('item.created', ItemCreatedEventSchema, (p) => {
       if (p.source === 'self') return;
       queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
     });
     on('item.changed', ItemChangedEventSchema, (p) => {
       if (p.source === 'self') return;
       queryClient.setQueryData(itemKeys.detail(p.id as ItemId), p.item);
       queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
     });
     on('item.trashed', ItemTrashedEventSchema, (p) => {
       if (p.source === 'self') return;
       queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
       queryClient.invalidateQueries({ queryKey: trashKeys.list() });
     });
     on('item.restored', ItemRestoredEventSchema, (p) => {
       if (p.source === 'self') return;
       queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
       queryClient.invalidateQueries({ queryKey: trashKeys.list() });
     });
     on('item.permanently_deleted', ItemPermanentlyDeletedEventSchema, (p) => {
       if (p.source === 'self') return;
       queryClient.invalidateQueries({ queryKey: trashKeys.list() });
     });
     on('project.created', ProjectCreatedEventSchema, (p) => {
       if (p.source === 'self') return;
       queryClient.invalidateQueries({ queryKey: projectKeys.all });
     });
     on('project.changed', ProjectChangedEventSchema, (p) => {
       if (p.source === 'self') return;
       queryClient.setQueryData(projectKeys.detail(p.id as ProjectId), p.project);
       queryClient.invalidateQueries({ queryKey: projectKeys.all });
     });
     on('project.deleted', ProjectDeletedEventSchema, (p) => {
       if (p.source === 'self') return;
       queryClient.invalidateQueries({ queryKey: projectKeys.all });
       queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
       queryClient.invalidateQueries({ queryKey: trashKeys.list() });
     });
     on('folder.created', FolderCreatedEventSchema, (p) => { if (p.source === 'self') return; queryClient.invalidateQueries({ queryKey: folderKeys.all }); });
     on('folder.changed', FolderChangedEventSchema, (p) => { if (p.source === 'self') return; queryClient.invalidateQueries({ queryKey: folderKeys.all }); });
     on('folder.deleted', FolderDeletedEventSchema, (p) => { if (p.source === 'self') return; queryClient.invalidateQueries({ queryKey: folderKeys.all }); queryClient.invalidateQueries({ queryKey: projectKeys.all }); });
     on('tag.created', TagCreatedEventSchema, (p) => { if (p.source === 'self') return; queryClient.invalidateQueries({ queryKey: tagKeys.all }); });
     on('tag.changed', TagChangedEventSchema, (p) => { if (p.source === 'self') return; queryClient.invalidateQueries({ queryKey: tagKeys.all }); });
     on('config.changed', ConfigChangedEventSchema, (p) => { if (p.source === 'self') return; queryClient.setQueryData(configKeys.all, p.config); });
     on('trash.emptied', TrashEmptiedEventSchema, (p) => { if (p.source === 'self') return; queryClient.invalidateQueries({ queryKey: trashKeys.list() }); });
     on('bulk.completed', BulkCompletedEventSchema, (p) => { if (p.source === 'self') return; queryClient.invalidateQueries({ queryKey: itemKeys.lists() }); });

     es.onerror = () => {
       useSSEStore.setState({ connectionState: 'reconnecting' });
       // EventSource handles reconnection automatically; we don't close + reopen.
     };
     es.onopen = () => {
       const prior = useSSEStore.getState().connectionState;
       useSSEStore.setState({ connectionState: 'connected' });
       if (prior === 'reconnecting') {
         // We may have missed events; refetch all active queries.
         queryClient.refetchQueries({ stale: true });
       }
     };

     return () => es.close();
   }
   ```
4. **SSE store** — `apps/web/src/store/sse.ts`:
   ```ts
   import { create } from 'zustand';
   export type SSEConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'closed';
   interface SSEState { connectionState: SSEConnectionState; setConnectionState: (s: SSEConnectionState) => void; }
   export const useSSEStore = create<SSEState>((set) => ({ connectionState: 'connecting', setConnectionState: (s) => set({ connectionState: s }) }));
   ```
5. **SSEConnector component** — `apps/web/src/app/sse-connector.tsx` (replaces task-04's stub):
   ```tsx
   import { useEffect } from 'react';
   import { useQueryClient } from '@tanstack/react-query';
   import { createSSEClient } from '@/api/events';
   import { getTabId } from '@/api/client';

   export function SSEConnector(): null {
     const queryClient = useQueryClient();
     useEffect(() => {
       const tabId = getTabId();
       const close = createSSEClient(tabId, queryClient);
       return close;
     }, [queryClient]);
     return null;
   }
   ```
6. **Header on every API call** — verify task-04's `apiCall` sends `X-Tasko-Tab-Id` on every request. Each server mutation reads it and passes to `broker.publish`.
7. **Server route: read tabId** — refactor each mutation route to extract `req.headers['x-tasko-tab-id']` once at the top + pass it through to every `broker.publish` call. Convenience: a route-level helper:
   ```ts
   function tabIdFromReq(req: FastifyRequest): string | null {
     const v = req.headers['x-tasko-tab-id'];
     return typeof v === 'string' && v.length > 0 ? v : null;
   }
   ```
8. **Frontend tests** — `apps/web/src/api/__tests__/events.test.ts`:
   - Mock `EventSource` (use `event-source-polyfill` test helper or a custom mock that supports `addEventListener` + `onopen` + `onerror`).
   - Construct `createSSEClient('tabA', queryClient)`.
   - Dispatch a `MessageEvent` of type `'item.changed'` with `source: 'other-tab'` + valid payload → assert `queryClient.setQueryData(itemKeys.detail(id), item)` was called AND `invalidateQueries({ queryKey: itemKeys.lists() })`.
   - Same with `source: 'self'` → assert no invalidation.
   - Trigger `onerror` → connection state becomes `'reconnecting'`.
   - Trigger `onopen` after a `reconnecting` state → connection state becomes `'connected'` AND `refetchQueries({ stale: true })` was called.
9. **Integration test (multi-tab)** — `apps/web/test/e2e/multi-tab-sse.spec.ts` (Playwright):
   - Use two `browser.newContext()` contexts (= two independent tabs).
   - Navigate both to `http://127.0.0.1:7373/today`.
   - In context A, create a Task via the modal → it appears in Today.
   - In context B, wait ≤ 1 second → the same Task appears (SSE → cache invalidation → re-fetch).
   - Mutation other direction: complete a task in B → it disappears in A within ≤ 1 second.
   - Edit + drag scenarios: optional, but a good additional case.
10. **Connection state surfacing (optional debug)** — for v1, we do NOT show the SSE connection state in the UI (the sync indicator is DROPPED). If the user wants to debug, they open devtools — the `useSSEStore` is queryable from React DevTools. Document that we're not adding a UI element.
11. **Edge cases & graceful degradation**:
    - If SSE fails to establish (server unreachable etc.), TanStack Query's `refetchOnWindowFocus: true` still covers the user-switches-tab case.
    - The `EventSource` API auto-reconnects every 3 seconds by default. On reconnect, our `onopen` refetches stale queries.
    - Long-lived idle: the 25s heartbeat keeps proxies happy.
    - **Memory**: each connected tab has one `EventSource` and one broker subscription. With 2 tabs, that's 2 subscriptions — fine. The architect's note: "browsers cap EventSource per origin to 6 connections" — not a v1 issue.
12. **Replace `SSEConnector` placeholder** — `apps/web/src/app/sse-connector.tsx` was a stub in task-04. Now it's the real implementation.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/server typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/server test` — `sse.spec.ts` passes (real HTTP connection + event broadcast).
- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — `events.test.ts` passes.
- [ ] Manual: open Tasko in two browser tabs. Create a task in tab A → it appears in tab B within ≤ 1 second.
- [ ] Manual: edit the task's title in tab B → tab A reflects within ≤ 1 second.
- [ ] Manual: complete a recurring task in tab A → tab B sees both the source change AND the new instance.
- [ ] Manual: kill the server while both tabs are open. Tabs show no error (we don't have a UI; just verify they don't crash). Restart the server → tabs reconnect (visible in devtools network panel) → next mutation flows through.
- [ ] Manual: verify the `: ping` heartbeat in devtools Network → EventStream tab.
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/server/src/routes/events.ts`
  - `apps/server/test/integration/sse.spec.ts`
  - `apps/web/src/api/events.ts`, `apps/web/src/api/__tests__/events.test.ts`
  - `apps/web/src/store/sse.ts`
  - `apps/web/test/e2e/multi-tab-sse.spec.ts`
- Modified:
  - `apps/server/src/server.ts` — `registerEventsRoute(app)`.
  - `apps/server/src/routes/items.ts`, `projects.ts`, `folders.ts`, `tags.ts`, `bulk.ts`, `trash.ts`, `config.ts` — add `tabIdFromReq(req)` extraction; verify every `broker.publish` includes `tabId`.
  - `apps/web/src/app/sse-connector.tsx` — real implementation replacing task-04 stub.
