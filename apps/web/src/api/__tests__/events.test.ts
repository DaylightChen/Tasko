import type { QueryClient } from '@tanstack/react-query';
import type { ItemId, ProjectId } from '@tasko/types';
/**
 * events.test.ts
 *
 * Unit tests for createSSEClient (apps/web/src/api/events.ts).
 *
 * Verifies:
 * - item.changed with source=other-tab → setQueryData on detail key + invalidateQueries on lists key.
 * - item.changed with source=self → no calls.
 * - onerror → SSE store connectionState becomes 'reconnecting'.
 * - onopen after 'reconnecting' → connectionState becomes 'connected' + refetchQueries called.
 * - Each major event type dispatches the expected query client call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSSEStore } from '../../store/sse';
import { configKeys, folderKeys, itemKeys, projectKeys, tagKeys, trashKeys } from '../keys';

// ── Mock EventSource ──────────────────────────────────────────────────────────

type EventHandler = (e: MessageEvent) => void;

interface MockEventSourceInstance {
  listeners: Record<string, EventHandler[]>;
  onerror: ((e: Event) => void) | null;
  onopen: ((e: Event) => void) | null;
  close: () => void;
  addEventListener: (type: string, handler: EventHandler) => void;
  /** test helper — dispatch a typed MessageEvent */
  dispatch: (type: string, data: unknown) => void;
  /** test helper — trigger onerror */
  triggerError: () => void;
  /** test helper — trigger onopen */
  triggerOpen: () => void;
}

let lastMockESInstance: MockEventSourceInstance | null = null;

class MockEventSource {
  listeners: Record<string, EventHandler[]> = {};
  onerror: ((e: Event) => void) | null = null;
  onopen: ((e: Event) => void) | null = null;

  constructor(_url: string) {
    lastMockESInstance = this as unknown as MockEventSourceInstance;
  }

  addEventListener(type: string, handler: EventHandler): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(handler);
  }

  close(): void {
    // no-op in mock
  }

  dispatch(type: string, data: unknown): void {
    const handlers = this.listeners[type] ?? [];
    const event = { data: JSON.stringify(data) } as MessageEvent;
    for (const h of handlers) {
      h(event);
    }
  }

  triggerError(): void {
    if (this.onerror) this.onerror({} as Event);
  }

  triggerOpen(): void {
    if (this.onopen) this.onopen({} as Event);
  }
}

// Stub global EventSource before module import
vi.stubGlobal('EventSource', MockEventSource);

// ── Mock QueryClient ──────────────────────────────────────────────────────────

