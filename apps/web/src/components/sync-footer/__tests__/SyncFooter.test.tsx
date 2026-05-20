/**
 * Tests for SyncFooter component.
 * Footer now shows a HardDrive icon + "Local · <dataDir>" caption (was the
 * preview's cloud-check + "Synced Xm ago"; we don't sync, so we surface the
 * local data dir instead).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SyncFooter } from '../index';

describe('SyncFooter', () => {
  it('renders the local-files caption when no data-dir is provided', () => {
    render(<SyncFooter />);
    expect(screen.getByText('Local files')).toBeTruthy();
  });

  it('renders the data-dir inline when provided', () => {
    render(<SyncFooter dataDir="/home/user/.tasko" />);
    expect(screen.getByText('Local · /home/user/.tasko')).toBeTruthy();
  });

  it('does not surface a data-dir when dataDir is undefined', () => {
    render(<SyncFooter />);
    expect(screen.queryByText(/Local · /)).toBeNull();
  });
});
