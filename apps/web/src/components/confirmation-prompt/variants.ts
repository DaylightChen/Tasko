import type { ConfirmationPromptProps } from './index';

type VariantProps = Omit<ConfirmationPromptProps, 'open' | 'onCancel' | 'onConfirm'>;

/**
 * Pre-built variant builders for ConfirmationPrompt.
 * Callers provide open, onCancel, onConfirm; the builder provides
 * title/body/labels/destructive per microcopy §6.
 */

/** §6.1 — Parent completion blocking (non-destructive; primary gets initial focus) */
export function parentCompletionVariant(incompleteCount: number): VariantProps {
  const noun = incompleteCount === 1 ? 'subtask' : 'children';
  return {
    title: 'Complete all children and continue?',
    body: `This task has ${incompleteCount} incomplete ${noun}. Completing it will mark them all done.`,
    confirmLabel: 'Complete all',
    cancelLabel: 'Cancel',
    destructive: false,
  };
}

/** §6.2 — Soft-delete single item (reversible; cancel holds initial focus by defensive default) */
export function softDeleteSingleVariant(itemTitle: string): VariantProps {
  return {
    title: 'Move to Trash?',
    body: `"${itemTitle}" will be moved to Trash. You can restore it later.`,
    confirmLabel: 'Move to Trash',
    cancelLabel: 'Cancel',
    destructive: false,
  };
}

/** §6.3 — Soft-delete parent with children */
export function softDeleteParentVariant(itemTitle: string, childCount: number): VariantProps {
  return {
    title: 'Move to Trash?',
    body: `"${itemTitle}" and its ${childCount} ${childCount === 1 ? 'child' : 'children'} will be moved to Trash. You can restore them later.`,
    confirmLabel: 'Move to Trash',
    cancelLabel: 'Cancel',
    destructive: false,
  };
}

/** §6.4 — Permanent delete */
export function permanentDeleteVariant(): VariantProps {
  return {
    title: 'Permanently delete?',
    body: 'This cannot be undone.',
    confirmLabel: 'Delete forever',
    cancelLabel: 'Cancel',
    destructive: true,
  };
}

/** §6.5 — Empty Trash */
export function emptyTrashVariant(itemCount: number): VariantProps {
  return {
    title: 'Empty Trash?',
    body: `All ${itemCount} ${itemCount === 1 ? 'item' : 'items'} in Trash will be permanently deleted. This cannot be undone.`,
    confirmLabel: 'Empty Trash',
    cancelLabel: 'Cancel',
    destructive: true,
  };
}

/** §6.6 — Move all overdue to today */
export function moveOverdueVariant(overdueCount: number): VariantProps {
  return {
    title: `Move ${overdueCount} overdue ${overdueCount === 1 ? 'item' : 'items'} to today?`,
    body: 'Their due dates will be set to today.',
    confirmLabel: 'Move all',
    cancelLabel: 'Cancel',
    destructive: false,
  };
}

/** §6.7 — Unsaved changes guard */
export function unsavedChangesVariant(): VariantProps {
  return {
    title: 'Discard changes?',
    body: 'You have unsaved edits.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
    destructive: true,
  };
}

/** §6.8 — Delete folder */
export function deleteFolderVariant(folderName: string): VariantProps {
  return {
    title: `Delete folder "${folderName}"?`,
    body: 'Projects inside will move to no folder.',
    confirmLabel: 'Delete folder',
    cancelLabel: 'Cancel',
    destructive: true,
  };
}

/** §6.9 — Delete project */
export function deleteProjectVariant(projectName: string, activeItemCount: number): VariantProps {
  return {
    title: `Delete project "${projectName}"?`,
    body: `${activeItemCount} active ${activeItemCount === 1 ? 'item' : 'items'} will be moved to Trash.`,
    confirmLabel: 'Delete project',
    cancelLabel: 'Cancel',
    destructive: true,
  };
}
