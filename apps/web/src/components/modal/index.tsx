/**
 * Modal — Centered dialog.
 *
 * One-modal-at-a-time policy: this component does NOT enforce the policy itself.
 * Callers (view/task files) are responsible for not opening a second modal while
 * one is already open. The policy is: if the open modal is clean, close it silently
 * before opening the new one; if dirty, show the guard first.
 */
import { X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../button';
import styles from './styles.module.css';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: number;
  dirty?: boolean;
  initialFocus?: React.RefObject<HTMLElement | null>;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  footer?: React.ReactNode;
  children: React.ReactNode;
  role?: 'dialog' | 'alertdialog';
}

export function Modal({
  open,
  onClose,
  title,
  maxWidth = 560,
  dirty = false,
  initialFocus,
  returnFocusTo,
  footer,
  children,
  role: dialogRole = 'dialog',
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const [showDiscardGuard, setShowDiscardGuard] = useState(false);

  const attemptClose = useCallback(() => {
    if (dirty) {
      setShowDiscardGuard(true);
    } else {
      onClose();
    }
  }, [dirty, onClose]);

  const confirmDiscard = useCallback(() => {
    setShowDiscardGuard(false);
    onClose();
  }, [onClose]);

  const cancelDiscard = useCallback(() => {
    setShowDiscardGuard(false);
  }, []);

  // Save focus before modal opens, restore on close
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
    } else {
      setShowDiscardGuard(false);
      const returnTo = returnFocusTo?.current ?? previousFocusRef.current;
      if (returnTo && typeof (returnTo as HTMLElement).focus === 'function') {
        (returnTo as HTMLElement).focus();
      }
    }
  }, [open, returnFocusTo]);

  // Move focus to initial target or first interactive element
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (initialFocus?.current) {
        initialFocus.current.focus();
        return;
      }
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        focusable[0]?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, initialFocus]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (showDiscardGuard) {
          cancelDiscard();
        } else {
          attemptClose();
        }
        return;
      }

      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.closest('[aria-hidden="true"]'));

        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [attemptClose, cancelDiscard, showDiscardGuard],
  );

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      data-open=""
      onClick={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) attemptClose();
      }}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role={dialogRole}
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
        data-open=""
        style={{ maxWidth }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={attemptClose} aria-label="Close (Esc)">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>{children}</div>

        {/* Footer */}
        {footer && <div className={styles.footer}>{footer}</div>}

        {/* Unsaved-changes guard overlay */}
        {showDiscardGuard && (
          <div
            className={styles.discardGuard}
            role="alertdialog"
            aria-modal="false"
            aria-label="Discard changes?"
          >
            <p className={styles.discardText}>Discard changes?</p>
            <p className={styles.discardSubtext}>You have unsaved edits.</p>
            <div className={styles.discardActions}>
              <Button variant="ghost" size="sm" onClick={cancelDiscard} autoFocus>
                Keep editing
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDiscard}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
