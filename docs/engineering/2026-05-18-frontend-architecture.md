---
title: Tasko — Frontend Architecture
date: 2026-05-18
phase: engineering
scope: project
status: draft
---

# Tasko — Frontend Architecture

How `apps/web` is laid out, how state flows, and which patterns are load-bearing. References `architecture.md` for stack picks; this doc is the developer's day-one guide to the codebase.

---

## 1. Module structure (recap from `architecture.md` §3.2)

```
apps/web/src/
  main.tsx                  # mount, provider tree
  app.tsx                   # root layout + outlet
  routes/                   # TanStack Router file-system routes
  views/                    # view-level orchestrators
  components/               # presentational primitives (1:1 with UX component-inventory.md)
  store/                    # Zustand stores (client-only state)
  api/                      # TanStack Query keys + mutation factories
  hooks/                    # cross-cutting hooks
  lib/                      # pure utilities
  styles/                   # token CSS + base styles
```

**The contract**: a component in `components/` never imports from `api/`. View files in `views/` orchestrate `components/`, `api/` hooks, and `store/` selectors.

---

## 2. Provider tree

`main.tsx` mounts in this order (outer → inner):

```tsx
<React.StrictMode>
  <ErrorBoundary>                     // route-level fallback
    <QueryClientProvider client={queryClient}>
      <TanStackRouterProvider router={router}>
        <ThemeBootstrap>              // applies data-theme attribute on mount
          <HotkeyProvider>            // wires global key listener to hotkeyStore
            <SSEConnector />          // mounts EventSource, dispatches to queryClient
            <SnackbarHost />          // singleton snackbar slot
            <CommandPaletteHost />    // singleton ⌘K modal slot
            <App />                   // <- RouterOutlet
          </HotkeyProvider>
        </ThemeBootstrap>
      </TanStackRouterProvider>
    </QueryClientProvider>
  </ErrorBoundary>
</React.StrictMode>
```

`SSEConnector`, `SnackbarHost`, `CommandPaletteHost` are headless singletons — they have no DOM unless their store says so.

---

## 3. Routing

### 3.1 Route map

```
/                      → Today view (default landing; sidebar's "Today" is selected)
/today                 → Today view (explicit; same as /)
/tomorrow              → Tomorrow view
/next-7-days           → Next 7 Days view
/inbox                 → Inbox view
/all                   → All view
/completed             → Completed view
/trash                 → Trash view
/calendar              → Calendar view (default month)
/calendar/week         → Calendar week view
/calendar/month        → Calendar month view (explicit)
/project/$id           → Per-project view (default Tree or List per project's is_hierarchical)
/project/$id/kanban    → Per-project Kanban view
/tag/$name             → Per-tag view (using URL-safe tag name)
/settings              → Settings view
```

