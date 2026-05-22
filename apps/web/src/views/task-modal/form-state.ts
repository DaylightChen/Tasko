import type {
  ItemId,
  LocalDate,
  LocalTime,
  Priority,
  ProjectId,
  RecurrenceRule,
  Status,
  Subtask,
  SubtaskCreate,
  TagId,
} from '@tasko/types';
import { useCallback, useRef, useState } from 'react';

export interface TaskFormValues {
  title: string;
  due_date: LocalDate | null;
  due_time: LocalTime | null;
  start_date: LocalDate | null;
  project_id: ProjectId | null;
  tags: TagId[];
  priority: Priority;
  status: Status;
  notes: string;
  recurrence: RecurrenceRule | null;
  subtasks: (Subtask | SubtaskCreate)[];
  parent_id: ItemId | null;
}

export interface TaskFormErrors {
  title?: string;
  due_date?: string;
  project_id?: string;
  start_date?: string;
}

export interface UseTaskModalFormReturn {
  values: TaskFormValues;
  errors: TaskFormErrors;
  dirty: boolean;
  setField: <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => void;
  validate: () => boolean;
  resetTo: (initial: Partial<TaskFormValues>) => void;
}

const DEFAULT_VALUES: TaskFormValues = {
  title: '',
  due_date: null,
  due_time: null,
  start_date: null,
  project_id: null,
  tags: [],
  priority: 'none',
  status: 'todo',
  notes: '',
  recurrence: null,
  subtasks: [],
  parent_id: null,
};

function isDirty(current: TaskFormValues, initial: TaskFormValues): boolean {
  return (
    current.title !== initial.title ||
    current.due_date !== initial.due_date ||
    current.due_time !== initial.due_time ||
    current.start_date !== initial.start_date ||
    current.project_id !== initial.project_id ||
    current.notes !== initial.notes ||
    current.priority !== initial.priority ||
    current.status !== initial.status ||
    current.recurrence !== initial.recurrence ||
    JSON.stringify(current.tags) !== JSON.stringify(initial.tags) ||
    JSON.stringify(current.subtasks) !== JSON.stringify(initial.subtasks)
  );
}

export function useTaskModalForm(): UseTaskModalFormReturn {
  const [values, setValues] = useState<TaskFormValues>(DEFAULT_VALUES);
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const initialRef = useRef<TaskFormValues>(DEFAULT_VALUES);

  const setField = useCallback(<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear field-level error on change
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: TaskFormErrors = {};

    if (!values.title.trim()) {
      newErrors.title = 'Add a title.';
    }
    if (!values.due_date) {
      newErrors.due_date = 'Pick a due date.';
    }
    if (!values.project_id) {
      newErrors.project_id = 'Pick a project.';
    }
    if (values.start_date && values.due_date && values.start_date > values.due_date) {
      newErrors.start_date = 'Start date must be before due date.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values]);

  const resetTo = useCallback((initial: Partial<TaskFormValues>) => {
    const next: TaskFormValues = { ...DEFAULT_VALUES, ...initial };
    initialRef.current = next;
    setValues(next);
    setErrors({});
  }, []);

  const dirty = isDirty(values, initialRef.current);

  return { values, errors, dirty, setField, validate, resetTo };
}
