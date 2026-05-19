/**
 * Pure DOM helpers for textarea editing operations.
 * No React dependencies — these operate directly on HTMLTextAreaElement.
 */

/**
 * Wrap the current selection with prefix/suffix (e.g. ** for bold, * for italic).
 * If no selection, insert prefix+suffix and place cursor between them.
 */
export function wrapSelection(ta: HTMLTextAreaElement, prefix: string, suffix: string): void {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.slice(start, end);
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);

  const replacement = `${prefix}${selected}${suffix}`;
  ta.value = before + replacement + after;

  // For an empty selection, place the cursor BETWEEN the two pairs so the user
  // can start typing inside the bold/italic markers. For a non-empty selection,
  // place it AFTER the closing suffix.
  const newCursor =
    selected.length === 0 ? start + prefix.length : start + prefix.length + selected.length + suffix.length;
  ta.setSelectionRange(newCursor, newCursor);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Insert text at cursor position, moving cursor to after the inserted text.
 */
export function insertAtCursor(ta: HTMLTextAreaElement, text: string): void {
  const start = ta.selectionStart;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(ta.selectionEnd);

  ta.value = before + text + after;
  const newCursor = start + text.length;
  ta.setSelectionRange(newCursor, newCursor);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * If the current line (up to cursor) is a list item, insert a continuation.
 * - `- [ ] content` → inserts `\n<indent>- [ ] `
 * - `- content` → inserts `\n<indent>- `
 * - Empty list item (`- ` or `- [ ] ` with no content) → terminates: remove the
 *   trailing marker from the current line and insert a bare `\n`.
 *
 * Returns true if continuation was inserted (caller should preventDefault on Enter).
 */
export function continueListItem(ta: HTMLTextAreaElement): boolean {
  const cursorPos = ta.selectionStart;
  const text = ta.value;

  // Find the start of the current line
  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
  const currentLine = text.slice(lineStart, cursorPos);

  // Match checkbox list item: optional indent + "- [ ] " or "- [x] " + optional content
  const checkboxMatch = currentLine.match(/^( *)- \[[ x]\] (.*)$/);
  // Match plain list item: optional indent + "- " + optional content
  const bulletMatch = !checkboxMatch ? currentLine.match(/^( *)- (.*)$/) : null;

  if (checkboxMatch) {
    const indent = checkboxMatch[1] ?? '';
    const content = checkboxMatch[2] ?? '';

    if (content.trim() === '') {
      // Empty item — terminate the list
      // Remove the "- [ ] " (or "- [x] ") from this line
      const before = text.slice(0, lineStart);
      const after = text.slice(cursorPos);
      ta.value = before + after;
      const newCursor = lineStart;
      ta.setSelectionRange(newCursor, newCursor);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    // Continue with a new unchecked item
    const continuation = `\n${indent}- [ ] `;
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    ta.value = before + continuation + after;
    const newCursor = cursorPos + continuation.length;
    ta.setSelectionRange(newCursor, newCursor);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  if (bulletMatch) {
    const indent = bulletMatch[1] ?? '';
    const content = bulletMatch[2] ?? '';

    if (content.trim() === '') {
      // Empty item — terminate the list
      const before = text.slice(0, lineStart);
      const after = text.slice(cursorPos);
      ta.value = before + after;
      const newCursor = lineStart;
      ta.setSelectionRange(newCursor, newCursor);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    // Continue with a new bullet
    const continuation = `\n${indent}- `;
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    ta.value = before + continuation + after;
    const newCursor = cursorPos + continuation.length;
    ta.setSelectionRange(newCursor, newCursor);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return false;
}

/**
 * Prompt for a URL via window.prompt and insert a markdown link at cursor.
 * If text is selected, that text becomes the link label.
 * Returns true if the value changed (URL was provided), false if cancelled.
 */
export function insertLinkPrompt(ta: HTMLTextAreaElement): boolean {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selectedText = ta.value.slice(start, end);

  const url = window.prompt('Enter link URL:');
  if (url == null) return false; // user cancelled

  const label = selectedText.trim() !== '' ? selectedText : 'link text';
  const linkMarkdown = `[${label}](${url})`;

  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  ta.value = before + linkMarkdown + after;

  const newCursor = start + linkMarkdown.length;
  ta.setSelectionRange(newCursor, newCursor);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/**
 * Remove 2 leading spaces from the current line (Shift+Tab to unindent).
 */
export function unindentLine(ta: HTMLTextAreaElement): void {
  const cursorPos = ta.selectionStart;
  const text = ta.value;

  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
  const lineContent = text.slice(lineStart);

  if (lineContent.startsWith('  ')) {
    const before = text.slice(0, lineStart);
    const after = text.slice(lineStart + 2);
    ta.value = before + after;

    // Adjust cursor: if cursor was within the removed spaces, clamp to lineStart
    const newCursor = Math.max(lineStart, cursorPos - 2);
    ta.setSelectionRange(newCursor, newCursor);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
