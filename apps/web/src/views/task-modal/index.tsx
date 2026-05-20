import type {
  Item,
  ItemCreate,
  ItemId,
  ItemPatch,
  LocalDate,
  ProjectId,
  Subtask,
  SubtaskCreate,
  SubtaskId,
  Tag,
  TagId,
} from '@tasko/types';
import { Trash2 } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfig } from '../../api/config';
import {
  useCreateItem,
  useCreateSubtask,
  useDeleteSubtask,
  useItem,
  usePatchItem,
  usePatchSubtask,
} from '../../api/items';
import { useCreateTag, useTags } from '../../api/tags';
import { Button } from '../../components/button';
import { DatePicker } from '../../components/date-picker';
import { formatLocalDate } from '../../components/date-picker/utils';
import { DateTimeCombined } from '../../components/date-time-combined';
import { Modal } from '../../components/modal';
import { PriorityMenu } from '../../components/priority-menu';
import { ProjectPicker } from '../../components/project-picker';
import { RecurrencePicker } from '../../components/recurrence-picker';
import { Sheet } from '../../components/sheet';
import { SubtaskList } from '../../components/subtask-row';
import { TagInput } from '../../components/tag-input';
import { TextareaMarkdown } from '../../components/textarea-markdown';
import { useIsMobile } from '../../lib/use-is-mobile';
import { useSnackbarStore } from '../../store/snackbar';
import { useTaskModalStore } from '../../store/task-modal';
import { useTaskModalForm } from './form-state';
import styles from './styles.module.css';

