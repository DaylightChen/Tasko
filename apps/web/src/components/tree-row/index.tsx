import type { Item, LocalDate, TagId } from '@tasko/types';
import { ChevronDown, ChevronRight, Layers, LayoutGrid, MoreHorizontal, SquareCheckBig } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTags } from '../../api/tags';
import { useTagNavigation } from '../../hooks/useTagNavigation';
import { Checkbox } from '../checkbox';
import styles from './styles.module.css';

// ─── Rollup progress chip ──────────────────────────────────────────────────────

interface RollupChipProps {
  completed: number;
  total: number;
}

function RollupChip({ completed, total }: RollupChipProps) {
  const pct = total === 0 ? 0 : (completed / total) * 100;
  return (
    <span
      className={styles.rollupChip}
      aria-label={`${completed} of ${total} children complete`}
      title={`${completed} / ${total}`}
    >
      <span className={styles.rollupLabel}>
        {completed}/{total}
      </span>
      <span className={styles.rollupBar} aria-hidden="true">
        <span className={styles.rollupFill} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

// ─── Type icon ────────────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: Item['type'] }) {
  if (type === 'epic') {
    return <Layers size={20} aria-hidden="true" className={styles.typeIcon} />;
  }
  if (type === 'feature') {
    return <LayoutGrid size={20} aria-hidden="true" className={styles.typeIcon} />;
  }
  return <SquareCheckBig size={20} aria-hidden="true" className={styles.typeIcon} />;
}

// ─── Date chip (condensed) ────────────────────────────────────────────────────

function DateChip({ date, today }: { date: string; today: LocalDate }) {
  const isOverdue = date < today;
  const isToday = date === today;
  return (
    <span
      className={styles.dateChip}
      data-overdue={isOverdue ? '' : undefined}
      data-today={isToday ? '' : undefined}
    >
      {isToday ? 'Today' : date}
    </span>
  );
}

// ─── Tag chips ────────────────────────────────────────────────────────────────

function TagChips({ tagIds, onTagClick }: { tagIds: TagId[]; onTagClick?: (tagId: TagId) => void }) {
  const MAX_VISIBLE = 2;
  // Resolve TagId → name from the shared tags cache; fall back to id.
  const { data: tagsData } = useTags(true);
  const nameById = new Map<string, string>((tagsData?.tags ?? []).map((t) => [t.id, t.name]));
  if (tagIds.length === 0) return null;
  const visible = tagIds.slice(0, MAX_VISIBLE);
  const overflow = tagIds.length - MAX_VISIBLE;
  return (
    <span className={styles.tagChips}>
      {visible.map((id) => {
        const name = nameById.get(id) ?? id;
        return (
          <button
            key={id}
            type="button"
            className={styles.tagChip}
            aria-label={`Filter by tag ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              onTagClick?.(id);
            }}
          >
            #{name}
          </button>
        );
      })}
      {overflow > 0 && <span className={styles.tagOverflow}>+{overflow}</span>}
    </span>
  );
}

// ─── Priority dot ─────────────────────────────────────────────────────────────

function PriorityDot({
  priority,
  onClick,
}: {
  priority: Item['priority'];
  onClick?: () => void;
}) {
  const sizes: Record<string, number> = { none: 6, low: 6, medium: 8, high: 10 };
  const size = sizes[priority] ?? 6;
  const hollow = priority === 'none';
  return (
    <button
      type="button"
      className={styles.priorityDot}
      style={{ width: size, height: size }}
      data-priority={priority}
      data-hollow={hollow ? '' : undefined}
      aria-label={`Priority: ${priority}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    />
  );
}

// ─── Indent guides ────────────────────────────────────────────────────────────

function IndentGuides({ level }: { level: 1 | 2 | 3 }) {
  const guides = level - 1;
  if (guides === 0) return null;
  return (
    <>
      {Array.from({ length: guides }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static array
        <span key={i} className={styles.indentGuide} aria-hidden="true" />
      ))}
    </>
  );
}

// ─── TreeRow props ────────────────────────────────────────────────────────────

export interface TreeRowProps {
  item: Item;
  /** 1 = Epic-level (top), 2 = Feature-level, 3 = Task-level */
  level: 1 | 2 | 3;
  expanded: boolean;
  posInSet: number;
  setSize: number;
  hasChildren: boolean;
  rollup?: { completed: number; total: number };
  isFocused?: boolean;
  isSelected?: boolean;
  todayLocalDate: LocalDate;
  inlineEditMode?: boolean;
  onToggleExpand: () => void;
  onToggleCheckbox?: () => void;
  onAddChild?: () => void;
  onClick?: () => void;
  onMenuOpen?: (coords: { x: number; y: number }) => void;
  onTitleClickInlineEdit?: () => void;
  onTitleCommitInlineEdit?: (newTitle: string) => void;
  onDateClick?: () => void;
  onPriorityClick?: () => void;
  onMoveToOpen?: () => void;
}

/**
 * TreeRow — a single row in the per-project tree view.
 *
 * Renders indentation guides, expand chevron, type icon, checkbox (Tasks only),
 * inline-editable title, meta chips, and rollup progress for Epics/Features.
 *
 * ARIA: role="treeitem" with aria-level, aria-expanded, aria-setsize, aria-posinset.
 */
export function TreeRow({
  item,
  level,
  expanded,
  posInSet,
  setSize,
  hasChildren,
  rollup,
  isFocused = false,
  isSelected = false,
  todayLocalDate,
  inlineEditMode = false,
  onToggleExpand,
  onToggleCheckbox,
  onAddChild,
  onClick,
  onMenuOpen,
  onTitleClickInlineEdit,
  onTitleCommitInlineEdit,
  onDateClick,
  onPriorityClick,
  onMoveToOpen,
}: TreeRowProps) {
  const handleTagClick = useTagNavigation();
  const [isHovered, setIsHovered] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditValue(item.title);
  }, [item.title]);

  useEffect(() => {
    if (isFocused && rowRef.current && !inlineEditMode) {
      rowRef.current.focus();
    }
  }, [isFocused, inlineEditMode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (inlineEditMode) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (!expanded && hasChildren) {
            onToggleExpand();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (expanded && hasChildren) {
            onToggleExpand();
          }
          break;
        case 'Enter':
        case 'o':
        case 'O':
          e.preventDefault();
          onClick?.();
          break;
        case ' ':
          if (item.type === 'task') {
            e.preventDefault();
            onToggleCheckbox?.();
          }
          break;
      }
    },
    [inlineEditMode, expanded, hasChildren, item.type, onToggleExpand, onClick, onToggleCheckbox],
  );

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onTitleCommitInlineEdit?.(editValue.trim() || item.title);
    } else if (e.key === 'Escape') {
      setEditValue(item.title);
      onTitleCommitInlineEdit?.(item.title);
    }
  };

  const isCompleted = item.status === 'done';

  const dataStates: string[] = [];
  if (isHovered) dataStates.push('hover');
  if (isFocused) dataStates.push('focus');
  if (isSelected) dataStates.push('selected');
  if (isCompleted) dataStates.push('completed');

  const isTask = item.type === 'task';
  const showRollup = !isTask && rollup !== undefined && rollup.total > 0;
  const showDateChip = isTask;
  // Type icon: shown for Epics/Features always, and for loose top-level tasks.
  // Hidden for nested tasks — the chevron-empty + checkbox already signal "task".
  const showTypeIcon = !isTask || item.parent_id === null;

  return (
    <div
      ref={rowRef}
      role="treeitem"
      aria-level={level}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={isSelected}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      className={styles.row}
      data-state={dataStates.length > 0 ? dataStates.join(' ') : undefined}
      data-item-id={item.id}
      data-type={item.type}
      tabIndex={isFocused ? 0 : -1}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClick?.();
      }}
    >
      {/* Indent guides */}
      <IndentGuides level={level} />

      {/* Expand/collapse chevron */}
      <button
        type="button"
        className={styles.expandBtn}
        aria-label={expanded ? 'Collapse' : 'Expand'}
        aria-hidden={!hasChildren}
        tabIndex={-1}
        style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        {expanded ? (
          <ChevronDown size={16} aria-hidden="true" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" />
        )}
      </button>

      {/* Type icon — hidden for nested tasks; shown for Epics/Features/loose tasks. */}
      {showTypeIcon && <TypeIcon type={item.type} />}

      {/* Priority dot — Tasks only, rendered on the left between chevron/icon and checkbox. */}
      {isTask && (
        <PriorityDot
          priority={item.priority}
          {...(onPriorityClick !== undefined ? { onClick: onPriorityClick } : {})}
        />
      )}

      {/* Checkbox — Tasks only */}
      {isTask && (
        <Checkbox
          checked={isCompleted}
          onChange={() => onToggleCheckbox?.()}
          aria-label={`Mark "${item.title}" complete`}
          size="md"
          disabled={false}
        />
      )}

      {/* Title */}
      <div className={styles.titleArea}>
        {inlineEditMode ? (
          <input
            className={styles.inlineEditInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={() => onTitleCommitInlineEdit?.(editValue.trim() || item.title)}
            // biome-ignore lint/a11y/noAutofocus: user clicked title to edit
            autoFocus
            aria-label="Edit title"
          />
        ) : (
          <button
            type="button"
            className={styles.title}
            data-completed={isCompleted ? '' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onTitleClickInlineEdit?.();
            }}
          >
            {item.title}
          </button>
        )}
      </div>

      {/* Meta (right side): tags, date, rollup. Priority is now on the left. */}
      <div className={styles.metaArea}>
        {item.tags.length > 0 && <TagChips tagIds={item.tags as TagId[]} onTagClick={handleTagClick} />}
        {showDateChip && <DateChip date={item.due_date} today={todayLocalDate} />}
        {showRollup && rollup && <RollupChip completed={rollup.completed} total={rollup.total} />}
      </div>

      {/* Hover affordances — always rendered so they reserve space at the
       * right end of the row (no jump on hover) and don't overlap the
       * meta chips. Visibility is driven by .row:hover / :focus-within. */}
      <div className={styles.hoverActions}>
        {/* + Add child affordance (Epic → Feature, Feature → Task) */}
        {!isTask && onAddChild && (
          <button
            type="button"
            className={styles.hoverBtn}
            aria-label={item.type === 'epic' ? '+ Add Feature' : '+ Add Task'}
            title={item.type === 'epic' ? '+ Add Feature' : '+ Add Task'}
            onClick={(e) => {
              e.stopPropagation();
              onAddChild();
            }}
          >
            +
          </button>
        )}

        <button
          type="button"
          className={styles.hoverBtn}
          aria-label="More actions"
          title="More actions"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onMenuOpen?.({ x: rect.left, y: rect.bottom + 4 });
          }}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.hoverBtn}
          aria-label="Open (O)"
          title="Open"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default TreeRow;
