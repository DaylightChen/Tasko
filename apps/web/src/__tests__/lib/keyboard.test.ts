/**
 * keyboard.test.ts
 *
 * Tests for lib/keyboard.ts — matchHotkey and isModKey helpers.
 *
 * Acceptance criteria covered:
 * - matchHotkey correctly recognises Mod+k (platform-aware)
 * - matchHotkey matches single-key specs ('t', '?', 'Enter', 'Space')
 * - matchHotkey rejects key when modifier presence is wrong
 * - isModifierCombo correctly identifies modifier specs
 */
import { describe, expect, it } from 'vitest';
import { isModKey, isModifierCombo, matchHotkey } from '../../lib/keyboard';

function makeEvent(overrides: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, ...overrides });
}

describe('matchHotkey', () => {
  describe('single-key specs', () => {
    it('matches lowercase single char', () => {
      expect(matchHotkey('t', makeEvent({ key: 't' }))).toBe(true);
    });

    it('matches uppercase spec against lowercase key (case-insensitive)', () => {
      expect(matchHotkey('T', makeEvent({ key: 't' }))).toBe(true);
    });

    it('does not match when ctrlKey is pressed on single-key spec (non-Mac env)', () => {
      // In jsdom, navigator.platform is empty → isMac()=false → isModKey uses ctrlKey
      // So pressing Ctrl+T should NOT trigger the single-key 't' binding
      expect(matchHotkey('t', makeEvent({ key: 't', ctrlKey: true }))).toBe(false);
    });

    it('matches "?" key', () => {
      expect(matchHotkey('?', makeEvent({ key: '?' }))).toBe(true);
    });

    it('matches "?" even when shiftKey is true (US keyboard sends shift+/ = ?)', () => {
      // On a standard US keyboard, pressing ? sends e.key='?' with e.shiftKey=true.
      // matchHotkey must NOT reject this because '?' is a named key, not a shifted char.
      // REAL BUG: the current implementation rejects '?' + shiftKey=true, so this test
      // documents the expected (correct) behaviour and WILL FAIL until fixed.
      // See apps/web/src/lib/keyboard.ts: the line
      //   if (!requireShift && e.shiftKey) return false;
      // should have an exception for named keys where the shift is part of the glyph.
      expect(matchHotkey('?', makeEvent({ key: '?', shiftKey: true }))).toBe(true);
    });

    it('matches named key "Enter"', () => {
      expect(matchHotkey('Enter', makeEvent({ key: 'Enter' }))).toBe(true);
    });

    it('matches "Space" to " " key value', () => {
      expect(matchHotkey('Space', makeEvent({ key: ' ' }))).toBe(true);
    });

    it('matches "Backspace"', () => {
      expect(matchHotkey('Backspace', makeEvent({ key: 'Backspace' }))).toBe(true);
    });

    it('matches "ArrowDown"', () => {
      expect(matchHotkey('ArrowDown', makeEvent({ key: 'ArrowDown' }))).toBe(true);
    });
  });

  describe('modifier combos', () => {
    it('matches Mod+k with metaKey on Mac-like environment', () => {
      // navigator.platform is 'MacIntel' in jsdom by default (may vary)
      // We test both: if isMac() → metaKey, if not → ctrlKey
      // In jsdom, platform is empty string, so isModKey returns ctrlKey
      const withCtrl = makeEvent({ key: 'k', ctrlKey: true });
      const withMeta = makeEvent({ key: 'k', metaKey: true });
      // At least one should match depending on platform detection
      const result = matchHotkey('Mod+k', withCtrl) || matchHotkey('Mod+k', withMeta);
      expect(result).toBe(true);
    });

    it('does not match Mod+k without modifier', () => {
      expect(matchHotkey('Mod+k', makeEvent({ key: 'k' }))).toBe(false);
    });

    it('matches Mod+Shift+z with shift and mod', () => {
      const e = makeEvent({ key: 'z', ctrlKey: true, shiftKey: true });
      // In non-Mac environment, ctrlKey satisfies isModKey
      // (jsdom platform is empty → not Mac → ctrlKey)
      const result = matchHotkey('Mod+Shift+z', e);
      // Either ctrl or meta version should match
      const eMeta = makeEvent({ key: 'z', metaKey: true, shiftKey: true });
      expect(result || matchHotkey('Mod+Shift+z', eMeta)).toBe(true);
    });

    it('does not match Mod+k when shiftKey is also held', () => {
      const e = makeEvent({ key: 'k', ctrlKey: true, shiftKey: true });
      expect(matchHotkey('Mod+k', e)).toBe(false);
    });
  });
});

describe('isModifierCombo', () => {
  it('returns true for Mod+k', () => {
    expect(isModifierCombo('Mod+k')).toBe(true);
  });

  it('returns true for Mod+Shift+z', () => {
    expect(isModifierCombo('Mod+Shift+z')).toBe(true);
  });

  it('returns true for Ctrl+k', () => {
    expect(isModifierCombo('Ctrl+k')).toBe(true);
  });

  it('returns false for single key "t"', () => {
    expect(isModifierCombo('t')).toBe(false);
  });

  it('returns false for "?"', () => {
    expect(isModifierCombo('?')).toBe(false);
  });

  it('returns false for "Enter"', () => {
    expect(isModifierCombo('Enter')).toBe(false);
  });
});

describe('isModKey', () => {
  it('returns true when ctrlKey is pressed (non-Mac environment)', () => {
    // In jsdom the platform is empty, so isMac() returns false → isModKey uses ctrlKey
    const e = makeEvent({ key: 'k', ctrlKey: true });
    // One of metaKey or ctrlKey should make isModKey true
    const eWithMeta = makeEvent({ key: 'k', metaKey: true });
    expect(isModKey(e) || isModKey(eWithMeta)).toBe(true);
  });

  it('returns false when neither meta nor ctrl is held', () => {
    const e = makeEvent({ key: 'k' });
    expect(isModKey(e)).toBe(false);
  });
});
