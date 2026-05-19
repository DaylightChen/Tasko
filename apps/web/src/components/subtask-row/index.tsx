import type { Subtask, SubtaskCreate } from '@tasko/types';
import { GripVertical, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { SubtaskCheckbox } from '../subtask-checkbox';
import styles from './styles.module.css';

export interface SubtaskRowProps {
  subtask: Subtask;
  onToggle: (id: string, done: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function SubtaskRow({ subtask, onToggle, onRename, onDelete }: SubtaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(subtask.title);
  const isDone = subtask.status === 'done';

  const commitEdit = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== subtask.title) {
      onRename(subtask.id, trimmed);
    } else if (!trimmed) {
      setTitle(subtask.title);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setTitle(subtask.title);
      setEditing(false);
    }
  };

  return (
    <div className={styles.row}>
      <span className={styles.dragHandle} aria-hidden="true">
        <GripVertical size={14} />
      </span>

      <SubtaskCheckbox
        checked={isDone}
        onChange={(checked) => onToggle(subtask.id, checked)}
        aria-label={`Mark subtask "${subtask.title}" complete`}
      />

      {editing ? (
        <input
          type="text"
          className={styles.editInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          // biome-ignore lint/a11y/noAutofocus: needs focus when entering edit mode
          autoFocus
          aria-label="Subtask title"
          maxLength={200}
        />
      ) : (
        <button
          type="button"
          className={styles.title}
          data-done={isDone ? '' : undefined}
          onClick={() => setEditing(true)}
          aria-label={`Edit subtask: ${subtask.title}`}
        >
          {subtask.title}
        </button>
      )}

      <button
        type="button"
        className={styles.deleteBtn}
        aria-label="Delete subtask"
        onClick={() => onDelete(subtask.id)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export interface SubtaskListProps {
  subtasks: Subtask[];
  onToggle: (id: string, done: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onAdd: (subtask: SubtaskCreate) => void;
}

export function SubtaskList({ subtasks, onToggle, onRename, onDelete, onAdd }: SubtaskListProps) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [titleError, setTitleError] = useState('');

  const commitAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setAdding(false);
      setNewTitle('');
      return;
    }
    if (trimmed.length > 200) {
      setTitleError('Subtask titles are limited to 200 characters.');
      return;
    }
    onAdd({ title: trimmed, status: 'todo', sort_order: subtasks.length * 1024 });
    setNewTitle('');
    setTitleError('');
    // Keep focus for quick add-another
    inputRef.current?.focus();
  };

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitAdd();
    } else if (e.key === 'Escape') {
      setAdding(false);
      setNewTitle('');
      setTitleError('');
    }
  };

  return (
    <div className={styles.list}>
      {subtasks.map((subtask) => (
        <SubtaskRow
          key={subtask.id}
          subtask={subtask}
          onToggle={onToggle}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}

      {adding ? (
        <div className={styles.addRow}>
          <span className={styles.addRowIcon}>
            <Plus size={14} aria-hidden="true" />
          </span>
          <input
            ref={inputRef}
            type="text"
            className={styles.editInput}
            placeholder="Add subtask…"
            value={newTitle}
            onChange={(e) => {
              setNewTitle(e.target.value);
              setTitleError('');
            }}
            onBlur={commitAdd}
            onKeyDown={handleAddKeyDown}
            aria-label="New subtask title"
            maxLength={200}
            // biome-ignore lint/a11y/noAutofocus: needs focus when add row appears
            autoFocus
          />
          {titleError && <p className={styles.addError}>{titleError}</p>}
        </div>
      ) : (
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setAdding(true)}
          aria-label="Add subtask"
        >
          <Plus size={14} aria-hidden="true" />
          Add subtask
        </button>
      )}
    </div>
  );
}

export default SubtaskRow;
