/**
 * Keyboard helpers shared by hotkey-provider, useHotkey, and HOTKEY_MAP.
 *
 * Spec format: 'Mod+k', 'Mod+Shift+z', '?', 'ArrowDown', 'Enter'
 *   - 'Mod' = Meta on Mac, Ctrl elsewhere
 *   - 'Shift' = e.shiftKey
 *   - 'Alt' = e.altKey
 *   - All other parts are matched case-insensitively against e.key
 */

export function isModKey(e: KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform.includes('Mac') || navigator.userAgent.includes('Mac');
}

/**
 * Returns true when the keyboard event matches the given hotkey spec.
 *
 * Spec examples:
 *   'Mod+k'         → Cmd/Ctrl + K
 *   'Mod+Shift+z'   → Cmd/Ctrl + Shift + Z
 *   'Mod+\\'        → Cmd/Ctrl + backslash
 *   '?'             → question mark (single key, no modifier)
 *   'ArrowDown'     → arrow key (no modifier required)
 *   'Space'         → space bar
 *   'Enter'         → enter key
 *   'Backspace'     → backspace
 */
export function matchHotkey(spec: string, e: KeyboardEvent): boolean {
  const parts = spec.split('+');
  let requireMod = false;
  let requireShift = false;
  let requireAlt = false;
  let keyPart = '';

  for (const part of parts) {
    if (part === 'Mod') {
      requireMod = true;
    } else if (part === 'Shift') {
      requireShift = true;
    } else if (part === 'Alt') {
      requireAlt = true;
    } else {
      keyPart = part;
    }
  }

  if (!keyPart) return false;

  // Check modifier requirements
  if (requireMod && !isModKey(e)) return false;
  if (!requireMod && isModKey(e)) return false;
  if (requireShift && !e.shiftKey) return false;
  // For non-alphanumeric single chars (e.g. '?', '/', ',') the shift state is
  // encoded by the key's identity itself — don't reject based on shiftKey alone.
  const shiftIsInKey = keyPart.length === 1 && !/[a-zA-Z0-9]/.test(keyPart);
  if (!requireShift && e.shiftKey && !shiftIsInKey) return false;
  if (requireAlt && !e.altKey) return false;
  if (!requireAlt && e.altKey) return false;

  // Match key (case-insensitive for single-char keys, exact for named keys)
  if (keyPart.length === 1) {
    return e.key.toLowerCase() === keyPart.toLowerCase();
  }
  // Named keys like 'ArrowDown', 'Enter', 'Space', 'Backspace', etc.
  if (keyPart === 'Space') return e.key === ' ';
  return e.key === keyPart;
}

/**
 * Returns true if a spec string is a modifier-combo (i.e., contains 'Mod', 'Ctrl', 'Meta', or 'Alt').
 * Used to decide whether to suppress in 'input' mode.
 */
export function isModifierCombo(spec: string): boolean {
  return spec.includes('Mod') || spec.includes('Ctrl') || spec.includes('Meta') || spec.includes('Alt');
}