Search params per view:
- `sort` (one of the sort tokens per view).
- `filter_project`, `filter_tag`, `filter_priority` (repeatable; for the Calendar's optional filter chips and any future filtered list views).

### 3.2 Why TanStack Router

Typed routes. Every `<Link to="/project/$id" params={{ id }} />` is TS-checked. Search params get parsed via zod schemas, so a filter chip value can't be a runtime surprise.

Per-view code-splitting comes for free — each route file is its own chunk.

### 3.3 Multi-tab safety

The router state lives in the URL. A user with two browser tabs has two independent router states, both syncing with the same server via SSE.

### 3.4 Inbox sentinel

The Inbox project has a fixed ULID-shaped id (`00000000000000000000INBOX0`). The Inbox sidebar item links to `/inbox` (a smart-list view), not to `/project/<inbox id>`. We keep the two routes distinct because the Inbox sidebar item never expands the project tree (per UX) — `/inbox` is a flat list of items with `project_id = INBOX AND parent_id = null`.

---

## 4. State management split

### 4.1 The decision tree

When a new piece of state appears, ask:

1. Does it come from the server or live on disk? → **TanStack Query**.
2. Is it reflected in the URL? (sort, filter, route) → **TanStack Router** (search params).
3. Otherwise → **Zustand** (one of the small stores).

Examples:

| State | Surface |
|---|---|
| The current list of items in the Today view | TanStack Query (`itemKeys.today()`) |
| The sort for Today (due_asc / priority_desc) | URL search param |
| The filter chips for Calendar | URL search params |
| Whether the command palette is open | Zustand (`commandPaletteStore`) |
| Multi-selected row IDs | Zustand (`multiSelectStore`) |
| Resolved theme (`'light'` or `'dark'`) | Zustand (`themeStore`) |
| Snackbar queue | Zustand (`snackbarStore`) |
| 5-second undo journal | Zustand (`undoStore`) |
| Drag-source ID during drag | Zustand (`dragStore`) — local to drag lifecycle |
| Hotkey mode (which key-table is active) | Zustand (`hotkeyStore`) |
| SSE connection state | Zustand (`sseStore`) |

### 4.2 TanStack Query setup

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,   // covers the "user git-pulled and switched tab" case
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (isAbortError(error)) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      retry: 0,  // mutations never auto-retry; the user retries via snackbar
    },
  },
});
```

### 4.3 Query key factory

Centralized in `api/keys.ts`:

```ts
export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (filters: ItemListFilters) => [...itemKeys.lists(), filters] as const,
  detail: (id: ItemId) => [...itemKeys.all, 'detail', id] as const,
  today: () => itemKeys.list({ view: 'today' }),
  tomorrow: () => itemKeys.list({ view: 'tomorrow' }),
  next7: () => itemKeys.list({ view: 'next7' }),
  inbox: () => itemKeys.list({ view: 'inbox' }),
  byProject: (projectId: ProjectId) => itemKeys.list({ view: 'project', project_id: projectId }),
  byTag: (tagId: TagId) => itemKeys.list({ view: 'tag', tag_id: tagId }),
  completed: () => itemKeys.list({ view: 'completed' }),
};
export const trashKeys = { all: ['trash'] as const, list: () => ['trash', 'list'] as const };
export const projectKeys = { all: ['projects'] as const, detail: (id: ProjectId) => ['projects', 'detail', id] as const };
export const folderKeys = { all: ['folders'] as const };
export const tagKeys = { all: ['tags'] as const, autocomplete: (q: string) => ['tags', 'autocomplete', q] as const };
export const configKeys = { all: ['config'] as const };
```

Invalidation after a mutation:

```ts
// On a generic item mutation, invalidate:
queryClient.invalidateQueries({ queryKey: itemKeys.detail(id) });
queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
// On a project change:
queryClient.invalidateQueries({ queryKey: projectKeys.all });
// On a folder change:
queryClient.invalidateQueries({ queryKey: folderKeys.all });
queryClient.invalidateQueries({ queryKey: projectKeys.all }); // a folder change moves projects
// On a tag change:
queryClient.invalidateQueries({ queryKey: tagKeys.all });
// SSE handler reads the event payload and invalidates the matching keys.
```

### 4.4 Mutation pattern (optimistic + undo)

Every mutation uses the `useOptimisticMutation` hook:

```ts
function useToggleComplete() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const undo = useUndo();

  return useMutation({
    mutationFn: ({ id, nextStatus }: { id: ItemId; nextStatus: Status }) =>
      apiCall(`PATCH /api/items/${id}`, { status: nextStatus }),
    onMutate: async ({ id, nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.detail(id) });
      const prior = queryClient.getQueryData<Item>(itemKeys.detail(id));
      queryClient.setQueryData<Item>(itemKeys.detail(id), (old) =>
        old ? { ...old, status: nextStatus, completed_at: nextStatus === 'done' ? new Date().toISOString() : null } : undefined,
      );
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      undo.push({
        label: nextStatus === 'done' ? 'Task completed' : 'Task reopened',
        apply: () => apiCall(`PATCH /api/items/${id}`, { status: prior?.status ?? 'todo' }),
        expiresAt: Date.now() + 5000,
      });
      return { prior };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prior) queryClient.setQueryData(itemKeys.detail(vars.id), ctx.prior);
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again." });
    },
    onSuccess: (server, vars) => {
      if ('completed' in server) {
        // Recurring case
        queryClient.setQueryData(itemKeys.detail(server.completed.id), server.completed);
        queryClient.setQueryData(itemKeys.detail(server.next.id), server.next);
        snackbar.show({ variant: 'success', text: `Task completed. Next: ${fmtDate(server.next.due_date)}.`, action: { label: 'Undo', onClick: () => undo.pop() } });
      } else {
        queryClient.setQueryData(itemKeys.detail(server.id), server);
        if (vars.nextStatus === 'done') {
          snackbar.show({ variant: 'success', text: 'Task completed.', action: { label: 'Undo', onClick: () => undo.pop() } });
        }
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
  });
}
```

This pattern is repeated for every mutation; the boilerplate is factored into a `useOptimisticMutation<TInput, TOutput, TPrior>` helper that takes a `buildOptimistic`, `buildUndo`, `buildSnackbar`.

---

## 5. Component layer

### 5.1 Inventory map

Every section number in `component-inventory.md` corresponds to exactly one folder under `components/`. Each folder has:

```
components/button/
  index.tsx          # public component export
  styles.module.css  # CSS Modules
  types.ts           # prop types (re-exported from index)
  variants.ts        # variant string unions
