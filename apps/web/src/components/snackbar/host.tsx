import { useEffect } from 'react';
import { useSnackbarStore } from '../../store/snackbar';
import styles from './host.module.css';

export function SnackbarHost() {
  const { current, dismiss } = useSnackbarStore();

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => dismiss(), current.durationMs);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  if (!current) return null;

  const isError = current.variant === 'error' || current.variant === 'depth-cap';

  return (
    <div
      className={styles.snackbar}
      data-variant={current.variant}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className={styles.text}>{current.text}</span>
      {current.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            current.action?.onClick();
            dismiss();
          }}
        >
          {current.action.label}
        </button>
      )}
      <button type="button" className={styles.close} onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
