import { Loader2 } from 'lucide-react';
import type React from 'react';
import { forwardRef } from 'react';
import styles from './styles.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    isLoading = false,
    disabled,
    type = 'button',
    children,
    className,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || isLoading;
  const loadingLabel = isLoading && typeof children === 'string' ? children : undefined;

  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      data-size={size}
      disabled={isDisabled}
      aria-busy={isLoading ? 'true' : undefined}
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-label={loadingLabel}
      className={[styles.root, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {isLoading ? <Loader2 className={styles.spinner} size={16} aria-hidden="true" /> : children}
    </button>
  );
});

export default Button;
