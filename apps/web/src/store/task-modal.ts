import type { ItemId, LocalDate, ProjectId, Status } from '@tasko/types';
import { create } from 'zustand';

export type TaskModalMode = 'new' | 'edit' | 'closed';

export interface TaskModalOpenNewArgs {
  initialTitle?: string;
  initialProjectId?: ProjectId;
  initialParentId?: ItemId;
  initialDueDate?: LocalDate;
  initialStatus?: Status;
}

interface TaskModalState {
  mode: TaskModalMode;
  initialTitle?: string;
  initialProjectId?: ProjectId;
  initialParentId?: ItemId;
  initialDueDate?: LocalDate;
  initialStatus?: Status;
  editingItemId?: ItemId;

  openNew: (args?: TaskModalOpenNewArgs) => void;
  openEdit: (id: ItemId) => void;
  close: () => void;
}

export const useTaskModalStore = create<TaskModalState>((set) => ({
  mode: 'closed',

  openNew: (args = {}) => {
    set((state) => {
      const next: TaskModalState = {
        ...state,
        mode: 'new',
      };
      // exactOptionalPropertyTypes requires delete to remove optional keys (not `= undefined`)
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      delete next.editingItemId;
      if (args.initialTitle !== undefined) next.initialTitle = args.initialTitle;
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      else delete next.initialTitle;
      if (args.initialProjectId !== undefined) next.initialProjectId = args.initialProjectId;
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      else delete next.initialProjectId;
      if (args.initialParentId !== undefined) next.initialParentId = args.initialParentId;
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      else delete next.initialParentId;
      if (args.initialDueDate !== undefined) next.initialDueDate = args.initialDueDate;
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      else delete next.initialDueDate;
      if (args.initialStatus !== undefined) next.initialStatus = args.initialStatus;
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      else delete next.initialStatus;
      return next;
    });
  },

  openEdit: (id: ItemId) => {
    set((state) => {
      const next: TaskModalState = {
        ...state,
        mode: 'edit',
        editingItemId: id,
      };
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      delete next.initialTitle;
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      delete next.initialProjectId;
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      delete next.initialParentId;
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      delete next.initialDueDate;
      // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes prevents assigning undefined to optional props
      delete next.initialStatus;
      return next;
    });
  },

  close: () => {
    set((state) => ({
      ...state,
      mode: 'closed',
    }));
  },
}));
