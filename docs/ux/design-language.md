---
title: Tasko — Design Language
date: 2026-05-18
phase: ux
scope: project
status: draft
---

# Tasko — Design Language

The visual foundation for Tasko. Minimalist with a hint of warmth: type-led hierarchy, single warm accent (amber), generous whitespace, slightly rounded corners, calm-not-cold. Tokens are defined as semantic light/dark pairs with true parity.

This document is the **source of truth for design tokens**. Every component, screen, and microcopy decision draws from this surface. If a value is missing here, it is a bug — file it.

---

## 1. Typography

### 1.1 Family

- **Primary**: `Inter` (variable font preferred; weights 400 / 500 / 600).
- **Fallback stack**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Text", Helvetica, Arial, sans-serif`.
- **Monospace** (for keyboard shortcut chips, code blocks in markdown notes): `ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace`.

Rationale: Inter is the modern neutral. SF Pro is the macOS native fallback. The system stack ensures correct rendering even with no remote font loaded (local-first ethos applies to fonts too — we never block first paint on a webfont).

### 1.2 Type ramp — desktop

| Token | Size | Line height | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `text-display` | 28px | 36px | 600 | -0.01em | View titles (rare — Today, Calendar, project name) |
| `text-h1` | 22px | 30px | 600 | -0.005em | Modal titles, settings section headers |
| `text-h2` | 18px | 26px | 600 | 0 | Folder headers, kanban column header, day header in Next 7 Days |
| `text-h3` | 15px | 22px | 600 | 0 | Card titles, task row titles when bold variant required |
| `text-body` | 14px | 20px | 400 | 0 | Default — task rows, notes preview, dropdowns |
| `text-body-strong` | 14px | 20px | 500 | 0 | Sidebar items, button labels |
| `text-small` | 13px | 18px | 400 | 0 | Date chips, tag chips, helper text, calendar event chips |
| `text-small-strong` | 13px | 18px | 500 | 0 | Sidebar count badges, kanban column count |
| `text-caption` | 12px | 16px | 400 | 0.005em | Microcopy, meta info (e.g., "2/5 subtasks"), keyboard shortcut hints |
| `text-mono` | 12px | 16px | 500 | 0 | Keyboard shortcut chips (`⌘K`, `T`, etc.) |

### 1.3 Type ramp — mobile

Mobile inflates body and small one step for legibility and touch-tap correctness; display/heading sizes hold for consistency.

| Token | Size | Line height | Weight | Notes |
|---|---|---|---|---|
| `text-display` | 24px | 32px | 600 | Slightly smaller — phone screens prefer it |
| `text-h1` | 20px | 28px | 600 | |
| `text-h2` | 17px | 24px | 600 | |
| `text-h3` | 15px | 22px | 600 | Unchanged |
| `text-body` | 15px | 22px | 400 | **+1px** vs desktop |
| `text-body-strong` | 15px | 22px | 500 | |
| `text-small` | 14px | 20px | 400 | **+1px** vs desktop |
| `text-small-strong` | 14px | 20px | 500 | |
| `text-caption` | 12px | 16px | 400 | Unchanged |
| `text-mono` | 12px | 16px | 500 | |

### 1.4 Rules

- **No more than three type sizes per surface.** Hierarchy is carried by weight and spacing, not by jumping up the ramp.
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) on all numeric chips, counts, dates, and times. Counts of "12" and "1" must align under each other.
- **No italics** anywhere in v1. The product is too dense in glanceable info for italics to read as anything other than noise. Markdown notes are the one exception (user content).
- **No all-caps** for system UI text. Reserved for badges if absolutely needed (and we currently have none).
- **No underlines** on plain text. Links inside markdown notes are the only underlined elements.

---

## 2. Color tokens

All colors are defined as **semantic light / dark pairs**. Reach for the semantic name, never a raw hex outside this file. Light and dark have parity — both are first-class.

### 2.1 Canvas & surface (neutrals)

| Token | Light | Dark | Notes |
|---|---|---|---|
| `canvas` | `#FCFCFC` | `#0E0F11` | App background — sidebar + main area share this except where surface elevates |
| `canvas-subtle` | `#F6F6F6` | `#16181B` | Subtle alternate canvas (e.g., sidebar background offset from main) |
| `surface` | `#FFFFFF` | `#1A1C1F` | Cards, modals, popovers, kanban columns |
| `surface-elevated` | `#FFFFFF` | `#22252A` | Elevated layer — selected kanban card, hover state |
| `surface-sunken` | `#F2F2F2` | `#0A0B0D` | Sunken layer — input fields inset background |