function makeMockQueryClient(): QueryClient {
  return {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
    setQueryData: vi.fn(),
    refetchQueries: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryClient;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Timestamps must pass IsoUtcSchema = z.string().datetime()
const TS = new Date().toISOString();
const ITEM_ID = '01HWABCDEFGHJKMNPQRSTVWXYZ' as ItemId;
const PROJECT_ID = '01HWABCDEFGHJKMNPQRSTAAABB' as ProjectId;

function getES(): MockEventSourceInstance {
  if (!lastMockESInstance) throw new Error('No EventSource instance created');
  return lastMockESInstance;
}

function makeItem(id: string = ITEM_ID) {
  return {
    id,
    schema_version: 1,
    type: 'task',
    project_id: PROJECT_ID,
    parent_id: null,
    title: 'Test',
    notes: '',
    due_date: '2026-05-20',
    start_date: null,
    due_time: null,
    priority: 'none',
    status: 'todo',
    tags: [],
    subtasks: [],
    recurrence: null,
    completed_at: null,
    trashed_at: null,
    trashed_with: null,
    sort_order: 1024,
    created_at: TS,
    updated_at: TS,
  };
}

function makeProject(id: string = PROJECT_ID) {
  return {
    id,
    schema_version: 1,
    name: 'Test Project',
    folder_id: null,
    is_hierarchical: false,
    color: null,
    icon: null,
    sort_order: 1024,
    is_inbox: false,
    created_at: TS,
    updated_at: TS,
  };
}

function makeFolder(id = '01HWABCDEFGHJKMNPQRSTVWXY1') {
  return {
    id,
    schema_version: 1,
    name: 'Test Folder',
    sort_order: 1024,
    created_at: TS,
    updated_at: TS,
  };
}

function makeTag(id = '01HWABCDEFGHJKMNPQRSTTAGG1') {
  return {
    id,
    schema_version: 1,
    name: 'test-tag',
    name_lower: 'test-tag',
    color: null,
    created_at: TS,
    updated_at: TS,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Lazily import createSSEClient AFTER stubbing EventSource
let createSSEClient: (tabId: string, qc: QueryClient) => () => void;

beforeEach(async () => {
  // Clear SSE store state
  useSSEStore.setState({ connectionState: 'connecting' });
  lastMockESInstance = null;
  vi.clearAllMocks();

  if (!createSSEClient) {
    const mod = await import('../events');
    createSSEClient = mod.createSSEClient;
  }
});

afterEach(() => {
  vi.clearAllMocks();
  useSSEStore.setState({ connectionState: 'connecting' });
});

describe('createSSEClient', () => {
  describe('item.changed', () => {
    it('source=other-tab → setQueryData on detail + invalidateQueries on lists', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();

      const item = makeItem();
      es.dispatch('item.changed', { id: item.id, item, source: 'other-tab', timestamp: TS });

      expect(qc.setQueryData).toHaveBeenCalledWith(itemKeys.detail(item.id as ItemId), item);
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: itemKeys.lists() });
    });

    it('source=self → no setQueryData, no invalidateQueries', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();

      const item = makeItem();
      es.dispatch('item.changed', { id: item.id, item, source: 'self', timestamp: TS });

      expect(qc.setQueryData).not.toHaveBeenCalled();
      expect(qc.invalidateQueries).not.toHaveBeenCalled();
    });
  });

  describe('connection state', () => {
    it('onerror → connectionState becomes reconnecting', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();

      es.triggerError();

      expect(useSSEStore.getState().connectionState).toBe('reconnecting');
    });

    it('onopen when prior=reconnecting → connectionState=connected + refetchQueries called', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();

      // First go into reconnecting
      es.triggerError();
      expect(useSSEStore.getState().connectionState).toBe('reconnecting');

      // Then reconnect
      es.triggerOpen();

      expect(useSSEStore.getState().connectionState).toBe('connected');
      expect(qc.refetchQueries).toHaveBeenCalledWith({ stale: true });
    });

    it('onopen when prior=connecting → connectionState=connected, refetchQueries NOT called', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();

      useSSEStore.setState({ connectionState: 'connecting' });
      es.triggerOpen();

      expect(useSSEStore.getState().connectionState).toBe('connected');
      expect(qc.refetchQueries).not.toHaveBeenCalled();
    });
  });

  describe('item events (smoke tests)', () => {
    it('item.created source=other-tab → invalidateQueries lists', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      const item = makeItem();
      es.dispatch('item.created', { id: item.id, item, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: itemKeys.lists() });
    });

    it('item.trashed source=other-tab → invalidateQueries lists + trash', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      const item = makeItem();
      es.dispatch('item.trashed', { id: item.id, item, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: itemKeys.lists() });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: trashKeys.list() });
    });

    it('item.restored source=other-tab → invalidateQueries lists + trash', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      const item = makeItem();
      es.dispatch('item.restored', { id: item.id, item, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: itemKeys.lists() });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: trashKeys.list() });
    });

    it('item.permanently_deleted source=other-tab → invalidateQueries trash', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      es.dispatch('item.permanently_deleted', { id: ITEM_ID, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: trashKeys.list() });
    });
  });

  describe('project events (smoke tests)', () => {
    it('project.created source=other-tab → invalidateQueries projects', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      const project = makeProject();
      es.dispatch('project.created', { id: project.id, project, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: projectKeys.all });
    });

    it('project.changed source=other-tab → setQueryData + invalidateQueries projects', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      const project = makeProject();
      es.dispatch('project.changed', { id: project.id, project, source: 'other-tab', timestamp: TS });
      expect(qc.setQueryData).toHaveBeenCalledWith(projectKeys.detail(project.id as ProjectId), project);
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: projectKeys.all });
    });

    it('project.deleted source=other-tab → invalidateQueries projects + items + trash', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      es.dispatch('project.deleted', { id: PROJECT_ID, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: projectKeys.all });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: itemKeys.lists() });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: trashKeys.list() });
    });
  });

  describe('folder events (smoke tests)', () => {
    it('folder.created source=other-tab → invalidateQueries folders', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      const folder = makeFolder();
      es.dispatch('folder.created', { id: folder.id, folder, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: folderKeys.all });
    });

    it('folder.deleted source=other-tab → invalidateQueries folders + projects', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      es.dispatch('folder.deleted', { id: '01HWABCDEFGHJKMNPQRSTVWXY1', source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: folderKeys.all });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: projectKeys.all });
    });
  });

  describe('tag events (smoke tests)', () => {
    it('tag.created source=other-tab → invalidateQueries tags', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      const tag = makeTag();
      es.dispatch('tag.created', { id: tag.id, tag, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: tagKeys.all });
    });

    it('tag.changed source=other-tab → invalidateQueries tags', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      const tag = makeTag();
      es.dispatch('tag.changed', { id: tag.id, tag, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: tagKeys.all });
    });
  });

  describe('config + bulk + trash events (smoke tests)', () => {
    it('config.changed source=other-tab → setQueryData config', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      const config = {
        schema_version: 1,
        theme: 'dark' as const,
        week_start: 'mon' as const,
        last_modified: TS,
      };
      es.dispatch('config.changed', { config, source: 'other-tab', timestamp: TS });
      expect(qc.setQueryData).toHaveBeenCalledWith(configKeys.all, config);
    });

    it('trash.emptied source=other-tab → invalidateQueries trash list', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      es.dispatch('trash.emptied', { count: 5, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: trashKeys.list() });
    });

    it('bulk.completed source=other-tab → invalidateQueries items lists', () => {
      const qc = makeMockQueryClient();
      createSSEClient('tabA', qc);
      const es = getES();
      es.dispatch('bulk.completed', { ids: [ITEM_ID], count: 1, source: 'other-tab', timestamp: TS });
      expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: itemKeys.lists() });
    });
  });

  describe('schema mismatch', () => {
    it('logs a warning and does not call qc methods on bad payload', () => {
      const qc = makeMockQueryClient();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      createSSEClient('tabA', qc);
      const es = getES();

      // dispatch item.changed with missing required fields
      es.dispatch('item.changed', { id: ITEM_ID, item: null, source: 'other-tab', timestamp: TS });

      expect(warnSpy).toHaveBeenCalledWith('SSE schema mismatch', 'item.changed', expect.anything());
      expect(qc.setQueryData).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('close() is returned and can be called', () => {
      const qc = makeMockQueryClient();
      const close = createSSEClient('tabA', qc);
      expect(typeof close).toBe('function');
      expect(() => close()).not.toThrow();
    });
  });
});
