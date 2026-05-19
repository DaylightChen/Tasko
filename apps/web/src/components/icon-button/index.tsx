import type { LucideIcon } from 'lucide-react';
import type React from 'react';
import { Tooltip } from '../tooltip';
import styles from './styles.module.css';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  'aria-label': string;
  variant?: 'transparent' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
  selected?: boolean;
}

const ICON_SIZES: Record<NonNullable<IconButtonProps['size']>, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

export function IconButton({
  icon: Icon,
  'aria-label': ariaLabel,
  variant = 'transparent',
  size = 'md',
  tooltip,
  selected = false,
  disabled,
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  const iconSize = ICON_SIZES[size];

  const button = (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      data-selected={selected ? '' : undefined}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled ? 'true' : undefined}
      className={[styles.root, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon size={iconSize} aria-hidden="true" />
    </button>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{button}</Tooltip>;
  }

  return button;
}

export default IconButton;