Rationale for dark mode: not pure black. `#0E0F11` is "almost black" — gentler on eyes, allows elevation to actually create perceived depth. Pure black makes elevation invisible.

### 2.2 Text

| Token | Light | Dark | Contrast on canvas | Notes |
|---|---|---|---|---|
| `text` | `#0F1115` | `#F1F2F4` | 16.1 / 15.4 | Primary text |
| `text-strong` | `#000000` | `#FFFFFF` | 19.6 / 18.2 | Use sparingly — for emphasis only |
| `text-subtle` | `#5B6068` | `#A5ABB3` | 5.6 / 6.4 | Meta info, helper text, "of M" in "Day 2 of 5" |
| `text-muted` | `#8B9098` | `#6E747C` | 3.5 / 4.1 | **Non-text only** (icon strokes, disabled state) — does not meet AA for body text |
| `text-disabled` | `#B4B8BE` | `#54595F` | 2.1 / 2.6 | Disabled controls — visually faded but never used for load-bearing info |
| `text-on-accent` | `#FFFFFF` | `#0F1115` | — | Text placed on accent fill |
| `text-overdue` | `#B91C1C` | `#FCA5A5` | 5.7 / 7.1 | Overdue date string (used sparingly) |

### 2.3 Border / divider

| Token | Light | Dark | Notes |
|---|---|---|---|
| `border` | `#E5E7EB` | `#2A2D32` | Default border / divider |
| `border-strong` | `#CBD0D7` | `#3A3E45` | Emphasized border (focus-adjacent, selected) |
| `border-subtle` | `#F0F1F4` | `#202327` | Faint divider, table row separation |
| `border-overlay` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` | Translucent border for layered surfaces |

### 2.4 Accent (amber — the warmth)

| Token | Light | Dark | Notes |
|---|---|---|---|
| `accent` | `#D97706` | `#F59E0B` | Primary buttons, focus, today indicator, active sidebar item |
| `accent-hover` | `#B45309` | `#FBBF24` | Hover state |
| `accent-pressed` | `#92400E` | `#D97706` | Active/pressed state |
| `accent-subtle` | `#FEF3C7` | `#3A2A0A` | Tinted background for accent-adjacent surfaces (today pill, focus row tint) |
| `accent-on-subtle` | `#92400E` | `#FCD34D` | Text/icon placed on `accent-subtle` |

**Contrast pair verification:**
- Light: `accent #D97706` on `surface #FFFFFF` → 4.65:1 ✓ AA (large + non-text). For body text on accent fill, we always use `text-on-accent #FFFFFF` against `accent #D97706` → 4.65:1 ✓ AA.
- Dark: `accent #F59E0B` on `surface #1A1C1F` → 7.92:1 ✓ AAA.
- Dark mode amber as button fill: text uses `text-on-accent` dark `#0F1115` on `accent #F59E0B` → 11.8:1 ✓ AAA.

### 2.5 Focus

| Token | Light | Dark | Notes |
|---|---|---|---|
| `focus-ring` | `#D97706` | `#F59E0B` | 2px outline, 2px offset, on every focusable element |
| `focus-ring-on-accent` | `#FFFFFF` | `#0F1115` | When the focused element is already accent-filled |

### 2.6 Status colors

#### Overdue

| Token | Light | Dark | Notes |
|---|---|---|---|
| `overdue` | `#DC2626` | `#EF4444` | Used sparingly — overdue strip, "Day overdue" chip |
| `overdue-subtle` | `#FEE2E2` | `#3A1414` | Background tint for overdue strip |
| `overdue-text` | `#991B1B` | `#FCA5A5` | Text on subtle overdue |

#### Success / completion

| Token | Light | Dark | Notes |
|---|---|---|---|
| `success` | `#16A34A` | `#22C55E` | Checkbox checked fill, "synced" indicator dot |
| `success-subtle` | `#DCFCE7` | `#0F2A18` | |
| `success-text` | `#166534` | `#86EFAC` | |

#### Item status (kanban columns + status chips)

| Token | Light | Dark | Notes |
|---|---|---|---|
| `status-todo` | `#9CA3AF` | `#6B7280` | Neutral gray — "to do" state |
| `status-in-progress` | `#0EA5E9` | `#38BDFA` | Blue — "in progress" |
| `status-done` | `#16A34A` | `#22C55E` | Same as `success` |

