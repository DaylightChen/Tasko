import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Subtask, SubtaskCreate } from '@tasko/types';
import { GripVertical, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { announce } from '../../lib/a11y';
import { useDndSensors } from '../../lib/dnd-sensors';
import { DragOverlayContent } from '../drag-visuals';
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

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
    data: { type: 'subtask', subtaskId: subtask.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform) ?? undefined,
    transition: transition ?? undefined,
  };

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
    <div
      ref={setNodeRef}
      className={styles.row}
      style={style}
      data-state={isDragging ? 'drag-source-placeholder' : undefined}
    >
      <span
        className={styles.dragHandle}
        aria-hidden="true"
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', touchAction: 'none' }}
      >
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
  onReorder?: (reorderedSubtasks: Subtask[]) => void;
}

export function SubtaskList({ subtasks, onToggle, onRename, onDelete, onAdd, onReorder }: SubtaskListProps) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [titleError, setTitleError] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const lastAnnouncedTargetRef = useRef<string | null>(null);
  const sensors = useDndSensors();

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveDragId(id);
    lastAnnouncedTargetRef.current = null;
    const subtask = subtasks.find((s) => s.id === id);
    announce(`Dragging "${subtask?.title ?? id}". Drop on a project, folder, or feature.`);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) return;
    const overId = event.over.id as string;
    if (lastAnnouncedTargetRef.current === overId) return;
    lastAnnouncedTargetRef.current = overId;
    const overSubtask = subtasks.find((s) => s.id === overId);
    if (overSubtask) {
      announce(`Drop on ${overSubtask.title}.`);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    lastAnnouncedTargetRef.current = null;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const oldIndex = subtasks.findIndex((s) => s.id === activeId);
    const newIndex = subtasks.findIndex((s) => s.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...subtasks];
    const [moved] = reordered.splice(oldIndex, 1);
    if (moved) {
      reordered.splice(newIndex, 0, moved);
    }

    // Assign new sort_orders
    const withNewOrders = reordered.map((s, i) => ({ ...s, sort_order: (i + 1) * 1024 }));
    onReorder?.(withNewOrders);

    announce(`Dropped onto ${subtasks[newIndex]?.title ?? overId}.`);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    lastAnnouncedTargetRef.current = null;
    announce('Drag cancelled.');
  };

  const activeSubtask = activeDragId ? subtasks.find((s) => s.id === activeDragId) : null;

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
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
      </SortableContext>

      <DragOverlay>
        {activeSubtask ? (
          <DragOverlayContent>
            <div className={styles.row} style={{ pointerEvents: 'none' }}>
              <span className={styles.dragHandle} aria-hidden="true">
                <GripVertical size={14} />
              </span>
              <span className={styles.title}>{activeSubtask.title}</span>
            </div>
          </DragOverlayContent>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default SubtaskRow;
