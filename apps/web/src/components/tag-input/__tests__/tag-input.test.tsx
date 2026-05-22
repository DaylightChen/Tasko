import type { Tag, TagId } from '@tasko/types';
/**
 * Tests for TagInput component (task-07)
 * Covers:
 * - With no existing tags, typing "urgent" → suggestions show "Create 'urgent'"
 *   → Enter → onCreateTag called with "urgent" → chip added
 * - Typing "URGENT" when an existing tag "urgent" exists → suggestion shows existing
 *   tag with its preserved casing (not "Create 'urgent'")
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock useTagAutocomplete BEFORE importing the component
vi.mock('../../../api/tags', () => ({
  useTagAutocomplete: vi.fn(),
  useCreateTag: vi.fn(),
  useTags: vi.fn(),
}));

import { useTagAutocomplete } from '../../../api/tags';
import { TagInput } from '../index';

// Helper to build a minimal Tag object
function makeTag(id: string, name: string): Tag {
  return {
    id: id as TagId,
    schema_version: 1,
    name,
    name_lower: name.toLowerCase(),
    color: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('TagInput', () => {
  beforeEach(() => {
    // Default: no autocomplete results
    vi.mocked(useTagAutocomplete).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useTagAutocomplete>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the tag input without chips when value is empty', () => {
    render(
      <TagInput value={[]} tagsById={new Map()} onChange={vi.fn()} onCreateTag={vi.fn()} allTags={[]} />,
    );
    expect(screen.getByRole('combobox', { name: /add tag/i })).toBeInTheDocument();
  });

  it('typing "urgent" with no existing tags shows "Create \'urgent\'" suggestion', async () => {
    // Simulate debounce: the autocomplete returns empty (no existing tags)
    vi.mocked(useTagAutocomplete).mockReturnValue({
      data: { tags: [] },
    } as unknown as ReturnType<typeof useTagAutocomplete>);

    render(
      <TagInput value={[]} tagsById={new Map()} onChange={vi.fn()} onCreateTag={vi.fn()} allTags={[]} />,
    );

    const input = screen.getByRole('combobox', { name: /add tag/i });
    fireEvent.change(input, { target: { value: 'urgent' } });

    // After typing, the debounced query fires — we've mocked it to return empty
    // The component should show "Create 'urgent'" in the dropdown
    await waitFor(() => {
      expect(screen.getByText(/create/i)).toBeInTheDocument();
    });

    // The Create option should show the typed name
    expect(screen.getByText(/urgent/i)).toBeInTheDocument();
  });

  it('pressing Enter on "Create" option calls onCreateTag and adds chip', async () => {
    vi.mocked(useTagAutocomplete).mockReturnValue({
      data: { tags: [] },
    } as unknown as ReturnType<typeof useTagAutocomplete>);

    const newTag = makeTag('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'urgent');
    const onCreateTag = vi.fn().mockResolvedValue(newTag);
    const onChange = vi.fn();

    render(
      <TagInput value={[]} tagsById={new Map()} onChange={onChange} onCreateTag={onCreateTag} allTags={[]} />,
    );

    const input = screen.getByRole('combobox', { name: /add tag/i });
    fireEvent.change(input, { target: { value: 'urgent' } });

    // Wait for "Create" suggestion to appear
    await waitFor(() => {
      expect(screen.getByText(/create/i)).toBeInTheDocument();
    });

    // Press Enter to commit
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // onCreateTag should be called with the normalized name (no '#')
    expect(onCreateTag).toHaveBeenCalledWith('urgent');

    // onChange should be called with the new tag id
    expect(onChange).toHaveBeenCalledWith([newTag.id]);
  });

  it('typing "URGENT" when tag "urgent" exists → shows existing tag (not Create)', async () => {
    const existingTag = makeTag('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'urgent');

    // Autocomplete returns the existing tag (case-insensitive match from server)
    vi.mocked(useTagAutocomplete).mockReturnValue({
      data: { tags: [existingTag] },
    } as unknown as ReturnType<typeof useTagAutocomplete>);

    render(
      <TagInput
        value={[]}
        tagsById={new Map([[existingTag.id, existingTag]])}
        onChange={vi.fn()}
        onCreateTag={vi.fn()}
        allTags={[existingTag]}
      />,
    );

    const input = screen.getByRole('combobox', { name: /add tag/i });
    fireEvent.change(input, { target: { value: 'URGENT' } });

    // The suggestion should show the existing tag "#urgent" (its preserved casing)
    await waitFor(() => {
      // Should NOT show "Create 'urgent'" — exact match exists
      expect(screen.queryByText(/create/i)).toBeNull();
    });

    // Should show the existing tag with its name
    expect(screen.getByText(/#urgent/i)).toBeInTheDocument();
  });

  it('Backspace on empty input removes last chip', () => {
    const tagA = makeTag('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'work');
    const tagB = makeTag('01ARZ3NDEKTSV4RRFFQ69G5FBV', 'urgent');
    const onChange = vi.fn();

    render(
      <TagInput
        value={[tagA.id, tagB.id]}
        tagsById={
          new Map([
            [tagA.id, tagA],
            [tagB.id, tagB],
          ])
        }
        onChange={onChange}
        onCreateTag={vi.fn()}
        allTags={[tagA, tagB]}
      />,
    );

    const input = screen.getByRole('combobox', { name: /add tag/i });
    // Input is empty, so Backspace removes last chip (tagB)
    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(onChange).toHaveBeenCalledWith([tagA.id]);
  });

  it('clicking X on chip removes that tag', () => {
    const tagA = makeTag('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'work');
    const onChange = vi.fn();

    render(
      <TagInput
        value={[tagA.id]}
        tagsById={new Map([[tagA.id, tagA]])}
        onChange={onChange}
        onCreateTag={vi.fn()}
        allTags={[tagA]}
      />,
    );

    const removeBtn = screen.getByRole('button', { name: /remove tag work/i });
    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('displays existing chips with # prefix', () => {
    const tagA = makeTag('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'work');
    render(
      <TagInput
        value={[tagA.id]}
        tagsById={new Map([[tagA.id, tagA]])}
        onChange={vi.fn()}
        onCreateTag={vi.fn()}
        allTags={[tagA]}
      />,
    );

    expect(screen.getByText('#work')).toBeInTheDocument();
  });
});