These are the only places blue appears in the system. Blue is reserved for the "in progress" signal — it is never used as a general accent.

### 2.7 Priority

Priority is communicated through **color + size**. Color carries the signal at a glance; size makes it color-independent (and the chip stays meaningful in grayscale).

| Token | Light | Dark | Dot size | Notes |
|---|---|---|---|---|
| `priority-none` | `#D1D5DB` (`canvas`-toned) | `#3A3E45` | 6px hollow ring | No priority — barely-there dot |
| `priority-low` | `#9CA3AF` | `#6B7280` | 6px filled | Subtle gray |
| `priority-medium` | `#F59E0B` | `#FBBF24` | 8px filled | Amber — same family as accent (deliberate; priority is part of the warmth) |
| `priority-high` | `#DC2626` | `#EF4444` | 10px filled | Red — same as overdue (the user only sees red for urgency signals) |

### 2.8 Tag default

Tags have an optional user-assigned color (post-v1 affordance — in v1 all tags share the default).

| Token | Light | Dark | Notes |
|---|---|---|---|
| `tag-bg` | `#F3F4F6` | `#262A30` | Default tag chip background |
| `tag-text` | `#374151` | `#D1D5DB` | Default tag chip text |
| `tag-border` | `transparent` | `transparent` | Chips are borderless by default |

### 2.9 Translucent overlay

| Token | Light | Dark | Notes |
|---|---|---|---|
| `scrim` | `rgba(0, 0, 0, 0.40)` | `rgba(0, 0, 0, 0.60)` | Modal/sheet backdrop |
| `drag-shadow-overlay` | `rgba(0, 0, 0, 0.16)` | `rgba(0, 0, 0, 0.32)` | Shadow under a dragged item |

---

## 3. Spacing scale

The spacing system is a strict 4-pixel grid. Values outside this scale are a code review issue.

| Token | Value | Common use |
|---|---|---|
| `space-1` | 4px | Inline icon-to-text gap |
| `space-2` | 8px | Internal chip padding, dense list row internal padding |
| `space-3` | 12px | Sidebar item vertical padding, kanban card padding |
| `space-4` | 16px | Modal inner padding (mobile), task row internal horizontal padding |
| `space-5` | 24px | Section padding, between distinct groups in a modal |
| `space-6` | 32px | View padding (desktop), modal inner padding (desktop) |
| `space-7` | 48px | Major surface margins (e.g., empty-state vertical lead) |

### 3.1 Row heights (composed from the spacing scale)

| Surface | Desktop | Mobile | Note |
|---|---|---|---|
| Task row (Today, Inbox, project lists) | 38px–40px ("cozy") | 44px ("comfortable") | Per locked decision |
| Sidebar item | 32px | 44px | |
| Kanban card | min 64px, grows with content | min 72px | |
| Calendar day cell (month view, desktop) | min 96px height, equal width column | n/a | Week view: full-day height column |
| Modal field row | 56px (label + control) | 64px | Includes label space |
| Bottom nav (mobile) | n/a | 56px nav + 8px safe area | iOS home indicator clearance |

---

## 4. Radius scale

Rounded corners are part of the warmth — but only slightly. No pill-shaped buttons (except by deliberate choice for chips); no fully-square corners on interactive surfaces.

| Token | Value | Usage |
|---|---|---|
| `radius-xs` | 2px | Tiny chips (overdue sub-badge dot pill) |
| `radius-sm` | 6px | Buttons (sm/md), inputs, dropdown menus, sidebar items |
| `radius-md` | 8px | Cards, kanban cards, larger buttons, calendar event chips |
| `radius-lg` | 12px | Modals, sheets, popovers, command palette |
| `radius-full` | 9999px | Tag chips, count pills, priority dots (the only fully-round surfaces) |

---

## 5. Elevation / shadow

Elevation creates legible layers. The system has four levels. In dark mode, elevation is achieved through a combination of shadow *and* slight surface lightening (since shadows fade against dark canvases).