function TaskModalContent() {
  const {
    mode,
    initialTitle,
    initialProjectId,
    initialParentId,
    initialDueDate,
    initialStatus,
    editingItemId,
    close,
  } = useTaskModalStore();
  const { values, errors, dirty, setField, validate, resetTo } = useTaskModalForm();
  const isMobile = useIsMobile();
  const snackbar = useSnackbarStore();

  const { data: configData } = useConfig();
  const weekStart: 'sun' | 'mon' = configData?.week_start === 'sun' ? 'sun' : 'mon';

  // API hooks
  const createItem = useCreateItem();
  const patchItem = usePatchItem();
  const createSubtask = useCreateSubtask();
  const patchSubtask = usePatchSubtask();
  const deleteSubtask = useDeleteSubtask();
  const createTag = useCreateTag();
  const { data: tagsData } = useTags(true);

  // Edit mode: load the existing item
  const { data: existingItem } = useItem(mode === 'edit' ? (editingItemId as ItemId) : undefined);

  // Refs for focus management
  const titleRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLButtonElement>(null);
  const startDateRef = useRef<HTMLButtonElement>(null);

  // "More" disclosure state
  const [moreOpen, setMoreOpen] = useState(false);

  // Confirmation for delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Start date picker open state
  const [startDateOpen, setStartDateOpen] = useState(false);

  // Tags map - cast through Tag[] since apiCall+Zod parse returns branded types
  const allTags = (tagsData?.tags ?? []) as Tag[];
  const tagsById = new Map<TagId, Tag>(allTags.map((t) => [t.id, t]));

  // Initialize form when modal opens or when existing item loads
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset only when mode or item id changes
  useEffect(() => {
    if (mode === 'new') {
      resetTo({
        title: initialTitle ?? '',
        project_id: (initialProjectId ?? null) as ProjectId | null,
        parent_id: (initialParentId ?? null) as ItemId | null,
        due_date: (initialDueDate ?? null) as LocalDate | null,
        status: initialStatus ?? 'todo',
      });
    } else if (mode === 'edit' && existingItem) {
      const item = existingItem as Item;
      resetTo({
        title: item.title,
        due_date: item.due_date,
        due_time: item.due_time,
        start_date: item.start_date,
        project_id: item.project_id,
        tags: item.tags as TagId[],
        priority: item.priority,
        status: item.status,
        notes: item.notes,
        recurrence: item.recurrence,
        subtasks: item.subtasks as Subtask[],
        parent_id: item.parent_id as ItemId | null,
      });
      // Expand "More" if notes or recurrence are set
      if (item.notes || item.recurrence) {
        setMoreOpen(true);
      }
    }
  }, [
    mode,
    existingItem?.id,
    initialTitle,
    initialProjectId,
    initialParentId,
    initialDueDate,
    initialStatus,
    resetTo,
  ]);

  // Focus management on open: per spec §6.1
  useEffect(() => {
    if (mode === 'closed') return;

    const frame = requestAnimationFrame(() => {
      if (mode === 'new' && initialTitle) {
        // Title is pre-filled → focus Due date
        dueDateRef.current?.focus();
      } else if (mode === 'new') {
        // No initial title → focus Title
        titleRef.current?.focus();
      }
      // Edit mode: first focusable (title) handled by Modal's initialFocus
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, initialTitle]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      // Focus first errored field
      if (errors.title) {
        titleRef.current?.focus();
      } else if (errors.due_date) {
        dueDateRef.current?.focus();
      }
      return;
    }

    if (!values.due_date || !values.project_id) return;

    try {
      if (mode === 'new') {
        const body: ItemCreate = {
          type: 'task',
          project_id: values.project_id as ProjectId,
          parent_id: values.parent_id as ItemId | null,
          title: values.title.trim(),
          notes: values.notes,
          due_date: values.due_date,
          start_date: values.start_date,
          due_time: values.due_time,
          priority: values.priority,
          status: values.status,
          tags: values.tags as TagId[],
          recurrence: values.recurrence,
          subtasks: (values.subtasks as SubtaskCreate[]).map((s) => ({
            title: s.title,
            status: s.status,
            sort_order: s.sort_order,
          })),
        };
        await createItem.mutateAsync(body);
        close();
      } else if (mode === 'edit' && editingItemId) {
        // Subtasks are persisted eagerly via the dedicated endpoints
        // (useCreateSubtask / usePatchSubtask / useDeleteSubtask) — don't
        // include them in the parent PATCH body.
        const patch: ItemPatch = {
          title: values.title.trim(),
          notes: values.notes,
          due_date: values.due_date,
          start_date: values.start_date,
          due_time: values.due_time,
          priority: values.priority,
          status: values.status,
          tags: values.tags as TagId[],
          recurrence: values.recurrence,
          project_id: values.project_id as ProjectId,
          parent_id: values.parent_id as ItemId | null,
        };
        await patchItem.mutateAsync({ id: editingItemId, patch });
        close();
      }
    } catch {
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again.", durationMs: 5000 });
    }
  }, [validate, values, mode, editingItemId, createItem, patchItem, close, snackbar, errors]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key === 's')) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleCreateTag = async (name: string): Promise<Tag> => {
    const cleaned = name.replace(/^#/, '');
    const result = await createTag.mutateAsync({ name: cleaned });
    return result as Tag;
  };

  // In new mode subtasks live in form state and ship via the parent POST body.
  // In edit mode each interaction calls its dedicated endpoint so the server
  // mints ULIDs, stamps completed_at, and keeps the array authoritative.
  const handleSubtaskToggle = (id: string, done: boolean) => {
    if (mode === 'edit' && editingItemId) {
      void patchSubtask.mutateAsync({
        itemId: editingItemId,
        subtaskId: id as SubtaskId,
        patch: { status: done ? 'done' : 'todo' },
      });
      return;
    }
    setField(
      'subtasks',
      (values.subtasks as Subtask[]).map((s) =>
        s.id === id ? { ...s, status: done ? ('done' as const) : ('todo' as const) } : s,
      ) as Subtask[],
    );
  };

  const handleSubtaskRename = (id: string, title: string) => {
    if (mode === 'edit' && editingItemId) {
      void patchSubtask.mutateAsync({
        itemId: editingItemId,
        subtaskId: id as SubtaskId,
        patch: { title },
      });
      return;
    }
    setField(
      'subtasks',
      (values.subtasks as Subtask[]).map((s) => (s.id === id ? { ...s, title } : s)) as Subtask[],
    );
  };

  const handleSubtaskDelete = (id: string) => {
    if (mode === 'edit' && editingItemId) {
      void deleteSubtask.mutateAsync({
        itemId: editingItemId,
        subtaskId: id as SubtaskId,
      });
      return;
    }
    setField('subtasks', (values.subtasks as Subtask[]).filter((s) => s.id !== id) as Subtask[]);
  };

  const handleSubtaskReorder = (reordered: Subtask[]) => {
    if (mode === 'edit' && editingItemId) {
      // Send one PATCH per subtask whose sort_order changed. Server's
      // withWriteLock serializes them; cache converges on the last response.
      const current = (existingItem?.subtasks ?? []) as Subtask[];
      const byId = new Map(current.map((s) => [s.id, s.sort_order]));
      for (const s of reordered) {
        if (byId.get(s.id) !== s.sort_order) {
          void patchSubtask.mutateAsync({
            itemId: editingItemId,
            subtaskId: s.id as SubtaskId,
            patch: { sort_order: s.sort_order },
          });
        }
      }
      return;
    }
    setField('subtasks', reordered as Subtask[]);
  };

  const handleSubtaskAdd = (subtask: SubtaskCreate) => {
    if (mode === 'edit' && editingItemId) {
      // Strip the client-computed sort_order so the server picks max+1024;
      // this avoids stale/colliding values on rapid adds or after reorders.
      const { sort_order: _drop, ...body } = subtask;
      void createSubtask.mutateAsync({ itemId: editingItemId, body });
      return;
    }
    const tempId = crypto.randomUUID() as unknown as SubtaskId; // brand cast — temp id only, dropped in POST body strip
    setField('subtasks', [...(values.subtasks as Subtask[]), { ...subtask, id: tempId } as Subtask]);
  };

  const isSubmitting = createItem.isPending || patchItem.isPending;

  const title = mode === 'new' ? 'Add task' : 'Edit task';

  const footer = (
    <div className={styles.footer}>
      {mode === 'edit' && (
        <Button
          variant="ghost"
          size="md"
          onClick={() => setShowDeleteConfirm(true)}
          className={styles.deleteBtn}
          aria-label="Delete task"
        >
          <Trash2 size={16} aria-hidden="true" />
          Delete
        </Button>
      )}
      <div className={styles.footerRight}>
        <Button variant="ghost" size="md" onClick={() => close()}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => void handleSubmit()}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {mode === 'edit' ? 'Save changes' : 'Save'}
        </Button>
      </div>
    </div>
  );

  const body = (
    <div className={styles.body} onKeyDown={handleKeyDown}>
      {/* Title */}
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="task-title">
          Title
        </label>
        <input
          ref={titleRef}
          id="task-title"
          type="text"
          className={styles.titleInput}
          data-error={errors.title ? '' : undefined}
          placeholder="Task title"
          value={values.title}
          onChange={(e) => setField('title', e.target.value)}
          aria-required="true"
          aria-invalid={errors.title ? 'true' : undefined}
          aria-describedby={errors.title ? 'task-title-error' : undefined}
          maxLength={500}
        />
        {errors.title && (
          <p id="task-title-error" className={styles.fieldError} role="alert">
            {errors.title}
          </p>
        )}
      </div>

      {/* Due date */}
      <div className={styles.field}>
        <p className={styles.requiredHint}>· Required ·</p>
        <p className={styles.fieldLabel}>Due date</p>
        <DateTimeCombined
          date={values.due_date}
          time={values.due_time}
          onDateChange={(v) => setField('due_date', v)}
          onTimeChange={(v) => setField('due_time', v)}
          optional={false}
          weekStart={weekStart}
          {...(errors.due_date && { dateError: errors.due_date })}
          isMobile={isMobile}
          dateRef={dueDateRef}
          data-testid="due-date-field"
        />
      </div>

      {/* Start date */}
      <div className={styles.field}>
        <p className={styles.fieldLabel}>Start date (optional)</p>
        <div className={styles.startDateWrapper}>
          <button
            ref={startDateRef}
            type="button"
            className={styles.dateBtn}
            data-error={errors.start_date ? '' : undefined}
            onClick={() => setStartDateOpen((o) => !o)}
            aria-label={
              values.start_date
                ? `Start date: ${formatLocalDate(values.start_date)}`
                : 'Pick a start date (optional)'
            }
            aria-expanded={startDateOpen}
            aria-invalid={errors.start_date ? 'true' : undefined}
          >
            {values.start_date ? formatLocalDate(values.start_date) : '— none'}
          </button>
          <DatePicker
            value={values.start_date}
            onChange={(v) => {
              setField('start_date', v);
              setStartDateOpen(false);
            }}
            optional={true}
            weekStart={weekStart}
            open={startDateOpen}
            onClose={() => setStartDateOpen(false)}
            anchorEl={startDateRef.current}
            isMobile={isMobile}
          />
        </div>
        {errors.start_date && (
          <p className={styles.fieldError} role="alert">
            {errors.start_date}
          </p>
        )}
      </div>

      {/* Project */}
      <div className={styles.field}>
        <p className={styles.requiredHint}>· Required ·</p>
        <p className={styles.fieldLabel}>Project</p>
        <ProjectPicker
          value={values.project_id}
          onChange={(id) => setField('project_id', id)}
          required
          {...(errors.project_id && { error: errors.project_id })}
          data-testid="project-picker"
        />
      </div>

      {/* Tags */}
      <div className={styles.field}>
        <p className={styles.fieldLabel}>Tags</p>
        <TagInput
          value={values.tags as TagId[]}
          tagsById={tagsById}
          onChange={(ids) => setField('tags', ids)}
          onCreateTag={handleCreateTag}
          allTags={allTags}
        />
      </div>

      {/* Priority */}
      <div className={styles.field}>
        <p className={styles.fieldLabel}>Priority</p>
        <PriorityMenu value={values.priority} onChange={(v) => setField('priority', v)} />
      </div>

      {/* More disclosure */}
      <div className={styles.disclosure}>
        <button
          type="button"
          className={styles.disclosureToggle}
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
        >
          <span>{moreOpen ? 'Less' : 'More'}</span>
          <span className={styles.disclosureChevron} data-open={moreOpen ? '' : undefined}>
            ▾
          </span>
        </button>

        {moreOpen && (
          <div className={styles.moreContent}>
            {/* Notes */}
            <div className={styles.field}>
              <p className={styles.fieldLabel}>Notes</p>
              <TextareaMarkdown
                value={values.notes}
                onChange={(v) => setField('notes', v)}
                aria-label="Notes"
              />
            </div>

            {/* Subtasks */}
            <div className={styles.field}>
              <p className={styles.fieldLabel}>Subtasks</p>
              <SubtaskList
                subtasks={
                  mode === 'edit'
                    ? ((existingItem?.subtasks ?? []) as Subtask[])
                    : (values.subtasks as Subtask[])
                }
                onToggle={handleSubtaskToggle}
                onRename={handleSubtaskRename}
                onDelete={handleSubtaskDelete}
                onAdd={handleSubtaskAdd}
                onReorder={handleSubtaskReorder}
              />
            </div>

            {/* Recurrence */}
            <div className={styles.field}>
              <p className={styles.fieldLabel}>Recurrence</p>
              <RecurrencePicker value={values.recurrence} onChange={(v) => setField('recurrence', v)} />
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className={styles.deleteConfirm}
          role="alertdialog"
          aria-modal="false"
          aria-label="Move to Trash?"
        >
          <p className={styles.deleteConfirmTitle}>Move to Trash?</p>
          <p className={styles.deleteConfirmBody}>
            &ldquo;{values.title}&rdquo; will be moved to Trash. You can restore it later.
          </p>
          <div className={styles.deleteConfirmActions}>
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                // Task-12 wires the actual trash call.
                snackbar.show({
                  variant: 'info',
                  text: 'Coming soon',
                  durationMs: 5000,
                });
                setShowDeleteConfirm(false);
              }}
            >
              Move to Trash
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={mode !== 'closed'} onClose={close} title={title} footer={footer}>
        {body}
      </Sheet>
    );
  }

  return (
    <Modal
      open={mode !== 'closed'}
      onClose={close}
      title={title}
      maxWidth={600}
      dirty={dirty}
      footer={footer}
    >
      {body}
    </Modal>
  );
}

export function TaskModal() {
  const { mode } = useTaskModalStore();
  if (mode === 'closed') return null;
  return <TaskModalContent />;
}

export default TaskModal;
