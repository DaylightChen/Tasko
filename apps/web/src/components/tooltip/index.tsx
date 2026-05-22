import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react';
import { useId, useRef, useState } from 'react';
import styles from './styles.module.css';

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: 'bottom' | 'top' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ content, children, placement = 'bottom', delay = 500 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  });

  const hover = useHover(context, { delay: { open: delay, close: 100 } });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  const child = children as React.ReactElement<Record<string, unknown>>;

  const originalOnFocus = child.props.onFocus as ((e: React.FocusEvent) => void) | undefined;
  const originalOnBlur = child.props.onBlur as ((e: React.FocusEvent) => void) | undefined;

  const trigger = {
    ...child,
    ref: refs.setReference,
    props: {
      ...child.props,
      'aria-describedby': open ? tooltipId : undefined,
      ...getReferenceProps({
        onFocus: (e: React.FocusEvent) => {
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }
          setOpen(true);
          originalOnFocus?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
          setOpen(false);
          originalOnBlur?.(e);
        },
      }),
    },
  } as React.ReactElement;

  return (
    <>
      {trigger}
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            id={tooltipId}
            role="tooltip"
            className={styles.tooltip}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

export default Tooltip;
