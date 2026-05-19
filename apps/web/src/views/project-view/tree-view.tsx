import type { Item, ItemId, ProjectId } from '@tasko/types';
import { ListTree, SquareKanban } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreateItem, useItems, useMoveItem, usePatchItem } from '../../api/items';
import { ConfirmationPrompt } from '../../components/confirmation-prompt';
import { EmptyState } from '../../components/empty-state';
import { MoveToPickerModal } from '../../components/move-to-picker';
import { TreeRow } from '../../components/tree-row';
import { ViewToggle } from '../../components/view-toggle';
import type { ViewOption } from '../../components/view-toggle';
import { todayLocal } from '../../lib/date-fmt';
import { rollupProgress } from '../../lib/rollup';
import { useSnackbarStore } from '../../store/snackbar';
import { useTaskModalStore } from '../../store/task-modal';
import { useTreeExpansionStore } from '../../store/tree-expansion';
import styles from './tree-view.module.css';

// ─── Inline add row ───────────────────────────────────────────────────────────

interface InlineAddRowProps {
  placeholder: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
  level?: 1 | 2 | 3;
}

function InlineAddRow({ placeholder, onCommit, onCancel, level = 1 }: InlineAddRowProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const indentPx = (level - 1) * 24;

  return (
    <div className={styles.inlineAddRow} style={{ paddingLeft: indentPx + 8 }}>
      <input
        ref={inputRef}
        className={styles.inlineAddInput}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            onCommit(value.trim());
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        onBlur={() => {
          if (value.trim()) onCommit(value.trim());
          else onCancel();
        }}
      />
      <span className={styles.inlineAddHint}>Enter to add · Esc to cancel</span>
    </div>
  );
}

// ─── Context menu (minimal) ────────────────────────────────────────────────────

interface ContextMenuProps {
  item: Item;
  position: { x: number; y: number };
  onClose: () => void;
  onOpen: () => void;
  onMarkComplete: () => void;
  onMoveTo: () => void;
  onDelete: () => void;
}

function ContextMenu({
  item,
  position,
  onClose,
  onOpen,
  onMarkComplete,
  onMoveTo,
  onDelete,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ top: position.y, left: position.x }}
      role="menu"
      aria-label="Item actions"
    >
      <button
        type="button"
        role="menuitem"
        className={styles.contextMenuItem}
        onClick={() => {
          onOpen();
          onClose();
        }}
      >
        Open
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.contextMenuItem}
        onClick={() => {
          onMoveTo();
          onClose();
        }}
      >
        Move to…
      </button>
      {(item.type === 'epic' || item.type === 'feature') && (
        <button
          type="button"
          role="menuitem"
          className={styles.contextMenuItem}
          onClick={() => {
            onMarkComplete();
            onClose();
          }}
        >
          Mark complete
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className={`${styles.contextMenuItem} ${styles.contextMenuItemDestructive}`}
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );
}

// ─── Recursive tree renderer ──────────────────────────────────────────────────

interface TreeNodeProps {
  item: Item;
  level: 1 | 2 | 3;
  siblings: Item[];
  allItems: Item[];
  itemsMap: Map<ItemId, Item>;
  projectId: ProjectId;
  today: string;
  inlineAddState: InlineAddState | null;
  setInlineAddState: (state: InlineAddState | null) => void;
  onItemClick: (item: Item) => void;
  onContextMenu: (item: Item, x: number, y: number) => void;
  onMoveToOpen: (item: Item) => void;
  onToggleCheckbox: (item: Item) => void;
  onRowFocus: (item: Item) => void;
  createItem: ReturnType<typeof useCreateItem>;
  patchItem: ReturnType<typeof usePatchItem>;
}

interface InlineAddState {
  parentId: ItemId | null;
  type: 'epic' | 'feature';
  /** Which item triggered the add (for positioning the inline row) */
  afterItemId: ItemId | null;
}

