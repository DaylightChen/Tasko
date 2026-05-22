# Task 13 — Markdown notes (render + edit + keybindings)

## Goal

Layer the markdown render + custom editor keybindings onto the Notes field of the Task modal. Switch the plain `<textarea>` from task-07 to a render-or-edit-toggle surface: when the modal opens with non-empty notes → render mode (read-only markdown rendered via `marked` + sanitized via `DOMPurify`); clicking the rendered area or focusing the field → edit mode (plain `<textarea>` with custom keyboard handlers); pressing Tab out of the textarea or clicking outside commits + re-renders. Toolbar toggle "Edit / Preview" gives explicit control. Markdown features per UX §4: `**bold**`, `*italic*`, `[link](url)`, `- list items`, `- [ ] checklist items` (display-only — render as visually-checked spans with NO click handler). Custom textarea keybindings: `⌘B` / `⌘I` / `⌘K` (link helper), `Tab` inserts 2 spaces, `Shift+Tab` removes 2 leading spaces, Enter after `- [ ]` / `- ` continues the list.

## Context files

- `docs/ux/component-inventory.md#4-textarea--markdown-notes-` — full spec: modes (edit / render), toggling, dimensions (min 88px desktop / 112px mobile, max 320px with internal scroll), states.
- `docs/ux/microcopy.md#3-1-task-modal----labels` — field label "Notes", placeholder n/a (the field is empty by default).
- `docs/engineering/2026-05-18-architecture.md#6-3-markdown-library--marked--recommended-` — `marked` 14 + `DOMPurify` 3; checkbox renderer; link renderer with `target="_blank" rel="noopener noreferrer"`; no plugin ecosystem.
- `docs/engineering/2026-05-18-frontend-architecture.md#15-markdown-notes-implementation` — full skeleton: marked + DOMPurify + textarea keybindings via `lib/textarea-ops.ts`.
- `docs/engineering/2026-05-18-code-architecture.md#4-8-markdown-render`, §4.9 textarea keybindings — pure DOM helper signatures.
- `docs/ux/accessibility.md` — §3.3 textarea ARIA (`aria-multiline`, label association).

## Downstream dependencies

- **Task 19** (a11y audit) will verify the rendered markdown's accessibility (link target + rel attrs, list semantics, no scripts via DOMPurify).
- No later task should need to touch this module — markdown render is self-contained.

## Steps

1. **`lib/markdown.ts`** per `code-architecture.md` §4.8:
   ```ts
   import { marked, Renderer } from 'marked';
   import DOMPurify from 'dompurify';

   const renderer = new Renderer();
   renderer.checkbox = (checked: boolean) =>
     `<span class="md-checkbox" data-checked="${checked}" aria-hidden="true">${checked ? '☑' : '☐'}</span>`;
   renderer.link = (href, _title, text) => {
     const safe = escapeHtml(href);
     return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
   };

   export function renderMarkdown(source: string): string {
     const raw = marked.parse(source, { renderer, breaks: true, async: false }) as string;
     return DOMPurify.sanitize(raw, {
       USE_PROFILES: { html: true },
       ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
       ALLOWED_ATTR: ['href', 'target', 'rel', 'data-checked', 'aria-hidden', 'class'],
     });
   }
   ```
   - `escapeHtml(s)`: replace `& < > " '` with their entities. Required because the `renderer.link` receives the raw href.
   - Tests in `apps/web/src/lib/__tests__/markdown.test.ts`:
     - Bold, italic, code, link rendering matches expected HTML.
     - Markdown checkbox: `- [ ] foo` → `<li><span class="md-checkbox" data-checked="false" aria-hidden="true">☐</span> foo</li>`.
     - Link gets `target="_blank" rel="noopener noreferrer"`.
     - Script injection: `<script>alert(1)</script>` → stripped by DOMPurify.
     - `javascript:` URL: `[click](javascript:alert(1))` → DOMPurify strips the href (or the `<a>` entirely depending on config; verify either way the URL is not executable).
     - Plain text passes through.
2. **`lib/textarea-ops.ts`** per `code-architecture.md` §4.9 — pure DOM helpers:
   ```ts
   export function wrapSelection(ta: HTMLTextAreaElement, prefix: string, suffix: string): void;
   export function insertAtCursor(ta: HTMLTextAreaElement, text: string): void;
   export function continueListItem(ta: HTMLTextAreaElement): boolean;  // returns true if it inserted continuation
   export function insertLinkPrompt(ta: HTMLTextAreaElement): void;     // prompts inline for URL (use window.prompt for v1; could be a small popover in v1.1)
   export function unindentLine(ta: HTMLTextAreaElement): void;          // for Shift+Tab
   ```
   - `wrapSelection`: capture current selection, wrap, preserve cursor at the end of selection (after the suffix).
   - `insertAtCursor`: insert text at cursor, move cursor to after.
   - `continueListItem`: read the current line up to cursor; if it matches `^( *)- \[ \] (.*)$` or `^( *)- (.*)$`, insert a newline + the matching prefix at the cursor. Returns true if matched. Special case: if the line was just `- ` or `- [ ] ` with no content (empty list item) → terminate the list (insert just `\n` and remove the trailing `- ` from the previous line) — this matches common-practice editors like Linear / GitHub.
   - `unindentLine`: at the cursor's line start, if the first 2 chars are spaces, remove them.
   - Tests in `apps/web/src/lib/__tests__/textarea-ops.test.ts` (jsdom): construct a `<textarea>`, set value + selection, call each helper, assert resulting value + cursor position.
