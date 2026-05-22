import { useEffect, useRef } from 'react';
import { matchHotkey } from '../lib/keyboard';
import { type HotkeyMode, useHotkeyStore } from '../store/hotkey-registry';

/**
 * Register a hotkey that only fires when the current mode matches.
 *
 * @param mode  - The mode (or array of modes) in which this hotkey is active.
 * @param key   - Hotkey spec, e.g. 'Mod+k', 'ArrowDown', 't'.
 * @param handler - Called when the hotkey fires. Receives the original KeyboardEvent.
 * @param opts.allowModifiers - (unused; modifier matching is baked into spec). Kept for future extension.
 */
export function useHotkey(
  mode: HotkeyMode | HotkeyMode[],
  key: string,
  handler: (e: KeyboardEvent) => void,
  _opts?: { allowModifiers?: boolean },
): void {
  const modes = Array.isArray(mode) ? mode : [mode];
  // Stable ref for handler so effect only re-runs when mode/key changes.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // biome-ignore lint/correctness/useExhaustiveDependencies: modes array is spread into deps; handlerRef is stable
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const current = useHotkeyStore.getState().currentMode;
      if (!modes.includes(current)) return;
      if (matchHotkey(key, e)) {
        handlerRef.current(e);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [key, ...modes]);
}
