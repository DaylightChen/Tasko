import { describe, expect, it } from 'vitest';
import {
  ConfigSchema,
  FolderSchema,
  INBOX_PROJECT_ID,
  ItemCreateSchema,
  ItemPatchSchema,
  ItemSchema,
  ProjectSchema,
  TagSchema,
} from '../index.js';

const now = new Date().toISOString();

// Use a valid ULID for project_id in tests (INBOX_PROJECT_ID contains 'I' and 'O'
// which are not in the ULID base32 alphabet and will fail schema validation).
const VALID_PROJECT_ID = '01HWABCDEFGHJKMNPQRSTVWXY2';

const validItem = {
  id: '01HWABCDEFGHJKMNPQRSTVWXYZ',
  schema_version: 1 as const,
  type: 'task' as const,
  project_id: VALID_PROJECT_ID,
  parent_id: null,
  title: 'Buy charger',
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
  sort_order: 1024,
  created_at: now,
  updated_at: now,
};

const validProject = {
  id: VALID_PROJECT_ID,
  schema_version: 1 as const,
  name: 'My Project',
  folder_id: null,
  is_hierarchical: false,
  color: null,
  icon: null,
  sort_order: 0,
  is_inbox: false,
  created_at: now,
  updated_at: now,
};

const validFolder = {
  id: '01HWABCDEFGHJKMNPQRSTVWXY0',
  schema_version: 1 as const,
  name: 'Work',
  sort_order: 0,
  created_at: now,
  updated_at: now,
};

const validTag = {
  id: '01HWABCDEFGHJKMNPQRSTVWXY1',
  schema_version: 1 as const,
  name: 'urgent',
  name_lower: 'urgent',
  color: null,
  created_at: now,
  updated_at: now,
};

const validConfig = {
  schema_version: 1 as const,
  theme: 'system' as const,
  week_start: 'mon' as const,
  last_modified: now,
};

describe('@tasko/types schema round-trips', () => {
  it('parses a valid Item', () => {
    const parsed = ItemSchema.parse(validItem);
    expect(parsed.id).toBe(validItem.id);
    expect(parsed.title).toBe('Buy charger');
  });

  it('round-trips Item through JSON', () => {
    const parsed = ItemSchema.parse(validItem);
    const json = JSON.stringify(parsed);
    const reparsed = ItemSchema.parse(JSON.parse(json));
    expect(reparsed.id).toBe(parsed.id);
  });

  it('rejects an Item where start_date > due_date', () => {
    const bad = { ...validItem, start_date: '2026-05-25', due_date: '2026-05-20' };
    const result = ItemSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('start_date');
    }
  });

  it('accepts an Item where start_date === due_date', () => {
    const equal = { ...validItem, start_date: '2026-05-20', due_date: '2026-05-20' };
    const result = ItemSchema.safeParse(equal);
    expect(result.success).toBe(true);
  });

  it('parses a valid Project', () => {
    const parsed = ProjectSchema.parse(validProject);
    expect(parsed.name).toBe('My Project');
    expect(parsed.is_inbox).toBe(false);
  });

  it('round-trips Project through JSON', () => {
    const parsed = ProjectSchema.parse(validProject);
    const reparsed = ProjectSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed.id).toBe(parsed.id);
  });

  it('parses a valid Folder', () => {
    const parsed = FolderSchema.parse(validFolder);
    expect(parsed.name).toBe('Work');
  });

  it('round-trips Folder through JSON', () => {
    const parsed = FolderSchema.parse(validFolder);
    const reparsed = FolderSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed.id).toBe(parsed.id);
  });

  it('parses a valid Tag', () => {
    const parsed = TagSchema.parse(validTag);
    expect(parsed.name_lower).toBe('urgent');
  });

  it('round-trips Tag through JSON', () => {
    const parsed = TagSchema.parse(validTag);
    const reparsed = TagSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed.id).toBe(parsed.id);
  });

  it('parses a valid Config', () => {
    const parsed = ConfigSchema.parse(validConfig);
    expect(parsed.theme).toBe('system');
    expect(parsed.week_start).toBe('mon');
  });

  it('round-trips Config through JSON', () => {
    const parsed = ConfigSchema.parse(validConfig);
    const reparsed = ConfigSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed.schema_version).toBe(1);
  });

  it('INBOX_PROJECT_ID is 26 chars and is the designated sentinel value', () => {
    // INBOX_PROJECT_ID contains 'I' and 'O' which are excluded from the ULID base32 alphabet,
    // so it does NOT pass the strict UlidSchema regex. It is used via 'as ProjectId' cast.
    // This test documents the known behavior.
    expect(INBOX_PROJECT_ID).toHaveLength(26);
    expect(INBOX_PROJECT_ID).toBe('00000000000000000000INBOX0');
  });

  it('ItemCreateSchema rejects start_date > due_date', () => {
    const bad = {
      type: 'task' as const,
      project_id: VALID_PROJECT_ID,
      parent_id: null,
      title: 'Test',
      due_date: '2026-05-20',
      start_date: '2026-05-25',
      due_time: null,
      recurrence: null,
      status: 'todo' as const,
      priority: 'none' as const,
      tags: [],
    };
    const result = ItemCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('start_date');
    }
  });

  it('ItemCreateSchema accepts start_date <= due_date', () => {
    const good = {
      type: 'task' as const,
      project_id: VALID_PROJECT_ID,
      parent_id: null,
      title: 'Test',
      due_date: '2026-05-20',
      start_date: '2026-05-18',
      due_time: null,
      recurrence: null,
      status: 'todo' as const,
      priority: 'none' as const,
      tags: [],
    };
    const result = ItemCreateSchema.safeParse(good);
    expect(result.success).toBe(true);
  });

  it('ItemPatchSchema rejects start_date > due_date when both are present', () => {
    const bad = { start_date: '2026-05-25', due_date: '2026-05-20' };
    const result = ItemPatchSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('start_date');
    }
  });

  it('ItemPatchSchema accepts partial patch with only start_date (no due_date)', () => {
    const partial = { start_date: '2026-05-25' };
    const result = ItemPatchSchema.safeParse(partial);
    expect(result.success).toBe(true);
  });
});