3. **TextareaMarkdown component** — `apps/web/src/components/textarea-markdown/`:
   - `index.tsx`:
     ```tsx
     export interface TextareaMarkdownProps {
       value: string;
       onChange: (next: string) => void;
       label?: string;
       'aria-label'?: string;
       placeholder?: string;
       autoFocus?: boolean;
       minHeight?: number;
       maxHeight?: number;
     }
     export function TextareaMarkdown(props: TextareaMarkdownProps): JSX.Element;
     ```
   - Internal state: `mode: 'edit' | 'preview'`. Initial: if `value` is empty → `'edit'`; else `'preview'`.
   - Edit mode: `<textarea>` with `onKeyDown` per step 2.
   - Preview mode: `<div className={styles.preview} dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />`. Click → switch to edit + focus the textarea.
   - On blur of textarea: switch to preview if `value` is non-empty.
   - Toolbar toggle button: a small `role="switch"` with `aria-checked` (Edit/Preview). The component renders its top-right toggle (Lucide `Eye` / `Pencil`).
   - Auto-grow on input: set `height` to scrollHeight, clamped between `minHeight` and `maxHeight` (default 88px / 320px desktop; 112px / 320px mobile via `useMatchMedia`).
   - Markdown checkboxes inside preview: rendered as styled spans, NOT clickable (per UX §4.6 + spec §4.3).
   - Pasted images: not supported (per UX §4.6). If user pastes an image, do nothing special — the image data ends up as text in the textarea which renders as garbled markdown; we accept that (no special interception in v1).
   - ARIA: native `<textarea aria-label="<label>">` + the toggle has `aria-checked` + `aria-label="Toggle Edit / Preview"`.
   - Reduced motion: the mode transition is instant (no fade between edit/preview).
4. **Integrate into Task modal** — `apps/web/src/views/task-modal/index.tsx`:
   - Replace the plain `<textarea>` for Notes with `<TextareaMarkdown value={form.notes} onChange={(v) => setForm({...form, notes: v})} aria-label="Notes" />`.
   - The field still lives behind the "More" disclosure per `screens.md` Task modal.
   - When the user opens an existing item with notes, the field starts in preview mode showing rendered markdown.
   - Submitting (Save) commits the latest text (which is what the parent form state has, since `onChange` keeps it synced).
5. **Tests** — `apps/web/src/components/textarea-markdown/__tests__/TextareaMarkdown.test.tsx`:
   - Render with empty value → edit mode (textarea focused if `autoFocus`).
   - Render with `value: '**hi**'` → preview mode with bold "hi".
   - Click on preview → enters edit mode, textarea focused with value.
   - Blur textarea (Tab) → preview mode.
   - In edit mode, select text + `⌘B` → wraps with `**…**`.
   - `⌘I` → `*…*`. `⌘K` → opens link helper (mock `window.prompt`; insert `[text](url)`).
   - Enter after `- [ ] foo` → continues with `- [ ] `.
   - Enter after `- ` (empty list item) → terminates list (removes `- ` and inserts blank line).
   - Tab inserts 2 spaces. Shift+Tab removes 2 leading spaces.
   - Markdown checkbox renders as `<span class="md-checkbox">…</span>` with `data-checked="false"`; no click handler (assert no `onclick` attribute).
6. **Integration smoke test** — `apps/web/src/views/task-modal/__tests__/task-modal-notes.test.tsx`:
   - Open Task modal with Notes containing markdown — expand "More" disclosure — assert preview rendering shows the formatted output.
   - Click the preview — assert it switches to textarea mode.
   - Type new markdown + click outside (or tab out) — assert preview re-renders with the updated text.
   - Save → PATCH includes the new notes.

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every test in step 5 + 6 passes.
- [ ] Manual: open the Task modal for an existing item, set Notes to `# Header\n\n**Bold** and *italic*.\n\n- [ ] todo item\n- [x] done item\n- Plain list.`. Tab out → preview shows H1, bold, italic, two checkboxes (one unchecked, one checked, both non-clickable), one bullet.
- [ ] Manual: clicking the rendered checklist items does NOT toggle them (display-only).
- [ ] Manual: in edit mode, select "foo" + `⌘B` → text becomes `**foo**`; `⌘I` on selection → `*foo*`.
- [ ] Manual: type `- ` + Enter → next line auto-continues with `- `. Type `- [ ] x` + Enter → next line `- [ ] `.
- [ ] Manual: rendered link `[Google](https://google.com)` has `target="_blank" rel="noopener noreferrer"` (verify via DOM inspector).
- [ ] Manual: pasting `<script>alert(1)</script>` into Notes + saving + reopening → preview shows the literal text without script execution (DOMPurify strips it).
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/lib/markdown.ts` (+ `__tests__/markdown.test.ts`)
  - `apps/web/src/lib/textarea-ops.ts` (+ `__tests__/textarea-ops.test.ts`)
  - `apps/web/src/components/textarea-markdown/index.tsx`, `styles.module.css`, `__tests__/TextareaMarkdown.test.tsx`
  - `apps/web/src/views/task-modal/__tests__/task-modal-notes.test.tsx`
- Modified:
  - `apps/web/src/views/task-modal/index.tsx` — Notes field uses TextareaMarkdown.
