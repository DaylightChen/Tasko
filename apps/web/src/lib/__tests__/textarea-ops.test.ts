/**
 * Tests for lib/textarea-ops.ts
 * Pure DOM helpers tested with jsdom HTMLTextAreaElement instances.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  continueListItem,
  insertAtCursor,
  insertLinkPrompt,
  unindentLine,
  wrapSelection,
} from '../textarea-ops';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeTextarea(value: string, start: number, end: number = start): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.setSelectionRange(start, end);
  return ta;
}

// ---------------------------------------------------------------------------
// wrapSelection
// ---------------------------------------------------------------------------

describe('wrapSelection', () => {
  it('empty selection (caret) inserts prefix+suffix with cursor between the pairs', () => {
    const ta = makeTextarea('hello', 5);
    wrapSelection(ta, '**', '**');
    expect(ta.value).toBe('hello****');
    // Cursor lands between the two ** pairs so the user can immediately type
    // inside the bold markers.
    expect(ta.selectionStart).toBe(7);
    expect(ta.selectionEnd).toBe(7);
  });

  it('with selection "foo" wraps as **foo** and places cursor after closing suffix', () => {
    // value = "foo", selection covers all 3 chars
    const ta = makeTextarea('foo', 0, 3);
    wrapSelection(ta, '**', '**');
    expect(ta.value).toBe('**foo**');
    // cursor should be after the closing ** → position 7
    expect(ta.selectionStart).toBe(7);
    expect(ta.selectionEnd).toBe(7);
  });

  it('wraps mid-string selection correctly', () => {
    const ta = makeTextarea('say hello world', 4, 9); // selects "hello"
    wrapSelection(ta, '*', '*');
    expect(ta.value).toBe('say *hello* world');
    // cursor after closing * → 4 + 1 + 5 + 1 = 11
    expect(ta.selectionStart).toBe(11);
  });

  it('italic *…* variant', () => {
    const ta = makeTextarea('bar', 0, 3);
    wrapSelection(ta, '*', '*');
    expect(ta.value).toBe('*bar*');
    expect(ta.selectionStart).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// insertAtCursor
// ---------------------------------------------------------------------------

describe('insertAtCursor', () => {
  it('inserts text at cursor and moves cursor past the inserted text', () => {
    const ta = makeTextarea('hello world', 5); // cursor after "hello"
    insertAtCursor(ta, ' beautiful');
    expect(ta.value).toBe('hello beautiful world');
    expect(ta.selectionStart).toBe(15);
    expect(ta.selectionEnd).toBe(15);
  });

  it('inserts at start of empty textarea', () => {
    const ta = makeTextarea('', 0);
    insertAtCursor(ta, 'X');
    expect(ta.value).toBe('X');
    expect(ta.selectionStart).toBe(1);
  });

  it('replaces selection when selection is non-empty', () => {
    const ta = makeTextarea('abc', 1, 2); // selects "b"
    insertAtCursor(ta, 'Z');
    expect(ta.value).toBe('aZc');
    expect(ta.selectionStart).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// continueListItem
// ---------------------------------------------------------------------------

describe('continueListItem', () => {
  describe('checkbox list continuation', () => {
    it('returns true and inserts \\n- [ ]  after "- [ ] foo"', () => {
      const line = '- [ ] foo';
      const ta = makeTextarea(line, line.length);
      const result = continueListItem(ta);
      expect(result).toBe(true);
      expect(ta.value).toBe('- [ ] foo\n- [ ] ');
      // cursor should be at end
      expect(ta.selectionStart).toBe(ta.value.length);
    });

    it('returns true and terminates list when checkbox line content is empty ("- [ ] ")', () => {
      const line = '- [ ] ';
      const ta = makeTextarea(line, line.length);
      const result = continueListItem(ta);
      expect(result).toBe(true);
      // The "- [ ] " prefix should be removed; value becomes empty string
      expect(ta.value).toBe('');
    });
  });

  describe('bullet list continuation', () => {
    it('returns true and inserts \\n-  after "- foo"', () => {
      const line = '- foo';
      const ta = makeTextarea(line, line.length);
      const result = continueListItem(ta);
      expect(result).toBe(true);
      expect(ta.value).toBe('- foo\n- ');
      expect(ta.selectionStart).toBe(ta.value.length);
    });

    it('returns true and terminates list when bullet line is "- " (empty)', () => {
      const line = '- ';
      const ta = makeTextarea(line, line.length);
      const result = continueListItem(ta);
      expect(result).toBe(true);
      // "- " removed; value becomes empty
      expect(ta.value).toBe('');
    });
  });

  describe('non-list line', () => {
    it('returns false and leaves value unchanged for plain text', () => {
      const line = 'not a list';
      const ta = makeTextarea(line, line.length);
      const result = continueListItem(ta);
      expect(result).toBe(false);
      expect(ta.value).toBe('not a list');
    });

    it('returns false for empty line', () => {
      const ta = makeTextarea('', 0);
      const result = continueListItem(ta);
      expect(result).toBe(false);
    });
  });

  describe('multi-line: continuation is inserted at cursor, not at end', () => {
    it('inserts continuation after last line when cursor is at end of last line', () => {
      const text = 'first line\n- item';
      const ta = makeTextarea(text, text.length);
      const result = continueListItem(ta);
      expect(result).toBe(true);
      expect(ta.value).toBe('first line\n- item\n- ');
    });
  });
});

// ---------------------------------------------------------------------------
// unindentLine
// ---------------------------------------------------------------------------

describe('unindentLine', () => {
  it('removes 2 leading spaces from the current line', () => {
    const ta = makeTextarea('  foo', 5); // cursor at end
    unindentLine(ta);
    expect(ta.value).toBe('foo');
  });

  it('does nothing when line has no leading spaces', () => {
    const ta = makeTextarea('foo', 3);
    unindentLine(ta);
    expect(ta.value).toBe('foo');
  });

  it('removes only 2 spaces even when more are present', () => {
    const ta = makeTextarea('    foo', 7); // 4 leading spaces
    unindentLine(ta);
    expect(ta.value).toBe('  foo'); // only 2 removed
  });

  it('handles multi-line: only unindents the current line', () => {
    const text = 'line1\n  line2';
    const ta = makeTextarea(text, text.length); // cursor at end of line2
    unindentLine(ta);
    expect(ta.value).toBe('line1\nline2');
  });

  it('clamps cursor to lineStart when cursor was inside the removed spaces', () => {
    // cursor at position 1 (inside the 2-space indent)
    const ta = makeTextarea('  foo', 1);
    unindentLine(ta);
    // After removing 2 spaces, cursor can't be at 1 anymore; should clamp
    expect(ta.value).toBe('foo');
    expect(ta.selectionStart).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// insertLinkPrompt
// ---------------------------------------------------------------------------

describe('insertLinkPrompt', () => {
  // biome-ignore lint/suspicious/noExplicitAny: vi.spyOn type narrowing workaround
  let promptSpy: any;

  beforeEach(() => {
    promptSpy = vi.spyOn(window, 'prompt');
  });

  afterEach(() => {
    promptSpy.mockRestore();
  });

  it('with selected text, inserts [selected](url) markdown link', () => {
    promptSpy.mockReturnValue('https://example.com');
    const ta = makeTextarea('click here', 0, 10); // "click here" selected
    insertLinkPrompt(ta);
    expect(ta.value).toBe('[click here](https://example.com)');
    expect(ta.selectionStart).toBe(ta.value.length);
  });

  it('with no selection, uses "link text" as label', () => {
    promptSpy.mockReturnValue('https://example.com');
    const ta = makeTextarea('', 0);
    insertLinkPrompt(ta);
    expect(ta.value).toBe('[link text](https://example.com)');
  });

  it('does nothing when prompt is cancelled (returns null)', () => {
    promptSpy.mockReturnValue(null);
    const ta = makeTextarea('some text', 0, 4);
    insertLinkPrompt(ta);
    expect(ta.value).toBe('some text');
  });

  it('cursor is placed after the inserted link markdown', () => {
    promptSpy.mockReturnValue('https://example.com');
    const ta = makeTextarea('click here', 0, 10);
    insertLinkPrompt(ta);
    const expected = '[click here](https://example.com)';
    expect(ta.selectionStart).toBe(expected.length);
    expect(ta.selectionEnd).toBe(expected.length);
  });
});