```

Components are presentational: they accept data and callbacks as props. They do NOT call hooks like `useMutation` or `useQuery` directly. Container behavior lives in views.

### 5.2 Single source of styling

CSS Modules in each component folder. No global stylesheet except `styles/tokens.css`, `styles/base.css`, `styles/theme.css`.

The class names follow a small convention:

```css
.root { /* applies to the outermost element */ }
.root[data-variant="primary"] { /* state-based variants */ }
.root[data-size="md"] { }
.root[data-state="hover"] { } /* synthesized states for non-native pseudo-classes */
```

This lets us drive variants via data-attributes from the component code, which is consistent and grep-able.

### 5.3 Component testing pattern

Each component has a `__tests__/<name>.test.tsx` (Vitest + Testing Library). Tests cover:

- Default render.
- Each variant.
- Each state.
- Keyboard interactions (Tab, Enter, Esc, arrow keys per the component's contract).
- ARIA labels per `accessibility.md`.

We do NOT snapshot test the whole DOM. We test behavior + key attributes.

---

## 6. Views

### 6.1 View files orchestrate

A view file in `views/today-view/index.tsx`:

```tsx
export function TodayView() {
  const { data: items, isLoading } = useItems(itemKeys.today());
  const { sort } = useTodayRouteSearch();
  const sortedItems = useMemo(() => sortItems(items ?? [], sort), [items, sort]);
  const { overdue, todays } = useMemo(() => partitionOverdue(sortedItems), [sortedItems]);
  const toggleComplete = useToggleComplete();
  const bulkMoveOverdue = useBulkMoveOverdue();

  if (isLoading && (items?.length ?? 0) === 0) {
    return <Skeleton variant="list" rowCount={10} />;
  }

  if (items?.length === 0) {
    return <TodayEmptyState />;
  }

  return (
    <div className={styles.root}>
      <ViewChrome title="Today">
        <SortDropdown />
        <FilterChips />
      </ViewChrome>
      <QuickAddInput />
      {overdue.length > 0 && (
        <OverdueStrip
          items={overdue}
          onMoveAll={() => bulkMoveOverdue.mutate()}
          onToggleComplete={(id) => toggleComplete.mutate({ id, nextStatus: 'done' })}
        />
      )}
      <TodaySection items={todays} onToggleComplete={...} />
    </div>
  );
}
```

`TodayView` is the orchestrator. `OverdueStrip` and `TodaySection` are presentational (in `components/`). The mutation hooks live in `api/items.ts`. The sort logic lives in `lib/sort.ts`.

### 6.2 View list (mapping to product spec §5.1)

| View | File | Components |
|---|---|---|
| Today | `views/today-view/` | TaskListRow §23, OverdueStrip (composed), EmptyState §35 |
| Tomorrow | `views/tomorrow-view/` | TaskListRow §23, EmptyState §35 |
| Next 7 Days | `views/next-7-view/` | DayGroupHeader, TaskListRow §23 |
| Inbox | `views/inbox-view/` | TaskListRow §23 |
| All | `views/all-view/` | TaskListRow §23 (with project breadcrumb) |
| Completed | `views/completed-view/` | TaskListRow §23 (completed variant) |
| Trash | `views/trash-view/` | TrashRow (variant of §23) |
| Calendar (month) | `views/calendar-view/month.tsx` | CalendarDayCell §26, CalendarEventChip §27 |
| Calendar (week) | `views/calendar-view/week.tsx` | CalendarWeekBlock §28 |
| Day-detail popover | `views/calendar-view/day-detail.tsx` | TaskListRow §23 in a popover |
| Per-project (Tree) | `views/project-view/tree-view.tsx` | TreeRow §21 |
| Per-project (List/flat) | `views/project-view/flat-list-view.tsx` | TaskListRow §23 |
| Per-project (Kanban) | `views/project-view/kanban-view.tsx` | KanbanColumn §24, KanbanCard §25 |
| Per-tag | `views/tag-view/` | TaskListRow §23 |
| Settings | `views/settings-view/` | Form primitives, theme/week-start radios |

---

## 7. Theming layer in practice

### 7.1 `themeStore`

```ts
type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  resolved: 'light',
  setPreference: (p) => {
    set({ preference: p });
    // recompute resolved
    const resolved: ResolvedTheme =
      p === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : p;
    set({ resolved });
    document.documentElement.dataset.theme = resolved;
  },
}));
```

### 7.2 `ThemeBootstrap` component

Mounted once at the top of the tree:

```tsx
function ThemeBootstrap({ children }) {
  const { preference, resolved, setPreference } = useThemeStore();
  const { data: config } = useConfig();

  // Sync preference from server config on first load
  useEffect(() => {
    if (config?.theme && config.theme !== preference) {
      useThemeStore.setState({ preference: config.theme });
    }
  }, [config?.theme]);

  // Watch prefers-color-scheme if preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next = mq.matches ? 'dark' : 'light';
      useThemeStore.setState({ resolved: next });
      document.documentElement.dataset.theme = next;
    };
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  return children;
}
```

When the user changes theme in Settings, the view calls `useUpdateConfig().mutate({ theme: 'dark' })`. The mutation succeeds, the cache updates, the effect above re-runs, the `data-theme` attribute updates, CSS custom properties re-resolve.

---

## 8. Hotkey registry

### 8.1 Mode-aware

The product has multiple hotkey modes (per `interaction-patterns.md` §4):

- **`global`** (always-on modifier combos): `⌘K`, `⌘\`, `⌘Z`, etc.
- **`no-input`** (single-key navigation when no input is focused): `T`, `I`, `N`, `J`, `K`, etc.
- **`input`** (typing — most single-keys are suppressed): `Esc`, `Tab`.
- **`modal`** / **`sheet`**: focus-trap, `Esc`, `⌘Enter`.
- **`calendar`**: `←→↑↓`, `Page Up/Down`, `T`, `N`.
- **`kanban`**: `←→↑↓`, `Space`, `X`, `Enter`, `O`.
- **`tree`**: `←→↑↓`, `Enter`, `O`, `Space`.
- **`command-palette`**: `↑↓`, `Enter`, `Esc`.
- **`tag-input`**: `Enter`, `,`, `Backspace`, `↑↓`, `Esc`.
- **`date-picker`**: `←→↑↓`, `Page Up/Down`, `t/m/w/n`.

### 8.2 `hotkeyStore`

```ts
interface HotkeyState {
  mode: 'global' | 'no-input' | 'input' | 'modal' | 'sheet' | 'calendar' | 'kanban' | 'tree' | 'command-palette' | 'tag-input' | 'date-picker';
  push: (m: HotkeyState['mode']) => void;
  pop: () => void;  // stack-based; closing a modal pops the mode
}
```

The mode is a stack so nesting works (modal opened while on calendar → mode becomes `modal`; closing returns to `calendar`).

### 8.3 Implementation

Single global `keydown` listener on `document` registered by `HotkeyProvider`. It reads `hotkeyStore.mode`, consults a static map of `mode × event-key → action`, and either calls the action or does nothing (letting the event propagate to native handlers).

Actions are registered globally:

```ts
const HOTKEY_MAP: Record<HotkeyState['mode'], Record<string, HotkeyAction>> = {
  'global': {
    'Mod+k': openCommandPalette,
    'Mod+\\': toggleSidebar,
    'Mod+z': triggerUndo,
    'Mod+Shift+z': focusMostRecentSnackbar,
    'Mod+f': showSearchHintToast,
    '?': toggleShortcutHelp,
  },
  'no-input': {
    't': goToToday,
    'i': goToInbox,
    'n': focusQuickAdd,
    '/': focusQuickAdd,
    'j': moveFocusDown,
    'k': moveFocusUp,
    'Space': toggleFocusedCheckbox,
    // ...
  },
  // ...
};
```

`Mod` resolves to `Meta` on Mac, `Ctrl` elsewhere (via `lib/keyboard.ts`).

### 8.4 Mode transitions

- `<input>`, `<textarea>`, `[contenteditable]` focus → `hotkeyStore.push('input')`. Blur → `pop()`.
- Modal opens → `push('modal')`. Closes → `pop()`.
- Sheet opens → `push('sheet')` (mostly same as modal for hotkeys).
- Calendar view focused via `Tab` → `push('calendar')`. Tab out → `pop()`.
- Same for kanban, tree, command palette, tag input, date picker.

We do NOT push 'no-input' explicitly — it's the default whenever the stack is empty + no input is focused.

### 8.5 Conflict resolution (per interaction-patterns.md §4.12)

- `⌘B` / `⌘I` / `⌘K` inside a textarea: those keys are wired to the textarea's own `onKeyDown` (`lib/markdown.ts`). Global `Mod+k` is suppressed when `hotkeyStore.mode === 'input'`.
- Single-keys are suppressed whenever the stack top is `input`, `tag-input`, or `command-palette`.

---

## 9. Multi-tab handling

The user may open Tasko in two browser tabs (per UX `interaction-patterns.md`).

**Mechanism**:

1. Each tab generates a `tab_id` on load (random ULID).
2. Each tab connects to `GET /api/events?tab_id=<id>` (SSE).
3. Each tab's `apiCall` sends `X-Tasko-Tab-Id: <id>` on every request.
4. The server tags every event it emits with the originating tab's id; receiving tabs check the event's `source` field:
   - `source === 'self'` → ignore (the optimistic update + the server response already covered it).
   - `source === 'other-tab'` → invalidate the relevant TanStack Query keys.

**Net behavior**: Tab A edits an item → Tab A's UI updates optimistically and confirms on server response → Server emits SSE → Tab B sees the event → Tab B's query cache invalidates → Tab B re-renders.

**Drift window**: If SSE is briefly disconnected, Tab B may be stale for up to `staleTime + reconnect`. The `refetchOnWindowFocus: true` covers the user-pulled-to-Tab-B case.

**Conflicts**: We do not detect conflicting concurrent edits between two tabs. If both tabs save a title change within milliseconds, the second write wins on disk; the first tab's optimistic state is corrected by the SSE event invalidation. The user sees the second value. This is "last-write-wins per field" implicitly. The single-machine model accepts this; documented in `open-questions.md`.

---

## 10. Drag-and-drop architecture

### 10.1 `dnd-kit` setup

A single `DndContext` per scrollable region (one per view that uses drag). Sensors:

- `PointerSensor` with `activationConstraint: { delay: 100, tolerance: 5 }`.
- `KeyboardSensor` with coordinate-getter custom for our list / tree / kanban / calendar shapes.

### 10.2 The frontend depth-cap mirror

`lib/depth-cap-client.ts` exports a `canMoveClient` function with the **same signature** as `domain/depth-cap.ts` on the server. It operates on the items currently in the TanStack Query cache.

Used in two places:

1. `<DroppableTreeRow>`'s `onDragOver` shows the overdue-tinted reject outline when `canMoveClient` returns `{ ok: false }`.
2. The move-to picker filters/disables candidates by walking the project tree and calling `canMoveClient` for each.

The server's `canMove` is still the authoritative check; the client mirror is for UX feedback. A drop the client thinks is fine but the server rejects (rare; would only happen if the user's cache is stale) shows a snackbar "Can't move there: would exceed nesting depth."

### 10.3 Drag implementations per surface

| Surface | dnd-kit primitive | Drop targets |
|---|---|---|
| Task list (Today, Inbox, project flat, etc.) | `useSortable` per row | Same view (reorder), sidebar project rows (move to project) |
| Tree | `useSortable` per row + per-row `useDroppable` | Parent Items in tree (re-parent), project root |
| Kanban | `useSortable` per card | Same column (reorder), other columns (status mutate) |
| Calendar (month) | `useDraggable` per event chip; `useDroppable` per day cell | Day cells (reschedule) |
| Calendar (week) | `useDraggable` per time block; `useDroppable` per (day, time-slot) | (day, hh:mm) tuple |
| Subtask list | `useSortable` per row | Same list (reorder) |
| Sidebar projects/folders | `useSortable` per project; `useDroppable` per folder | Folders (move into), top-level area (move out) |

### 10.4 Drag visuals

A single `<DragOverlay>` portal per `DndContext`. Renders the ghost using the same component as the source (with `data-state="dragging"` so styles apply).

Reduced motion: removes the `scale(1.02)` and the placeholder pulse (per `interaction-patterns.md` §1.2).

### 10.5 a11y announcements

`dnd-kit`'s built-in screen reader announcements wired to a `lib/a11y.ts` `announce()` helper. Per microcopy §26, the announcements are:

- Drag start: "Dragging '<Title>'. Drop on a project, folder, or feature."
- Hover valid target: "Drop on <name>." (throttled to one per target).
- Hover invalid target: "Cannot drop on <name>: would exceed nesting depth."
- Drop success: "Dropped onto <name>."
- Drag cancelled: "Drag cancelled."

---

## 11. Undo pattern detail

### 11.1 The store

```ts
interface UndoEntry {
  id: string;          // random
  label: string;
  apply: () => Promise<void>;  // executes the reverse mutation
  expiresAt: number;   // Date.now() + 5000
}

