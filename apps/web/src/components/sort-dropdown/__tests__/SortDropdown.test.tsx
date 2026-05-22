/**
 * Tests for SortDropdown component (task-06)
 * Covers: renders trigger with "Sort: <current>", default options, custom options,
 *         composes Dropdown (role="combobox" trigger), onChange fires.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { COMPLETED_SORT_OPTIONS, DEFAULT_SORT_OPTIONS, SortDropdown, TRASH_SORT_OPTIONS } from '../index';

describe('SortDropdown', () => {
  it('renders trigger label "Sort: Due date (earliest)" for default value', () => {
    render(<SortDropdown value="due_asc" onChange={() => {}} />);
    // The Dropdown trigger has aria-label which includes the label
    expect(screen.getByRole('combobox', { name: /Sort: Due date \(earliest\)/ })).toBeTruthy();
  });

  it('trigger has role="combobox" (Dropdown primitive)', () => {
    render(<SortDropdown value="due_asc" onChange={() => {}} />);
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('opens dropdown on click and shows all 4 default options', () => {
    render(<SortDropdown value="due_asc" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('calls onChange with selected option value', () => {
    const onChange = vi.fn();
    render(<SortDropdown value="due_asc" onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: /Priority \(high to low\)/ }));
    expect(onChange).toHaveBeenCalledWith('priority_desc');
  });

  it('renders "Sort: Priority (high to low)" when value is priority_desc', () => {
    render(<SortDropdown value="priority_desc" onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: /Sort: Priority \(high to low\)/ })).toBeTruthy();
  });

  it('uses custom options when provided', () => {
    render(<SortDropdown value="trashed_desc" onChange={() => {}} options={TRASH_SORT_OPTIONS} />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: /Recently trashed/ })).toBeTruthy();
  });

  it('DEFAULT_SORT_OPTIONS has 4 entries', () => {
    expect(DEFAULT_SORT_OPTIONS).toHaveLength(4);
  });

  it('TRASH_SORT_OPTIONS has "Recently trashed" first', () => {
    expect(TRASH_SORT_OPTIONS[0]?.value).toBe('trashed_desc');
  });

  it('COMPLETED_SORT_OPTIONS has "Recently completed" first', () => {
    expect(COMPLETED_SORT_OPTIONS[0]?.value).toBe('completed_desc');
  });
});
