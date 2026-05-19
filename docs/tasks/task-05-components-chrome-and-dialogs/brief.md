# Task 05 — Components: chrome and dialogs

## Goal

Implement the cross-cutting UI primitives that every feature task relies on: Button, IconButton, TextInput, Modal, Sheet (mobile shell — ships, not QA-targeted), Snackbar (full component matching task-04's host), Tooltip, Dropdown, EmptyState, Skeleton, ConfirmationPrompt. Each component is in its own folder under `apps/web/src/components/<name>/` with `index.tsx`, `styles.module.css`, and a `__tests__/<Name>.test.tsx`. Components are presentational — they accept data + callbacks as props, no `useQuery` / `useMutation` calls. Every state from `component-inventory.md` is implemented; every keyboard contract is honored; every ARIA role / label is present. Variant + state CSS uses `data-*` attributes per `frontend-architecture.md` §5.2.

## Context files

- `docs/ux/component-inventory.md` — sections 1 (Button), 2 (IconButton), 3 (TextInput), 8 (Dropdown), 14 (Modal), 15 (Sheet), 16 (Snackbar), 17 (Tooltip), 35 (EmptyState), 36 (Skeleton), 37 (ConfirmationPrompt). Read each section's variants, states, sizes, keyboard/ARIA, edge cases.
- `docs/ux/design-language.md` — tokens. Every dimension, color, spacing, motion, radius must come from `var(--…)` not literals.
- `docs/ux/accessibility.md` — §2.5 focus indicator (always 2px accent outline 2px offset, `:focus-visible`), §3.1 buttons (`aria-label` for icon-only), §3.2 text input (`aria-required`, `aria-invalid`, `aria-describedby`), §4.1 modal focus trap, §3.9 snackbar (`role="status"` polite, `role="alert"` assertive, focus NOT stolen), §3.14 live regions.
- `docs/ux/microcopy.md` — §4 button labels, §5 empty states (every variant), §6 confirmation prompts (every variant — Parent completion, Soft-delete, Permanent delete, Empty Trash, Move all overdue, Unsaved changes, Delete folder, Delete project), §7 snackbar variants, §8 tooltip text.
- `docs/ux/interaction-patterns.md` — §5 modal stacking policy (one modal at a time + unsaved-changes guard), §11 confirmation policy (which destructive actions confirm, when Cancel is initial focus), §12 undo policy (snackbar action button labels).
- `docs/engineering/2026-05-18-frontend-architecture.md#5-component-layer` — CSS Modules + `data-attr` variant pattern.
- `docs/engineering/2026-05-18-code-architecture.md#4-frontend----apps-web-src-` — interfaces (TaskListRow shown in §4.6 — for task-05, that's not built yet; just the chrome).

## Downstream dependencies

- **Task 06** builds row/picker primitives that compose Button, IconButton, TextInput. Keep prop names stable.
- **Task 07** composes the Modal + Dropdown + TextInput into the Task modal and the field popovers. Modal's API (open/close, header/body/footer slots, focus-trap, unsaved-changes guard) is the contract.
- **Task 08+** invokes Snackbar via `useSnackbarStore.show(...)`. The store interface from task-04 stays.
- **Task 12** uses ConfirmationPrompt for permanent delete + empty trash + parent completion (all variants from microcopy §6).
- **Task 18** uses Dropdown for the context-menu component family (right-click menus).

## Steps

Each component below follows the same pattern: `index.tsx` exports the React component + a TypeScript prop type; `styles.module.css` uses tokens via `var(--…)`; `__tests__/<Name>.test.tsx` (Vitest + Testing Library) covers default render, each variant, each state, keyboard interactions, ARIA. Repeat for each component.

1. **Button** (`components/button/`) — variants `'primary' | 'secondary' | 'ghost' | 'destructive'`, sizes `'sm' | 'md' | 'lg'`. States: default, hover, focus, active, disabled, loading. Loading shows a 16px `Loader2` Lucide icon (rotating) and replaces the label; `aria-busy="true"`. Native `<button>`. Props: `variant`, `size`, `isLoading`, `disabled`, `type='button'` default, children, standard event handlers.
   ```tsx
   export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
     variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
     size?: 'sm' | 'md' | 'lg';
     isLoading?: boolean;
   }
   ```
   CSS uses data-attributes: `[data-variant="primary"]`, `[data-size="md"]`. Hover and focus rules use `:hover` and `:focus-visible` directly — not `data-state`.
2. **IconButton** (`components/icon-button/`) — props: `icon: LucideIcon`, `aria-label: string` (required), variant `'transparent' | 'subtle'`, size `'sm' | 'md' | 'lg'` (28/32/44px square; lg for mobile touch). Always renders a tooltip on hover (delay 500ms) if `tooltip` prop is set (which is just an alias for `aria-label` rendered as a Tooltip — the actual `aria-label` always exists for SR).
3. **TextInput** (`components/text-input/`) — single-line. Props: `label?`, `placeholder?`, `value`, `onChange`, `error?: string`, `helper?: string`, `required?: boolean`, `disabled?`, `readOnly?`, `size: 'sm' | 'md'`, `inputMode`, `autoFocus`. Renders an internal `<input>` with associated `<label>` (use a generated id via `useId()`). On error, set `aria-invalid="true"` + `aria-describedby={errorId}` and render an `AlertCircle` icon prefix on the helper line. On focus, the input border becomes accent; the wrapper gets the 2px focus ring.
4. **Dropdown** (`components/dropdown/`) — generic listbox / select. Trigger looks like a Secondary button + chevron-down. Menu uses `@floating-ui/react` for positioning (with `flip` middleware so it flips above when below has no room). Each item: 32px row desktop, 44px mobile, optional left icon, label, optional right check (selected) or trailing meta. `role="combobox"` on trigger if typeahead, else `role="button"`. Menu: `role="listbox"`, items `role="option"`. Arrow keys navigate, Enter selects, Esc closes, focus returns to trigger. First-letter typeahead jumps to next matching item. Max height 320px with internal scroll. Props:
   ```tsx
   export interface DropdownProps<T extends string> {
     options: Array<{ value: T; label: string; icon?: LucideIcon; disabled?: boolean }>;
     value: T;
     onChange: (value: T) => void;
     ariaLabel: string;
     placeholder?: string;
     placement?: 'bottom-start' | 'top-start' | 'bottom-end' | 'top-end';
   }
   ```
5. **Modal** (`components/modal/`) — per `component-inventory.md` §14:
   - Backdrop: `scrim` token, fades in `motion-fast`.
   - Container: `surface`, `radius-lg`, `elevation-3`, centered, max-width prop (default 560 for Task modal, 480 for confirm). Header (title `text-h1` + close button), Body (`space-6` padding desktop), Footer (right-aligned action buttons; secondary on the left of primary).
   - `role="dialog"` or `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`.
   - **Focus trap**: on open, focus moves to `props.initialFocus` (a ref to e.g. the Due date field); if not provided, the first interactive element. Tab/Shift+Tab cycle within. Esc triggers `onClose` (with unsaved-changes guard if `props.dirty === true`).
   - **Click on backdrop** triggers `onClose` (same guard).
   - **Unsaved-changes guard** (`§14.6`): if `dirty === true` and user attempts close, show an inline prompt at the bottom: "Discard changes?" with [Keep editing] [Discard] buttons. The prompt overlays the modal (it doesn't replace it). Esc on the prompt cancels close (keeps editing).
   - **One-modal-at-a-time policy** (§7.11 + interaction-patterns §5): the singleton `<ModalHost>` (we DON'T need this here; the modal mounts via portal where called). The policy is enforced by callers — the views/tasks that open modals know not to open a second one. Document this in the Modal's JSDoc.
   - **Reduced motion**: opacity fade only when `prefers-reduced-motion: reduce`. The motion tokens already have media-query overrides (will be added in task-19); the Modal's own transition uses `var(--motion-medium)` and `var(--ease-decelerate)` for enter, `var(--motion-fast)` `var(--ease-accelerate)` for exit.
   - **On close**: focus returns to `props.returnFocusTo` (a ref to the trigger). If absent, restores to whatever was focused before the modal opened.
   - Props:
     ```tsx
     export interface ModalProps {
       open: boolean;
       onClose: () => void;
       title: string;
       maxWidth?: number;
       dirty?: boolean;
       initialFocus?: React.RefObject<HTMLElement>;
       returnFocusTo?: React.RefObject<HTMLElement>;
       footer?: React.ReactNode;
       children: React.ReactNode;
       role?: 'dialog' | 'alertdialog';
     }
     ```
6. **Sheet** (`components/sheet/`) — mobile equivalent of Modal per §15. Bottom-anchored, slide-up, drag-handle (4px×32px `border-strong` `radius-full`), top corners `radius-lg`, full-width. Dragging down > 30% dismisses. Same focus trap as Modal. Ships, NOT QA-targeted (per `frontend-architecture.md` §21). Implement enough that it renders functionally on mobile viewport; full polish is v1.1.
7. **Snackbar** (`components/snackbar/`) — per §16. Bottom-anchored, 16px from bottom edge desktop (above bottom nav on mobile — `bottom: calc(56px + 8px)` on mobile). `surface-elevated` bg, `elevation-3`, `radius-md`. Optional leading icon (variant-specific Lucide), text (`text-body`), trailing action button (Ghost variant — `text-only`, accent color).
   - Variants: `success` (CheckCircle2, success color), `info` (Info), `restored` (ArrowDownLeftFromSquare), `error` (AlertCircle, overdue color), `depth-cap` (AlertCircle, overdue color). Each variant maps to a leading icon + ARIA role/aria-live.
   - ARIA: `role="status"` + `aria-live="polite"` + `aria-atomic="true"` for success/info/restored. `role="alert"` + `aria-live="assertive"` for error/depth-cap.
   - Auto-dismiss timer. Hovered → pause auto-dismiss. Action button click → dismiss + fire callback.
   - Stacking: queue depth 2 (older dropped per UX §16.5). Done via the store.
   - The `<SnackbarHost />` in task-04 imports this component. Replace the placeholder.
   - **On mount: do NOT steal focus.** User can `⌘⇧Z` (task-18) to focus the action button, OR navigate via screen reader.
8. **Tooltip** (`components/tooltip/`) — per §17. Appears after 500ms hover (or instantly on keyboard focus). Dismisses on hover-out or focus-out with 100ms grace. Positions: prefers below, flips above when no room. Uses `@floating-ui/react`. `surface-elevated` bg + 1px `border`, `radius-sm`, `space-2` padding, `text-caption`, `elevation-1`. Renders as `aria-describedby` for the anchor. The anchor must still have its own `aria-label` — tooltip is never the only accessible name.
9. **EmptyState** (`components/empty-state/`) — per §35. Props: `icon: LucideIcon`, `headline: string`, `subline: string`, `action?: { label: string; onClick: () => void }`. Centered vertically + horizontally. Variants for the warm-flourish first-run via a `tone: 'neutral' | 'flourish'` prop (default 'neutral') — flourish variant uses the same component shape but may emphasize the subline (still tokens, no extra styling).
10. **Skeleton** (`components/skeleton/`) — per §36. Renders rounded rectangles in `border-subtle` color with an animated shimmer (a CSS gradient sweep on `motion-slow` cycle). Reduced motion disables shimmer. Variants: `'list'` (rendering 10 task-row-shaped bars), `'sidebar'` (rendering ~10 row-shaped bars), `'kanban'` (3 column-shaped + 3 cards each), `'calendar'` (a 6×7 grid). Container has `aria-busy="true"` + `aria-live="polite"`.
11. **ConfirmationPrompt** (`components/confirmation-prompt/`) — per §37 + microcopy §6. Renders as a Modal (`role="alertdialog"` for destructive variants). Smaller max-width (400px). Props:
    ```tsx
    export interface ConfirmationPromptProps {
      open: boolean;
      onCancel: () => void;
      onConfirm: () => void | Promise<void>;
      title: string;
      body: string;
      cancelLabel?: string;        // default "Cancel"
      confirmLabel: string;        // e.g., "Move to Trash", "Delete forever", "Complete all"
      destructive?: boolean;       // default false; if true → confirm button uses Destructive style + Cancel holds initial focus
    }
    ```
    Wired variants (built into the component's JSDoc + a `Variants.tsx` helper file):
    - Parent completion blocking — `title: "Complete all children and continue?"`, body interpolated with N count, confirm `"Complete all"`, not destructive (primary focused).
    - Soft-delete single — `title: "Move to Trash?"`, body `"\"<Title>\" will be moved to Trash. You can restore it later."`, confirm `"Move to Trash"`, **not destructive** (the soft-delete is reversible) — but Cancel still holds initial focus (defensive default; locked).
    - Soft-delete parent with children — body adds "and its N children". Same confirm.
    - Permanent delete — `title: "Permanently delete?"`, body `"This cannot be undone."`, confirm `"Delete forever"`, destructive (Cancel focused).
    - Empty Trash — `title: "Empty Trash?"`, body with N count, confirm `"Empty Trash"`, destructive.
    - Move all overdue — `title: "Move <N> overdue items to today?"`, body `"Their due dates will be set to today."`, confirm `"Move all"`, not destructive.
    - Unsaved changes — `title: "Discard changes?"`, body `"You have unsaved edits."`, cancel `"Keep editing"`, confirm `"Discard"`, destructive.
    - Delete folder — `title: "Delete folder \"<name>\"?"`, body `"Projects inside will move to no folder."`, confirm `"Delete folder"`, destructive.
    - Delete project — `title: "Delete project \"<name>\"?"`, body `"<N> active items will be moved to Trash."`, confirm `"Delete project"`, destructive.
12. **Tests** — per component, in `__tests__/<Name>.test.tsx`:
    - Render default + each variant + each state (mock Hover via state prop where applicable).
    - **Keyboard**: Button — Space and Enter activate. Modal — Esc closes (and triggers unsaved-changes guard if `dirty`); Tab/Shift+Tab stay within the modal; on open, focus is on the configured target. Dropdown — Down opens, arrows navigate, Enter selects, Esc closes. Tooltip — focus shows it; blur hides.
    - **ARIA**: aria-required / aria-invalid / aria-describedby on TextInput in error; role/aria-modal on Modal; role + aria-live on Snackbar.
    - **Focus trap regression test** for Modal (Tab from last element returns to first).
    - **Unsaved-changes guard** test on Modal: render with `dirty: true`, press Esc, assert the inline prompt is rendered; pressing Cancel-or-Esc-on-prompt does NOT call `onClose`; pressing Discard does call `onClose`.
    - **Snackbar non-focus-stealing** test: mount with the host, assert `document.activeElement` is unchanged.
    - **Reduced motion** styling test: render the Modal with `prefers-reduced-motion: reduce` matchMedia mock; assert the inline-style transition duration is the reduced value (or the CSS does the right thing via `@media` block — we verify via inspecting the computed style if jsdom supports it; otherwise this test is a smoke test that confirms the component still renders correctly in that environment).
13. **Replace task-04 placeholders** — update `apps/web/src/components/snackbar/host.tsx` to use the new component. Ensure the New Project modal in task-04 now uses this Modal component (the inline placeholder is replaced).

## Acceptance criteria

- [ ] `pnpm --filter @tasko/web typecheck` reports 0 errors.
- [ ] `pnpm --filter @tasko/web test` — every component test passes.
- [ ] Each of the 11 component folders exists with `index.tsx`, `styles.module.css`, and `__tests__/<Name>.test.tsx`.
- [ ] **No literal colors / sizes / motion values** in any component CSS — every property uses `var(--…)`. (Verify by grepping for `#[0-9a-fA-F]{3,6}` and `[0-9]+px` outside of standard CSS that needs a literal like `0`; literals for keyframe percentages are OK.)
- [ ] Manual: opening the New Project modal (from task-04's sidebar `+ → New project`) now uses the real Modal component; tabbing cycles within; Esc closes; clicking backdrop closes; entering a name + clicking Create creates the project; success snackbar appears with `role="status"`.
- [ ] Manual: trigger an ApiError (e.g., POST with empty name) → error snackbar `role="alert"`, message "Add a project name." per microcopy §28.1. Focus does NOT move to the snackbar.
- [ ] Manual: with screen reader, open the New Project modal → SR announces "Add project, dialog". Tab → cycles through Name → Folder → Hierarchy toggle → Cancel → Create → wraps back to Name.
- [ ] `pnpm lint` is clean.

## Output files

- Created:
  - `apps/web/src/components/button/` — `index.tsx`, `styles.module.css`, `__tests__/Button.test.tsx`
  - `apps/web/src/components/icon-button/` — same pattern
  - `apps/web/src/components/text-input/` — same
  - `apps/web/src/components/dropdown/` — same
  - `apps/web/src/components/modal/` — same
  - `apps/web/src/components/sheet/` — same
  - `apps/web/src/components/snackbar/` — same (the host.tsx file from task-04 is updated; the Snackbar component itself is new)
  - `apps/web/src/components/tooltip/` — same
  - `apps/web/src/components/empty-state/` — same
  - `apps/web/src/components/skeleton/` — same
  - `apps/web/src/components/confirmation-prompt/` — same + a `variants.ts` with the wired variant builders
- Modified:
  - `apps/web/src/components/snackbar/host.tsx` — use the new Snackbar component.
  - `apps/web/src/views/settings-view/index.tsx` — swap inline placeholders for real Button / TextInput.
  - The New Project modal in `apps/web/src/components/sidebar/` — swap inline placeholders for real Modal + TextInput + Dropdown + Button.
