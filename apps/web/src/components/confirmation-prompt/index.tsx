import { useEffect, useRef } from 'react';
import { Button } from '../button';
import { Modal } from '../modal';
import styles from './styles.module.css';

export interface ConfirmationPromptProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  body: string;
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  isPending?: boolean;
}

export function ConfirmationPrompt({
  open,
  onCancel,
  onConfirm,
  title,
  body,
  cancelLabel = 'Cancel',
  confirmLabel,
  destructive = false,
  isPending = false,
}: ConfirmationPromptProps) {
  // For destructive prompts, cancel button holds initial focus
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (destructive) {
        cancelRef.current?.focus();
      } else {
        confirmRef.current?.focus();
      }
    });
  }, [open, destructive]);

  const footer = (
    <div className={styles.footer}>
      <Button ref={cancelRef} variant="ghost" size="md" onClick={onCancel} disabled={isPending}>
        {cancelLabel}
      </Button>
      <Button
        ref={confirmRef}
        variant={destructive ? 'destructive' : 'primary'}
        size="md"
        onClick={async () => {
          await onConfirm();
        }}
        isLoading={isPending}
      >
        {confirmLabel}
      </Button>
    </div>
  );

  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth={400} role="alertdialog" footer={footer}>
      <p className={styles.body}>{body}</p>
    </Modal>
  );
}

export default ConfirmationPrompt;