interface UndoState {
  current: UndoEntry | null;  // single-step v1
  push: (entry: Omit<UndoEntry, 'id'>) => void;
  pop: () => void;             // user clicked Undo or pressed ⌘Z within window
  clear: () => void;
}
```

Single-step v1 (per locked decision). Multi-step is post-v1.

### 11.2 Lifecycle

- A mutation's `onMutate` calls `undo.push(...)`. If a previous entry exists, it's replaced (and a setTimeout that would've cleared the old entry is canceled).
- A timer fires at `expiresAt` and sets `current = null`.
- Snackbar's "Undo" button calls `undo.pop()`. This:
  1. Reads the current entry.
  2. Calls `entry.apply()`.
  3. Sets `current = null` immediately.
- `⌘Z` calls `undo.pop()` too (per `accessibility.md` §2.2).

### 11.3 Edge cases

- Recurring completion: the "undo" reverses both the source completion AND deletes the auto-generated next instance. Implementation: the `apply` callback is a custom function that does both, atomically (via a server endpoint or two sequenced calls — we ship a server endpoint `POST /api/items/:id/uncomplete-recurring` so it's one round-trip).

  Wait — that's a new endpoint not in the API doc. Let me reconcile: the cleanest implementation is a client-side sequence:
  
  ```ts
  apply: async () => {
    // Undo the completion of source (which clears completed_at, sets status=todo)
    await api.items.patch(sourceId, { status: 'todo' });
    // Delete the auto-generated next instance
    await api.items.softDelete(nextId);
  }
  ```
  
  This is two round-trips; on localhost it's < 30ms. Acceptable. If we want it atomic, we add a server endpoint in implementation. Either way, the UX matches.

- Soft-delete cascade: `apply` calls the restore endpoint with the parent's id; the server restores the whole cascade.
- Re-parent: `apply` re-parents back to the previous parent.

---

## 12. Snackbar host

`snackbarStore` holds:

```ts
interface SnackbarItem {
  id: string;
  variant: 'success' | 'info' | 'restored' | 'error' | 'depth-cap' | 'sync-info';
  text: string;
  action?: { label: string; onClick: () => void };
  expiresAt: number;  // Date.now() + 5000 (or 3000 for sync-info)
}

