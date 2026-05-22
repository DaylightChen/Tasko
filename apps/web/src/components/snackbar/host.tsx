import { useCallback, useEffect, useRef, useState } from 'react';
import { useSnackbarStore } from '../../store/snackbar';
import styles from './host.module.css';
import { Snackbar } from './index';

export function SnackbarHost() {
  const { current, dismiss } = useSnackbarStore();
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (!current) return;
    clearTimer();
    timerRef.current = setTimeout(() => dismiss(), current.durationMs);
  }, [current, dismiss, clearTimer]);

  useEffect(() => {
    if (!current || paused) {
      clearTimer();
      return;
    }
    startTimer();
    return clearTimer;
  }, [current, paused, startTimer, clearTimer]);

  const handleMouseEnter = useCallback(() => {
    setPaused(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setPaused(false);
  }, []);

  if (!current) return null;

  return (
    <div className={styles.host} aria-live="off" aria-atomic="false">
      <Snackbar
        variant={current.variant}
        text={current.text}
        action={current.action}
        onDismiss={dismiss}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
