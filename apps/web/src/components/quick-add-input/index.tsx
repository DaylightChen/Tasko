import { PlusCircle } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { useTaskModalStore } from '../../store/task-modal';
import styles from './styles.module.css';

export interface QuickAddInputProps {
  placeholder: string;
  onCommit?: (title: string) => void;
  autoFocus?: boolean;
}

/**
 * QuickAddInput — a row at the top of every list view for adding tasks.
 * Pressing Enter opens the Task modal (taskModalStore.openNew) with the typed title.
 * Escape blurs.
 * The N keybinding (task-18) calls a useFocusRef to focus this input.
 */
export function QuickAddInput({ placeholder, onCommit, autoFocus = false }: QuickAddInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const taskModalStore = useTaskModalStore();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = value.trim();
      if (trimmed) {
        // Open the task modal with the typed title
        taskModalStore.openNew({ initialTitle: trimmed });
        setValue('');
        // Notify parent if needed (e.g., for tests)
        onCommit?.(trimmed);
      }
    } else if (e.key === 'Escape') {
      inputRef.current?.blur();
      setValue('');
    }
  };

  return (
    <div className={styles.wrapper}>
      <span className={styles.icon} aria-hidden="true">
        <PlusCircle size={20} />
      </span>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        // biome-ignore lint/a11y/noAutofocus: autoFocus is opt-in via prop
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
    </div>
  );
}

export default QuickAddInput;