function getChildren(parentId: ItemId | null, allItems: Item[]): Item[] {
  return allItems
    .filter((i) => i.parent_id === (parentId ?? null) && !i.trashed_at)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function TreeNode({
  item,
  level,
  siblings,
  allItems,
  itemsMap,
  projectId,
  today,
  inlineAddState,
  setInlineAddState,
  onItemClick,
  onContextMenu,
  onMoveToOpen,
  onToggleCheckbox,
  onRowFocus,
  createItem,
  patchItem,
}: TreeNodeProps) {
  const expansion = useTreeExpansionStore();
  const expanded = expansion.isExpanded(projectId, item.id as ItemId);
  const children = getChildren(item.id as ItemId, allItems);
  const hasChildren = children.length > 0;

  const posInSet = siblings.indexOf(item) + 1;
  const setSize = siblings.length;

  const rollup = item.type !== 'task' ? rollupProgress(item, itemsMap) : undefined;

  const nextLevel: 1 | 2 | 3 = level === 1 ? 2 : level === 2 ? 3 : 3;

  const handleAddChild = () => {
    const childType = 'feature' as const;
    if (item.type === 'feature') {
      // For features, open the Task modal with pre-fills
      const taskModal = useTaskModalStore.getState();
      taskModal.openNew({
        initialProjectId: projectId,
        initialParentId: item.id as ItemId,
      });
      return;
    }
    setInlineAddState({
      parentId: item.id as ItemId,
      type: childType,
      afterItemId: item.id as ItemId,
    });
    expansion.setExpanded(projectId, item.id as ItemId, true);
  };

  const showInlineAddBelow = inlineAddState?.afterItemId === item.id && inlineAddState.parentId === item.id;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(item, e.clientX, e.clientY);
  };

  return (
    <>
      <div onContextMenu={handleContextMenu} className={styles.treeNodeWrapper}>
        <TreeRow
          item={item}
          level={level}
          expanded={expanded}
          posInSet={posInSet}
          setSize={setSize}
          hasChildren={hasChildren}
          {...(rollup !== undefined ? { rollup } : {})}
          todayLocalDate={today as ReturnType<typeof todayLocal>}
          onToggleExpand={() => expansion.toggle(projectId, item.id as ItemId)}
          onToggleCheckbox={() => onToggleCheckbox(item)}
          {...(item.type !== 'task' ? { onAddChild: handleAddChild } : {})}
          onClick={() => {
            onRowFocus(item);
            onItemClick(item);
          }}
          onMenuOpen={() => onContextMenu(item, 0, 0)}
          onMoveToOpen={() => onMoveToOpen(item)}
          onTitleClickInlineEdit={() => {
            /* inline title edit handled by TreeRow internally */
          }}
          onTitleCommitInlineEdit={(newTitle) => {
            if (newTitle && newTitle !== item.title) {
              patchItem.mutate({ id: item.id as ItemId, patch: { title: newTitle } });
            }
          }}
        />
      </div>

      {/* Inline add row inside feature (after clicking + Add Feature on epic) */}
      {inlineAddState?.afterItemId === item.id &&
        inlineAddState.parentId === item.id &&
        inlineAddState.type === 'feature' && (
          <InlineAddCommitter
            level={nextLevel}
            type={inlineAddState.type}
            parentId={item.id as ItemId}
            projectId={projectId}
            createItem={createItem}
            onDone={() => setInlineAddState(null)}
          />
        )}

      {/* Recursively render children when expanded */}
      {expanded && hasChildren && (
        // biome-ignore lint/a11y/useSemanticElements: WAI-ARIA tree pattern requires role="group" on the subtree container, not <fieldset>
        <div role="group" aria-label={item.title}>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              level={nextLevel}
              siblings={children}
              allItems={allItems}
              itemsMap={itemsMap}
              projectId={projectId}
              today={today}
              inlineAddState={inlineAddState}
              setInlineAddState={setInlineAddState}
              onItemClick={onItemClick}
              onContextMenu={onContextMenu}
              onMoveToOpen={onMoveToOpen}
              onToggleCheckbox={onToggleCheckbox}
              onRowFocus={onRowFocus}
              createItem={createItem}
              patchItem={patchItem}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Separate commit component to avoid hook-in-callback pattern
interface InlineAddCommitterProps {
  level: 1 | 2 | 3;
  type: 'epic' | 'feature';
  parentId: ItemId | null;
  projectId: ProjectId;
  createItem: ReturnType<typeof useCreateItem>;
  onDone: () => void;
}

function InlineAddCommitter({
  level,
  type,
  parentId,
  projectId,
  createItem,
  onDone,
}: InlineAddCommitterProps) {
  const today = todayLocal();
  return (
    <InlineAddRow
      level={level}
      placeholder={type === 'epic' ? 'Epic name…' : 'Feature name…'}
      onCommit={(title) => {
        createItem.mutate({
          type,
          project_id: projectId,
          parent_id: parentId,
          title,
          due_date: today,
          start_date: null,
          due_time: null,
          priority: 'none',
          status: 'todo',
          tags: [],
          recurrence: null,
          notes: '',
        });
        onDone();
      }}
      onCancel={onDone}
    />
  );
}

// ─── TreeView ─────────────────────────────────────────────────────────────────

interface TreeViewProps {
  projectId: ProjectId;
  projectName: string;
  onNavigateKanban: () => void;
}

export function TreeView({ projectId, projectName, onNavigateKanban }: TreeViewProps) {
  const today = todayLocal();
  const taskModal = useTaskModalStore();
  const snackbar = useSnackbarStore();
  const expansion = useTreeExpansionStore();

  const [currentView, setCurrentView] = useState<string>('tree');
  const [inlineAddState, setInlineAddState] = useState<InlineAddState | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<{
    item: Item;
    x: number;
    y: number;
  } | null>(null);
  const [moveToPickerItem, setMoveToPickerItem] = useState<Item | null>(null);
  const [parentCompletionItem, setParentCompletionItem] = useState<Item | null>(null);
  const [focusedItem, setFocusedItem] = useState<Item | null>(null);

  // Load items
  const { data: itemsData, isLoading } = useItems({
    view: 'project',
    project_id: projectId,
    include_completed: showCompleted,
  });

  const allItems = (itemsData?.items ?? []) as Item[];

  // Build items map for depth-cap and rollup computations
  const itemsMap = useMemo(() => {
    const map = new Map<ItemId, Item>();
    for (const item of allItems) map.set(item.id as ItemId, item);
    return map;
  }, [allItems]);

  // Separate top-level items (parent_id === null)
  const topLevelItems = useMemo(
    () => allItems.filter((i) => i.parent_id === null).sort((a, b) => a.sort_order - b.sort_order),
    [allItems],
  );

  // Initialise expansion defaults (top-level epics expanded) once
  useEffect(() => {
    const topIds = topLevelItems.map((i) => i.id as ItemId);
    expansion.initProject(projectId, topIds);
  }, [projectId, topLevelItems, expansion]);

  // Separate epics/features from loose top-level tasks
  const topLevelEpicsAndFeatures = topLevelItems.filter((i) => i.type !== 'task');
  const looseTopLevelTasks = topLevelItems.filter((i) => i.type === 'task');

  const createItem = useCreateItem();
  const patchItem = usePatchItem();
  const moveItem = useMoveItem();

  // ⌘⇧M hotkey for Move-to picker (task-18 will consolidate into registry)
  const focusedItemRef = useRef<Item | null>(null);
  focusedItemRef.current = focusedItem;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.shiftKey && e.key === 'm') {
        e.preventDefault();
        if (focusedItemRef.current) {
          setMoveToPickerItem(focusedItemRef.current);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleItemClick = (item: Item) => {
    taskModal.openEdit(item.id as ItemId);
  };

  const handleContextMenu = (item: Item, x: number, y: number) => {
    setContextMenuState({ item, x, y });
  };

  const handleToggleCheckbox = (item: Item) => {
    if (item.type !== 'task') {
      // Epic/Feature: prompt parent-completion blocking
      setParentCompletionItem(item);
      return;
    }
    patchItem.mutate({
      id: item.id as ItemId,
      patch: { status: item.status === 'done' ? 'todo' : 'done' },
    });
  };

  const handleMarkComplete = (item: Item) => {
    setParentCompletionItem(item);
  };

  const handleConfirmParentCompletion = () => {
    if (!parentCompletionItem) return;
    const item = parentCompletionItem;
    setParentCompletionItem(null);

    // Mark the item itself done
    patchItem.mutate({ id: item.id as ItemId, patch: { status: 'done' } });

    // Mark all incomplete descendants done (client-side loop; task-12 bulk endpoint)
    // Note: small consistency window — if network fails mid-sequence, some children
    // may remain incomplete. task-12 adds a POST /api/bulk/complete to handle this atomically.
    const descendants = getDescendants(item.id as ItemId, allItems);
    for (const desc of descendants) {
      if (desc.status !== 'done') {
        patchItem.mutate({ id: desc.id as ItemId, patch: { status: 'done' } });
      }
    }
  };

  const getDescendants = (itemId: ItemId, items: Item[]): Item[] => {
    const result: Item[] = [];
    const queue = [itemId];
    while (queue.length > 0) {
      const pid = queue.shift();
      if (pid === undefined) break;
      const children = items.filter((i) => i.parent_id === pid && !i.trashed_at);
      for (const child of children) {
        result.push(child);
        queue.push(child.id as ItemId);
      }
    }
    return result;
  };

  const incompleteDescendantCount = parentCompletionItem
    ? getDescendants(parentCompletionItem.id as ItemId, allItems).filter((d) => d.status !== 'done').length
    : 0;

  const parentCompletionBody = parentCompletionItem
    ? parentCompletionItem.type === 'feature'
      ? `This feature has ${incompleteDescendantCount} incomplete task${incompleteDescendantCount !== 1 ? 's' : ''}. Completing it will mark them all done.`
      : `This epic has ${incompleteDescendantCount} incomplete item${incompleteDescendantCount !== 1 ? 's' : ''}. Completing it will mark them all done.`
    : '';

  const VIEW_OPTIONS: ViewOption[] = [
    { value: 'tree', icon: ListTree, label: 'Tree view' },
    { value: 'kanban', icon: SquareKanban, label: 'Kanban view' },
  ];

  const handleViewChange = (value: string) => {
    setCurrentView(value);
    if (value === 'kanban') onNavigateKanban();
  };

  const completedCount = allItems.filter((i) => i.status === 'done').length;

  if (isLoading && allItems.length === 0) {
    return (
      <div className={styles.root} aria-busy="true">
        <div className={styles.loadingPlaceholder} />
      </div>
    );
  }

  if (allItems.length === 0 && !showCompleted) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <h1 className={styles.heading}>{projectName}</h1>
          <ViewToggle options={VIEW_OPTIONS} value={currentView} onChange={handleViewChange} />
        </div>
        <EmptyState
          icon={ListTree}
          headline={`No work in ${projectName} yet.`}
          subline="Add an Epic to start organizing, or a Task to keep it loose."
          tone="neutral"
          action={{
            label: '+ Add Epic',
            onClick: () => setInlineAddState({ parentId: null, type: 'epic', afterItemId: null }),
          }}
        />
        {inlineAddState?.parentId === null && (
          <InlineAddCommitter
            level={1}
            type="epic"
            parentId={null}
            projectId={projectId}
            createItem={createItem}
            onDone={() => setInlineAddState(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.heading}>{projectName}</h1>
        <div className={styles.headerControls}>
          <ViewToggle options={VIEW_OPTIONS} value={currentView} onChange={handleViewChange} />
          <button
            type="button"
            className={styles.addEpicBtn}
            onClick={() => setInlineAddState({ parentId: null, type: 'epic', afterItemId: null })}
          >
            + Add Epic
          </button>
          <button
            type="button"
            className={styles.addTaskBtn}
            onClick={() => taskModal.openNew({ initialProjectId: projectId })}
          >
            + Add Task in project
          </button>
        </div>
      </div>

      {/* + Add Epic inline row (top-level) */}
      {inlineAddState?.parentId === null && (
        <InlineAddCommitter
          level={1}
          type="epic"
          parentId={null}
          projectId={projectId}
          createItem={createItem}
          onDone={() => setInlineAddState(null)}
        />
      )}

      {/* Tree */}
      <div role="tree" aria-label={`${projectName} tasks`} className={styles.tree}>
        {/* Epics and Features at top level */}
        {topLevelEpicsAndFeatures.map((item) => (
          <TreeNode
            key={item.id}
            item={item}
            level={1}
            siblings={topLevelEpicsAndFeatures}
            allItems={allItems}
            itemsMap={itemsMap}
            projectId={projectId}
            today={today}
            inlineAddState={inlineAddState}
            setInlineAddState={setInlineAddState}
            onItemClick={handleItemClick}
            onContextMenu={handleContextMenu}
            onMoveToOpen={setMoveToPickerItem}
            onToggleCheckbox={handleToggleCheckbox}
            onRowFocus={setFocusedItem}
            createItem={createItem}
            patchItem={patchItem}
          />
        ))}

        {/* Loose tasks divider */}
        {topLevelEpicsAndFeatures.length > 0 && looseTopLevelTasks.length > 0 && (
          <h3 className={styles.looseDivider}>Loose tasks in project (no Epic parent)</h3>
        )}

        {/* Loose top-level tasks */}
        {looseTopLevelTasks.map((item) => (
          <TreeNode
            key={item.id}
            item={item}
            level={1}
            siblings={looseTopLevelTasks}
            allItems={allItems}
            itemsMap={itemsMap}
            projectId={projectId}
            today={today}
            inlineAddState={inlineAddState}
            setInlineAddState={setInlineAddState}
            onItemClick={handleItemClick}
            onContextMenu={handleContextMenu}
            onMoveToOpen={setMoveToPickerItem}
            onToggleCheckbox={handleToggleCheckbox}
            onRowFocus={setFocusedItem}
            createItem={createItem}
            patchItem={patchItem}
          />
        ))}
      </div>

      {/* Show N completed toggle */}
      {completedCount > 0 && (
        <button type="button" className={styles.showCompletedBtn} onClick={() => setShowCompleted((v) => !v)}>
          {showCompleted ? 'Hide completed' : `Show ${completedCount} completed`}
        </button>
      )}

      {/* Context menu */}
      {contextMenuState && (
        <ContextMenu
          item={contextMenuState.item}
          position={{ x: contextMenuState.x, y: contextMenuState.y }}
          onClose={() => setContextMenuState(null)}
          onOpen={() => handleItemClick(contextMenuState.item)}
          onMarkComplete={() => handleMarkComplete(contextMenuState.item)}
          onMoveTo={() => setMoveToPickerItem(contextMenuState.item)}
          onDelete={() => {
            snackbar.show({ variant: 'info', text: 'Trash (task-12)', durationMs: 3000 });
          }}
        />
      )}

      {/* Move-to picker */}
      {moveToPickerItem && (
        <MoveToPickerModal
          source={moveToPickerItem}
          items={itemsMap}
          onClose={() => setMoveToPickerItem(null)}
          onMove={({ new_parent_id, new_project_id }) => {
            const moveArgs: { id: ItemId; new_parent_id: ItemId | null; new_project_id?: string } = {
              id: moveToPickerItem.id as ItemId,
              new_parent_id: new_parent_id ?? null,
            };
            if (new_project_id !== undefined) {
              moveArgs.new_project_id = new_project_id;
            }
            moveItem.mutate(moveArgs);
            setMoveToPickerItem(null);
          }}
        />
      )}

      {/* Parent completion blocking prompt */}
      <ConfirmationPrompt
        open={parentCompletionItem !== null}
        onCancel={() => setParentCompletionItem(null)}
        onConfirm={handleConfirmParentCompletion}
        title="Complete all children and continue?"
        body={parentCompletionBody}
        confirmLabel="Complete all"
        destructive={false}
      />
    </div>
  );
}
