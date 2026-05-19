/**
 * Tests for SyncFooter component (task-06)
 * Covers: "Tasko v1.0" text, data-dir display, missing data-dir fallback.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SyncFooter } from '../index';

describe('SyncFooter', () => {
  it('renders "Tasko v1.0"', () => {
    render(<SyncFooter />);
    expect(screen.getByText('Tasko v1.0')).toBeTruthy();
  });

  it('renders data-dir when provided', () => {
    render(<SyncFooter dataDir="/home/user/.tasko" />);
    expect(screen.getByText(/Local files in \/home\/user\/.tasko/)).toBeTruthy();
  });

  it('does not render data-dir section when dataDir is undefined', () => {
    render(<SyncFooter />);
    expect(screen.queryByText(/Local files in/)).toBeNull();
  });

  it('shows the version and data-dir together', () => {
    render(<SyncFooter dataDir="/tmp/tasko" />);
    // Both texts are present
    expect(screen.getByText('Tasko v1.0')).toBeTruthy();
    expect(screen.getByText(/Local files in \/tmp\/tasko/)).toBeTruthy();
  });
});
