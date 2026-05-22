import type { Item, ItemId, ProjectId } from '@tasko/types';
import { Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useProjects } from '../../api/projects';
import { canMoveClient } from '../../lib/depth-cap-client';
import { Modal } from '../modal';
import styles from './styles.module.css';

export interface MoveToPickerProps {
  source: Item;
  /** All items in scope (typically the current project's items map). */
  items: Map<ItemId, Item>;
  onClose: () => void;
  onMove: (args: { new_parent_id?: ItemId | null; new_project_id?: ProjectId }) => void;
}

interface Candidate {
  label: string;
  subtitle: string;
  /** If a project root destination, project_id only; parent_id = null */
  projectId: ProjectId;
  parentId: ItemId | null;
  canMove: boolean;
  reason: string | undefined;
}

/**
 * MoveToPickerModal — modal with typeahead that lists valid move destinations.
 *
 * Destinations include:
 * - Every project (move to project root).
 * - Every Epic and Feature in the current project (move within project).
 *
 * Invalid candidates (depth-cap violations, self/descendant) are shown
 * disabled with the rejection reason.
 */
export function MoveToPickerModal({ source, items, onClose, onMove }: MoveToPickerProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects ?? [];

  // Build candidate list
  const candidates: Candidate[] = useMemo(() => {
    const list: Candidate[] = [];

    // 1. Every project root
    for (const project of projects) {
      const check = canMoveClient({ source, newParent: null, items });
      const reason: string | undefined = check.ok
        ? undefined
        : (check as { ok: false; reason: string }).reason;
      list.push({
        label: project.name,
        subtitle: 'Project root',
        projectId: project.id as ProjectId,
        parentId: null,
        canMove: check.ok,
        reason,
      });
    }

    // 2. Every Epic and Feature in the items map (top-2 levels)
    for (const item of items.values()) {
      if (item.id === source.id) continue;
      if (item.type !== 'epic' && item.type !== 'feature') continue;
      if (item.trashed_at) continue;

      const check = canMoveClient({ source, newParent: item, items });
      const project = projects.find((p) => p.id === item.project_id);
      const reason: string | undefined = check.ok
        ? undefined
        : (check as { ok: false; reason: string }).reason;
      list.push({
        label: item.title,
        subtitle: project ? `${project.name} · ${item.type}` : item.type,
        projectId: item.project_id as ProjectId,
        parentId: item.id as ItemId,
        canMove: check.ok,
        reason,
      });
    }

    return list;
  }, [source, items, projects]);

  const filtered = useMemo(() => {
    if (!query.trim()) return candidates;
    const q = query.toLowerCase();
    return candidates.filter(
      (c) => c.label.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const handleSelect = (candidate: Candidate) => {
    if (!candidate.canMove) return;
    onMove({
      new_parent_id: candidate.parentId,
      new_project_id: candidate.projectId,
    });
  };

  return (
    <Modal open onClose={onClose} title="Move to…" maxWidth={480} initialFocus={inputRef}>
      <div className={styles.root}>
        {/* Search input */}
        <div className={styles.searchRow}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search projects and items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter destinations"
          />
        </div>

        {/* Candidate list */}
        <ul className={styles.list} aria-label="Move destinations">
          {filtered.length === 0 && <li className={styles.emptyState}>No matching destinations.</li>}
          {filtered.map((candidate, idx) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: candidates are stable during render
              key={idx}
              aria-disabled={!candidate.canMove}
              className={styles.candidate}
              data-disabled={!candidate.canMove ? '' : undefined}
              onClick={() => handleSelect(candidate)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && candidate.canMove) {
                  handleSelect(candidate);
                }
              }}
              tabIndex={candidate.canMove ? 0 : -1}
            >
              <span className={styles.candidateLabel}>{candidate.label}</span>
              <span className={styles.candidateSubtitle}>{candidate.subtitle}</span>
              {!candidate.canMove && candidate.reason && (
                <span className={styles.candidateReason}>{candidate.reason}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

export default MoveToPickerModal;