interface SnackbarState {
  current: SnackbarItem | null;
  queue: SnackbarItem[];  // capacity 1 (depth-2 if next arrives within 200ms during exit)
  show: (item: Omit<SnackbarItem, 'id'>) => void;
  dismiss: () => void;
}
```

`SnackbarHost` is a singleton in the provider tree. Renders the current snackbar with the `<Snackbar>` component from `components/snackbar/`. ARIA-live + auto-dismiss + queueing per UX §16.

---

## 13. SSE client

`api/events.ts`:

```ts
export function createSSEClient(tabId: string, queryClient: QueryClient) {
  const url = new URL('/api/events', window.location.origin);
  url.searchParams.set('tab_id', tabId);
  const es = new EventSource(url.toString());

  const handlers: Record<string, (event: MessageEvent) => void> = {
    'item.changed': (e) => {
      const payload = parseSSEPayload(e.data, ItemChangedEventSchema);
      if (payload.source === 'self') return;
      queryClient.setQueryData(itemKeys.detail(payload.id), payload.item);
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
    'item.created': (e) => {
      const payload = parseSSEPayload(e.data, ItemCreatedEventSchema);
      if (payload.source === 'self') return;
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
    // ...
  };

  for (const [type, handler] of Object.entries(handlers)) {
    es.addEventListener(type, handler);
  }
  es.onerror = () => {
    sseStore.setState({ connectionState: 'reconnecting' });
    // Native EventSource auto-reconnects with default 3s; we don't override.
  };
  es.onopen = () => {
    sseStore.setState({ connectionState: 'connected' });
    // On reconnect, refetch all active queries.
    queryClient.refetchQueries({ stale: true });
  };

  return () => es.close();
}
```

`SSEConnector` mounts this once on app load.

---

## 14. Quick-add behavior

Three pieces:

1. **Quick-add input** in the top of every list view: a styled `<input>`. Placeholder is dynamic per view (microcopy §2):
   - On Today: "Add task"
   - On Inbox: "Add task to Inbox"
   - On Project: "Add task to <Project>"
   - On Calendar: "Add task on <focused day>"
   - On Tag: "Add task with #<tag>"
2. **`N` keybinding** (when no input focused) focuses the input.
3. **Enter** on the input: opens the Task modal with `title` pre-filled, **Due date field focused** (per spec §6.1).

Project context-fill rules (locked per spec §9.4 #8):

- Today, Tomorrow, Next 7 Days, All, Tag, Calendar quick-add: **Project field empty**, user picks.
- Inbox quick-add: **Project field empty** (per spec — Inbox is just a view filter; user picks Inbox in the modal). The placeholder hints "Add task to Inbox" but the field still requires selection.
- Per-project view quick-add: **Project pre-filled** to that project. Locked exception in UX `flows.md` §1 step 37 — the user is in a destination context.
- "+ Add Task" inside a Feature in the tree: **Project pre-filled** and **`parent_id` pre-filled** to that Feature. Same exception logic.

The "destination context" rule is implemented as a single config to the `TaskModal`:

```tsx
<TaskModal
  initialTitle={title}
  initialProjectId={fromDestinationContext ? currentProjectId : null}
  initialParentId={fromDestinationContext ? parentFeatureId : null}
  initialDueDate={fromCalendarFocusedDay ? focusedDay : null}
  initialStatus={fromKanbanColumn ? columnStatus : 'todo'}
/>
```

The view files compose this. Quick-add at the top of the view sets `fromDestinationContext: false` for Today/Inbox/Tag/Calendar/All; `true` for per-project. Tree-row `+ Add Task` sets both project and parent.

---

## 15. Markdown notes implementation

### 15.1 Edit / preview toggle

`components/textarea-markdown/` renders either an editing `<textarea>` or a preview block.

- Initial state when modal opens: if `notes !== ''`, preview mode; else, edit mode.
- Clicking the preview → switches to edit + focuses textarea.
- Toolbar "Edit / Preview" toggle (`role="switch"`).
- On blur of the textarea (clicking outside or pressing Tab), switches to preview if content exists.

### 15.2 Render

```ts
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const renderer = new marked.Renderer();
renderer.checkbox = (checked) =>
  `<span class="md-checkbox" data-checked="${checked}" aria-hidden="true">${checked ? '☑' : '☐'}</span>`;
renderer.link = (href, title, text) =>
  `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;

const html = DOMPurify.sanitize(marked.parse(notes, { renderer, breaks: true, async: false }));
```

`DOMPurify` runs at the React-side; output is rendered with `dangerouslySetInnerHTML` (inevitably; we cannot avoid this for HTML markdown render). The sanitize step removes scripts, event handlers, javascript: URLs.

### 15.3 Edit keybindings

`components/textarea-markdown/keybindings.ts` exports a small handler:

```ts
function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  const ta = e.currentTarget;
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') { wrapSelection(ta, '**', '**'); e.preventDefault(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key === 'i') { wrapSelection(ta, '*', '*'); e.preventDefault(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { insertLink(ta); e.preventDefault(); return; }
  if (e.key === 'Tab') {
    insertAtCursor(ta, '  ');
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter') {
    const continued = continueListItem(ta);  // detects "- [ ] " or "- " preceding, replicates
    if (continued) e.preventDefault();
  }
}
```

`wrapSelection`, `insertAtCursor`, `continueListItem`, `insertLink` are pure DOM functions in `lib/textarea-ops.ts`. ~100 lines total.

---

## 16. Recurring next-instance UX flow

When the user completes a recurring task:

1. Frontend's `useToggleComplete` mutation fires PATCH `status: done`.
2. Server detects recurrence, runs the atomic op, returns `{ completed, next }`.
3. Frontend's `onSuccess`:
   - Updates cache for both items.
   - Shows snackbar: `Task completed. Next: <date>.` (per microcopy §7). The snackbar has an "Undo" action.
4. If user clicks Undo within 5s: the undo entry's `apply` runs:
   - PATCH `completed.id` with `status: 'todo'` (un-complete).
   - DELETE `next.id` (soft-delete the auto-generated instance).
   - Cache updates accordingly.

Per spec §9.4 #5: un-checking from the Completed view (NOT via the snackbar) only reopens the instance; the next instance is kept. The completed-view un-check is a different mutation (no undo entry that touches the next instance).

---

## 17. Hot-paths and perf budget

| Path | Target |
|---|---|
| Today view first paint | < 200ms total (no skeleton fires; localhost is sub-10ms) |
| Toggle checkbox optimistic | < 16ms (one paint) |
| Open Task modal | < 100ms (modal mount + first paint) |
| Quick-add Enter → modal open | < 100ms |
| Drag a row through 1000-row list | 60fps maintained via virtualization |
| Switch between Today / project / calendar | < 80ms |
| Calendar month render with 100 events | < 100ms |
| Tree expand of a node with 100 children | < 50ms |

Virtualization thresholds are detailed in `architecture.md` §10. Implementation: the list / tree / kanban views check `items.length` (or rendered-rows.length for tree) and conditionally render `@tanstack/react-virtual`. The conditional is a single `if` in the view; the surface area is small.

---

## 18. Build configuration

### 18.1 Vite config

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tasko/types': resolve(__dirname, '../../packages/types/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:7373',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy deps so they cache independently
          'vendor-react': ['react', 'react-dom'],
          'vendor-tanstack': ['@tanstack/react-query', '@tanstack/react-router', '@tanstack/react-virtual'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
          'vendor-markdown': ['marked', 'dompurify'],
        },
      },
    },
  },
});
```

### 18.2 Biome config

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "files": { "ignore": ["dist/**", "node_modules/**"] },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 110 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "useExhaustiveDependencies": "error",
        "noUnusedImports": "error"
      },
      "style": {
        "useImportType": "error"
      }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always" } }
}
```

