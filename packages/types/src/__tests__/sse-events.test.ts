/**
 * Verifies that the SSE event schemas parse valid payloads and reject invalid ones.
 * Covers the ItemCreatedEventSchema and ConfigChangedEventSchema as representative cases.
 */
import { describe, expect, it } from 'vitest';
import {
  BulkCompletedEventSchema,
  ConfigChangedEventSchema,
  ItemCreatedEventSchema,
  ItemPermanentlyDeletedEventSchema,
  TrashEmptiedEventSchema,
} from '../index.js';

const now = new Date().toISOString();

// A valid ULID for IDs (no I or O)
const VALID_ID = '01HWABCDEFGHJKMNPQRSTVWXYZ';
const VALID_PROJECT_ID = '01HWABCDEFGHJKMNPQRSTVWXY2';

const validItem = {
  id: VALID_ID,
  schema_version: 1 as const,
  type: 'task' as const,
  project_id: VALID_PROJECT_ID,
  parent_id: null,
  title: 'Write tests',
  notes: '',
  due_date: '2026-05-20',
  start_date: null,
  due_time: null,
  priority: 'none' as const,
  status: 'todo' as const,
  tags: [],
  subtasks: [],
  recurrence: null,
  completed_at: null,
  trashed_at: null,
  trashed_with: null,
  sort_order: 0,
  created_at: now,
  updated_at: now,
};

const validConfig = {
  schema_version: 1 as const,
  theme: 'system' as const,
  week_start: 'mon' as const,
  last_modified: now,
};

describe('SSE event schemas', () => {
  describe('ItemCreatedEventSchema', () => {
    it('parses a valid ItemCreated payload', () => {
      const payload = {
        source: 'self' as const,
        timestamp: now,
        id: VALID_ID,
        item: validItem,
      };
      const result = ItemCreatedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source).toBe('self');
        expect(result.data.id).toBe(VALID_ID);
        expect(result.data.item.title).toBe('Write tests');
      }
    });

    it('parses with source: other-tab', () => {
      const payload = {
        source: 'other-tab' as const,
        timestamp: now,
        id: VALID_ID,
        item: validItem,
      };
      const result = ItemCreatedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects when source is missing', () => {
      const payload = {
        timestamp: now,
        id: VALID_ID,
        item: validItem,
      };
      const result = ItemCreatedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects when timestamp is missing', () => {
      const payload = {
        source: 'self' as const,
        id: VALID_ID,
        item: validItem,
      };
      const result = ItemCreatedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects when item has invalid type', () => {
      const payload = {
        source: 'self' as const,
        timestamp: now,
        id: VALID_ID,
        item: { ...validItem, type: 'invalid-type' },
      };
      const result = ItemCreatedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects when item has start_date > due_date', () => {
      const payload = {
        source: 'self' as const,
        timestamp: now,
        id: VALID_ID,
        item: { ...validItem, start_date: '2026-06-01', due_date: '2026-05-01' },
      };
      const result = ItemCreatedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('ConfigChangedEventSchema', () => {
    it('parses a valid ConfigChanged payload', () => {
      const payload = {
        source: 'self' as const,
        timestamp: now,
        config: validConfig,
      };
      const result = ConfigChangedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config.theme).toBe('system');
        expect(result.data.config.week_start).toBe('mon');
      }
    });

    it('rejects when config has invalid theme', () => {
      const payload = {
        source: 'self' as const,
        timestamp: now,
        config: { ...validConfig, theme: 'purple' },
      };
      const result = ConfigChangedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects when config is missing', () => {
      const payload = {
        source: 'self' as const,
        timestamp: now,
      };
      const result = ConfigChangedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('ItemPermanentlyDeletedEventSchema', () => {
    it('parses a minimal permanently-deleted payload (only id, no item)', () => {
      const payload = {
        source: 'self' as const,
        timestamp: now,
        id: VALID_ID,
      };
      const result = ItemPermanentlyDeletedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('TrashEmptiedEventSchema', () => {
    it('parses a valid TrashEmptied payload', () => {
      const payload = {
        source: 'other-tab' as const,
        timestamp: now,
        count: 5,
      };
      const result = TrashEmptiedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(5);
      }
    });

    it('rejects a non-integer count', () => {
      const payload = {
        source: 'self' as const,
        timestamp: now,
        count: 1.5,
      };
      const result = TrashEmptiedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('BulkCompletedEventSchema', () => {
    it('parses a valid BulkCompleted payload', () => {
      const payload = {
        source: 'self' as const,
        timestamp: now,
        ids: [VALID_ID],
        count: 1,
      };
      const result = BulkCompletedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
