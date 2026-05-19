/**
 * Sheet — Mobile bottom-sheet equivalent of Modal.
 * Ships in v1 but is NOT a QA target per frontend-architecture.md §21.
 */
import { X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHotkeyStore } from '../../store/hotkey-registry';
import styles from './styles.module.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, title, footer, children }: SheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragDelta, setDragDelta] = useState(0);

  const DISMISS_THRESHOLD = 0.3;

  // task-18: hotkey mode — push 'sheet' on open, pop on close
  useEffect(() => {
    if (!open) return;
    useHotkeyStore.getState().push('sheet');
    return () => {
      useHotkeyStore.getState().pop();
    };
  }, [open]);

  // Save/restore focus
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      requestAnimationFrame(() => {
        if (sheetRef.current) {
          const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
          );
          focusable[0]?.focus();
        }
      });
    } else {
      const prev = previousFocusRef.current;
      if (prev && typeof (prev as HTMLElement).focus === 'function') {
        (prev as HTMLElement).focus();
      }
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        if (!sheetRef.current) return;
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  const handleDragStart = useCallback((e: React.TouchEvent | React.PointerEvent) => {
    const y = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : (e as React.PointerEvent).clientY;
    setDragStart(y);
    setDragDelta(0);
  }, []);

  const handleDragMove = useCallback(
    (e: React.TouchEvent | React.PointerEvent) => {
      if (dragStart === null) return;
      const y = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : (e as React.PointerEvent).clientY;
      const delta = y - dragStart;
      if (delta > 0) setDragDelta(delta);
    },
    [dragStart],
  );

  const handleDragEnd = useCallback(() => {
    if (sheetRef.current && dragDelta > 0) {
      const height = sheetRef.current.offsetHeight;
      if (dragDelta / height > DISMISS_THRESHOLD) {
        onClose();
      }
    }
    setDragStart(null);
    setDragDelta(0);
  }, [dragDelta, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.sheet}
        style={dragDelta > 0 ? { transform: `translateY(${dragDelta}px)` } : undefined}
        onKeyDown={handleKeyDown}
      >
        {/* Drag handle */}
        <div
          className={styles.handle}
          role="button"
          aria-label="Drag to dismiss"
          tabIndex={0}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClose();
          }}
        >
          <div className={styles.handleBar} />
        </div>

        {/* Header */}
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close (Esc)">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>{children}</div>

        {/* Footer */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Sheet;