### 18.3 TypeScript config

```jsonc
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"],
      "@tasko/types": ["../../packages/types/src"]
    }
  },
  "include": ["src", "test"]
}
```

`tsconfig.base.json` at the monorepo root:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "target": "ES2022",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

## 19. Tests

### 19.1 Vitest unit + integration

- Each component folder has `__tests__/<name>.test.tsx`.
- Pure utilities in `lib/` have `*.test.ts` next to them.
- Each view has at least one integration test that renders the view inside a `<QueryClientProvider>` with a stubbed API (we use MSW 2.x for network mocking).

### 19.2 Playwright E2E

Tests in `apps/web/test/e2e/`. Each test spins up the **real** server (via `playwright.config.ts`'s `webServer`) against a temporary data directory, then runs scenarios end-to-end. Examples:

- `today-overdue.spec.ts`: create overdue items, open Today, verify Overdue strip, click "Move all overdue to today", verify state.
- `recurring-monthly.spec.ts`: create a monthly recurring task, complete it, verify next instance is created with correct date.
- `hierarchy-depth-cap.spec.ts`: build Epic → Feature → Task → Subtask, attempt to add a Feature under another Feature, verify rejection.
- `kanban-drag.spec.ts`: create tasks in a project, switch to Kanban, drag from To Do to Done, verify status updates.
- `calendar-multi-day-drag.spec.ts`: create a multi-day task, drag in calendar, verify both start_date and due_date update.
- `quick-add-no-project.spec.ts`: from Today, quick-add → modal opens with project empty → Save without project → validation error.
- `undo-5s.spec.ts`: complete a task → click Undo within 5s → row returns; complete and wait 6s → Undo button gone.
- `multi-tab-sse.spec.ts`: open two browser contexts, write in one, verify the other reflects via SSE.

Desktop only. Chromium + WebKit. Mobile is deferred per locked decision.

---

## 20. Accessibility implementation hooks

### 20.1 Skip link

```tsx
// app.tsx
<a href="#main" className={styles.skipLink}>Skip to main content</a>
```

`styles.skipLink` is visually-hidden until focused (`:focus`), then surfaces as a small accent-fill button at the top-left.

### 20.2 Landmark structure

```
<a href="#main">Skip</a>
<header>...</header>
<nav aria-label="Primary navigation"> ... sidebar ... </nav>
<main id="main"> ... view ... </main>
```

`<header>` contains nothing on desktop (the view chrome is inside `<main>`); on mobile it contains the top bar. (v1 ships desktop CSS as the QA target.)

### 20.3 Heading rule

Each view's root component renders exactly one `<h1>`, which is the view title. Section headers ("Overdue", day group headers, folder names) are `<h2>`. Sub-section headers ("Active (3)") are also `<h2>` — we are intentionally flat under the view title.

### 20.4 Live region

`lib/a11y.ts` exports a singleton:

```ts
export function announce(text: string, politeness: 'polite' | 'assertive' = 'polite') {
  // Routes to a hidden div[role="status"|"alert"] in the DOM that clears + sets text.
}
```

Used by mutations, drag, view transitions per `accessibility.md` §3.14 and `microcopy.md` §26 / §29.

---

## 21. Mobile considerations (ships, not QA-targeted)

Per the locked decision, mobile UX (responsive layout, bottom nav, swipe gestures, sheet modals) is in the CSS and component code but is **not** a v1 QA target. We do not test it; we do not promise it works.

In practice:
- The CSS is media-query based and degrades to the desktop layout for narrow viewports if anything's off.
- The mobile-specific components (`sheet`, `bottom-nav`, `swipe-drawer` per UX §15, §39, §40) ship as compiled code.
- Playwright E2E targets desktop only.

v1.1 work: lift mobile to a QA target, fix bugs, expand E2E. The locked code structure does not need a rewrite.

---

## 22. Things deliberately NOT built in v1

- Sync state indicator (component §42) — DROPPED. Replaced with a tiny "v1.0 · Local files in `<data-dir>`" footer at the bottom of the sidebar. The sidebar still has the same shape; one component swapped.
- Sync error / sync offline snackbars — DROPPED.
- Conflict resolution UX — DROPPED.
- Pull-to-refresh suppression: still implemented (per UX §8.4 — the gesture is suppressed at the app surface — but in practice it just doesn't fire because we don't QA mobile).
- Global search (`⌘F` no-op with toast) — kept; the `⌘F` keybind shows the "Use ⌘K to navigate" toast per microcopy.
- Tag management UI — not built; the autocomplete + create-on-the-fly flow is the only tag surface.
- Drag-on-touch — touched-up but not v1-tested; the move-to picker is the canonical re-parent on touch.

These are documented in `feature-mapping.md` and `open-questions.md`.