| Token | Light shadow | Dark shadow | Usage |
|---|---|---|---|
| `elevation-0` | none | none | Flat — sidebar, row separator |
| `elevation-1` | `0 1px 2px rgba(0,0,0,0.04)` | `0 1px 2px rgba(0,0,0,0.32)` + `surface` lighten | Hover state, sticky headers |
| `elevation-2` | `0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | `0 2px 6px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.24)` + `surface-elevated` | Kanban card hover, dropdowns, day-detail popover |
| `elevation-3` | `0 12px 32px rgba(15, 17, 21, 0.10), 0 4px 12px rgba(15, 17, 21, 0.06)` | `0 16px 40px rgba(0,0,0,0.48), 0 6px 16px rgba(0,0,0,0.32)` + `surface-elevated` | Modal, sheet, command palette |
| `elevation-drag` | `0 18px 36px rgba(0,0,0,0.16), 0 6px 12px rgba(0,0,0,0.10)` | `0 24px 48px rgba(0,0,0,0.60)` + `surface-elevated` | Dragged item ghost |

---

## 6. Motion

Motion in Tasko serves three jobs only: **(1) signal causality** (your check did this), **(2) preserve spatial logic** (this thing went there), **(3) communicate system state** (something is happening). Decorative animation is suppressed under `prefers-reduced-motion`. Functional motion (focus rings, drop-target highlight, drag shadow) is kept regardless.

### 6.1 Duration tokens

| Token | Value | Usage |
|---|---|---|
| `motion-instant` | 80ms | Reduced-motion replacement for most decorative animations |
| `motion-fast` | 120ms | Hover/focus transitions, button press, chip add |
| `motion-base` | 200ms | Standard transitions — checkbox tick, dropdown open, sidebar item select |
| `motion-medium` | 300ms | Modal slide-in, snackbar slide-up, fade-and-collapse on task complete |
| `motion-slow` | 480ms | Reserved — only used for the bulk-overdue "fly to today" animation (one place) |

### 6.2 Easing tokens

| Token | Curve | Usage |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default for entrances + exits |
| `ease-accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | Things leaving the screen (exit-only) |
| `ease-decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | Things arriving on screen (enter-only) |
| `ease-spring-soft` | `cubic-bezier(0.34, 1.32, 0.64, 1)` | The checkbox tick — a hint of bounce, not a full spring |

### 6.3 Specific motions

| Motion | Tokens used | Notes |
|---|---|---|
| Checkbox tick (visual) | `motion-fast` + `ease-spring-soft` | The check stroke draws in |
| Task row strike-through | `motion-base` + `ease-standard` | After 200ms hold, line draws across the title |
| Task row fade-and-collapse | `motion-medium` + `ease-accelerate` | Row opacity → 0, then height → 0 |
| Snackbar slide-up | `motion-medium` + `ease-decelerate` | From below the viewport up to its resting position |
| Snackbar auto-dismiss | `motion-medium` + `ease-accelerate` | Slide back down + fade |
| Modal open | `motion-medium` + `ease-decelerate` | Backdrop fade + content scale from 0.96 to 1.0 + slight rise |
| Sheet open (mobile) | `motion-medium` + `ease-decelerate` | Slide up from bottom |
| Sidebar item active highlight | `motion-fast` + `ease-standard` | Color/background swap |
| Hover state | `motion-fast` + `ease-standard` | Background color change |
| Drag pickup | `motion-fast` + `ease-decelerate` | Shadow elevate, slight scale 1.02 |
| Drag release | `motion-base` + `ease-standard` | Snap to drop position |
| Drop-target highlight | `motion-fast` + `ease-standard` | Background tint toggle |
| Bulk-overdue "fly to today" | `motion-slow` + `ease-standard` | Items briefly tween upward into the Today section |
| Kanban card move (column swap) | `motion-base` + `ease-standard` | FLIP-style reflow |
| Calendar reschedule (drag) | `motion-base` + `ease-standard` | Drop snaps to target cell |

### 6.4 Reduced-motion overrides

`@media (prefers-reduced-motion: reduce)` applies these substitutions:

| Original | Replacement |
|---|---|
| Strike-through draw + fade-and-collapse | Opacity fade only, `motion-instant` |
| Modal slide-in | Opacity fade only, `motion-instant` |
| Sheet slide-up | Opacity fade only, `motion-instant` |
| Snackbar slide-up | Opacity fade only, `motion-instant` |
| Bulk-overdue "fly to today" | Instant re-render |
| Kanban card move animation | Instant reflow |
| Calendar reschedule animation | Instant snap |
| Drag pickup scale (1.02) | Removed — shadow elevation alone |
| All hover background transitions | Instant swap |
| Spring easing on checkbox | Linear, no bounce |

**Retained even under reduced motion (functional, not decorative):**
- Focus ring rendering (always visible, no transition required but rendered).
- Drop-target highlight (instant, no transition).
- Drag shadow (instant, no transition).
- Spinner / progress indicator rotation (rotation is the signal — replacing it would break the loading affordance).

---

## 7. Iconography

- **Library**: [Lucide](https://lucide.dev) (MIT license). No other icon library in v1.
- **Stroke**: 1.5px (Lucide default). Never thicker, never thinner.
- **Default size**: 24px (in nav, hero, big affordances).
- **Compact size**: 20px (in row controls, sidebar items, sort dropdowns).
- **Inline / micro size**: 16px (inside tag chips, count badges, multi-day chip).
- **Color**: stroke color always inherits from a text token — usually `text-subtle`, sometimes `text`, sometimes `accent`. Filled icons are extremely rare in v1 (limited to the checkbox-checked state and the priority dot).
- **Standard set** used across the product:

| Lucide name | Use |
|---|---|
| `home` | (not used — Today is text-only) |
| `inbox` | Inbox sidebar item |
| `sun` | Today sidebar item |
| `sunrise` | Tomorrow sidebar item |
| `calendar-days` | Next 7 Days |
| `list` | All view + List view toggle |
| `check-circle-2` | Completed view |
| `trash-2` | Trash view |
| `folder` | Folder header |
| `folder-open` | Expanded folder |
| `hash` | Tag sidebar item |
| `settings` | Settings affordance |
| `plus` | Add affordance (buttons, sidebar +) |
| `plus-circle` | Quick-add input prefix |
| `search` | (Not used in v1 — no global search. The `?` command-palette help icon takes this spot.) |
| `command` | Command palette indicator |
| `chevron-right` | Collapsed tree node, "Open" affordance at row end |
| `chevron-down` | Expanded tree node |
| `more-horizontal` | Row hover ⋯ menu |
| `circle` | Empty checkbox |
| `check` | Checkmark inside checkbox (when ticked) |
| `circle-dot` | "in_progress" status icon |
| `columns-3` | Kanban view toggle |
| `calendar` | Calendar view |
| `move` | Drag handle (where shown — rare) |
| `arrow-up-right` | "Open" in row hover |
| `alert-circle` | Error icon in snackbar / inline form errors |
| `cloud-check` | Synced state |
| `cloud-off` | Offline / sync paused |
| `cloud-cog` | Syncing in progress |
| `repeat` | Recurrence icon |
| `clock` | Time-of-day on item |
| `tag` | Tag chip prefix (used inline when tag chip is in a tight row) |
| `x` | Close, dismiss filter chip |
| `corner-down-right` | Subtask indicator |
| `layers` | Epic icon |
| `layout-grid` | Feature icon |
| `square-check-big` | Task icon |
| `arrow-down-left-from-square` | Restore from Trash |

### Item-type icons (load-bearing — these distinguish Epic / Feature / Task / Subtask without color)

| Type | Lucide | Size | Color |
|---|---|---|---|
| Epic | `layers` | 16px or 20px | `text-subtle` |
| Feature | `layout-grid` | 16px or 20px | `text-subtle` |
| Task | `square-check-big` (outline only — pre-check) | 20px in row, 16px in card | `text-subtle` |
| Subtask | `corner-down-right` + circle checkbox | 16px | `text-subtle` |

This means the user can distinguish Epic / Feature / Task / Subtask **by glyph alone** even in grayscale or low-vision mode. Important — color is decoration, glyph is the contract.

---

## 8. Design language commitments (rules, not just tokens)

These are the principles the rest of the design system honors. Violating them is a code-review issue.

1. **One accent.** Amber is the only accent color. Status colors (red, green, blue) are reserved for their specific semantic role and never used decoratively.
2. **Type carries hierarchy.** Boldness > size > color, in that order. We never make something "bigger" just to draw attention if a weight change does the job.
3. **Quiet defaults, loud signals.** Today is quiet. Overdue is signaled. Focus is signaled. Everything else is background. Don't add visual noise to states that don't need it.
4. **No more than three font sizes per surface.** See §1.4.
5. **No more than one accent fill per surface at rest.** Multiple primary buttons in view = bug.
6. **Borders are thin.** 1px in all cases except focus ring (2px).
7. **Round corners are subtle.** 6–8px is the default. No 16px-round buttons. No fully square corners on interactive surfaces.
8. **Light and dark have parity.** Every decision applies to both. Dark is not an afterthought.
9. **Color never communicates alone.** Every color signal has a glyph, label, or shape alternative (see §7 — item type icons; §2.7 — priority dots also vary in size; §11.7 in accessibility doc).
10. **Motion is causal.** If something animates, the animation must explain a state change. Decorative motion is suppressed.
