import { AlertCircle, ArrowDownLeftFromSquare, CheckCircle2, Info, Trash2 } from 'lucide-react';
import type React from 'react';
import type { SnackbarVariant } from '../../store/snackbar';
import styles from './styles.module.css';

export interface SnackbarProps {
  variant: SnackbarVariant;
  text: string;
  action?: { label: string; onClick: () => void } | undefined;
  onDismiss: () => void;
  /** Mouse-enter pauses auto-dismiss */
  onMouseEnter?: React.MouseEventHandler | undefined;
  onMouseLeave?: React.MouseEventHandler | undefined;
}

const VARIANT_ICONS: Record<SnackbarVariant, React.ReactNode> = {
  success: <CheckCircle2 size={16} aria-hidden="true" className={styles.iconSuccess} />,
  info: <Info size={16} aria-hidden="true" className={styles.iconInfo} />,
  restored: <ArrowDownLeftFromSquare size={16} aria-hidden="true" className={styles.iconInfo} />,
  error: <AlertCircle size={16} aria-hidden="true" className={styles.iconError} />,
  'depth-cap': <AlertCircle size={16} aria-hidden="true" className={styles.iconError} />,
};

const ASSERTIVE_VARIANTS: ReadonlySet<SnackbarVariant> = new Set(['error', 'depth-cap'] as const);

export function Snackbar({ variant, text, action, onDismiss, onMouseEnter, onMouseLeave }: SnackbarProps) {
  const isAssertive = ASSERTIVE_VARIANTS.has(variant);
  const liveIcon = VARIANT_ICONS[variant];

  // Deleted variant maps to success/info for icon display; use trash icon only for info
  const icon =
    variant === ('deleted' as SnackbarVariant) ? (
      <Trash2 size={16} aria-hidden="true" className={styles.iconInfo} />
    ) : (
      liveIcon
    );

  return (
    <div
      className={styles.snackbar}
      data-variant={variant}
      role={isAssertive ? 'alert' : 'status'}
      aria-live={isAssertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.text}>{text}</span>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          tabIndex={0}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default Snackbar;
