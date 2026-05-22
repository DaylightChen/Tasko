import type { Folder, Project, ProjectId } from '@tasko/types';
import { INBOX_PROJECT_ID } from '@tasko/types';
import { ChevronDown } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useFolders } from '../../api/folders';
import { useProjects } from '../../api/projects';
import styles from './styles.module.css';

export interface ProjectPickerProps {
  value: ProjectId | null;
  onChange: (id: ProjectId) => void;
  required?: boolean;
  error?: string | undefined;
  'data-testid'?: string;
}

interface ProjectOption {
  project: Project;
  folder: Folder | null;
}

export function ProjectPicker({
  value,
  onChange,
  required,
  error,
  'data-testid': testId,
}: ProjectPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerId = useId();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { data: projectsData } = useProjects();
  const { data: foldersData } = useFolders();

  const projects = projectsData?.projects ?? [];
  const folders = foldersData?.folders ?? [];

  const foldersById = new Map<string, Folder>(
    (folders as Folder[]).map((f): [string, Folder] => [f.id as string, f]),
  );

  // Build grouped options: inbox first, then by folder, then ungrouped
  const inboxProject = projects.find((p) => p.id === INBOX_PROJECT_ID);
  const otherProjects = projects.filter((p) => p.id !== INBOX_PROJECT_ID);

  const projectOptions: ProjectOption[] = [
    ...(inboxProject ? [{ project: inboxProject as Project, folder: null as Folder | null }] : []),
    ...otherProjects.map(
      (p): ProjectOption => ({
        project: p as Project,
        folder: p.folder_id ? (foldersById.get(p.folder_id as string) ?? null) : null,
      }),
    ),
  ];

  const filteredOptions = query
    ? projectOptions.filter((o) => o.project.name.toLowerCase().includes(query.toLowerCase()))
    : projectOptions;

  const selectedProject = projects.find((p) => p.id === value);
  const displayLabel = selectedProject?.name ?? 'Pick a project';

  const handleSelect = (id: ProjectId) => {
    onChange(id);
    setIsOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  function renderOptions() {
    if (filteredOptions.length === 0) {
      return (
        <div className={styles.empty} aria-live="polite">
          No matches
        </div>
      );
    }
    return filteredOptions.map(({ project, folder }) => (
      <button
        key={project.id}
        type="button"
        role="option"
        aria-selected={project.id === value}
        className={styles.option}
        data-selected={project.id === value ? '' : undefined}
        tabIndex={-1}
        onMouseDown={(e) => {
          e.preventDefault();
          handleSelect(project.id);
        }}
      >
        {folder && <span className={styles.folderLabel}>{folder.name} / </span>}
        <span>{project.name}</span>
      </button>
    ));
  }

  return (
    <div className={styles.wrapper} data-testid={testId}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-label={`Project: ${displayLabel}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-required={required ? 'true' : undefined}
        aria-invalid={error ? 'true' : undefined}
        className={styles.trigger}
        data-error={error ? '' : undefined}
        onClick={() => setIsOpen((o) => !o)}
      >
        <span className={styles.triggerLabel}>{displayLabel}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={styles.chevron}
          data-open={isOpen ? '' : undefined}
        />
      </button>

      {isOpen && (
        <div className={styles.dropdown} onKeyDown={handleKeyDown}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              className={styles.search}
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search projects"
              // biome-ignore lint/a11y/noAutofocus: needs to focus when dropdown opens
              autoFocus
            />
          </div>
          <div id={listboxId} role="listbox" aria-label="Projects" className={styles.listbox} tabIndex={0}>
            {renderOptions()}
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

export default ProjectPicker;
