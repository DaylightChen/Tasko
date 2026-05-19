import { Link, useRouterState } from '@tanstack/react-router';
import type { FolderId, ProjectId } from '@tasko/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useCreateFolder, useDeleteFolder, useFolders, usePatchFolder } from '../../api/folders';
import { useHealth } from '../../api/health.js';
import { useItems } from '../../api/items';
import { useCreateProject, useDeleteProject, usePatchProject, useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import styles from './styles.module.css';

function useTodayBadge() {
  const { data } = useItems({ view: 'today' });
  const today = new Date().toISOString().slice(0, 10);
  if (!data) return { total: 0, overdue: 0 };
  const items = data.items;
  const overdue = items.filter(
    (i) => i.due_date < today && i.status !== 'done' && i.trashed_at === null,
  ).length;
  const total = items.filter((i) => i.status !== 'done' && i.trashed_at === null).length;
  return { total, overdue };
}

interface ContextMenuState {
  type: 'project' | 'folder';
  id: string;
  name: string;
  x: number;
  y: number;
}

interface NewProjectModalState {
  open: boolean;
  folderId: FolderId | null;
}

export function Sidebar() {
  const { data: projectsData } = useProjects();
  const { data: foldersData } = useFolders();
  const { data: tagsData } = useTags();
  const { data: health } = useHealth();
  const { total: todayTotal, overdue: todayOverdue } = useTodayBadge();

  const createProject = useCreateProject();
  const patchProject = usePatchProject();
  const deleteProject = useDeleteProject();
  const createFolder = useCreateFolder();
  const patchFolder = usePatchFolder();
  const deleteFolder = useDeleteFolder();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [newProjectModal, setNewProjectModal] = useState<NewProjectModalState>({
    open: false,
    folderId: null,
  });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [inlineFolderInput, setInlineFolderInput] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectFolderId, setNewProjectFolderId] = useState<FolderId | null>(null);
  const [newProjectHierarchical, setNewProjectHierarchical] = useState(false);

  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const addMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleContextMenu = useCallback(
    (e: MouseEvent, type: 'project' | 'folder', id: string, name: string) => {
      e.preventDefault();
      setContextMenu({ type, id, name, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleFolderCreate = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && folderName.trim()) {
        createFolder.mutate({ name: folderName.trim(), sort_order: 0 });
        setFolderName('');
        setInlineFolderInput(false);
      } else if (e.key === 'Escape') {
        setFolderName('');
        setInlineFolderInput(false);
      }
    },
    [folderName, createFolder],
  );

  const handleRename = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, type: 'project' | 'folder', id: string) => {
      if (e.key === 'Enter' && renameValue.trim()) {
        if (type === 'project') {
          patchProject.mutate({ id: id as unknown as ProjectId, patch: { name: renameValue.trim() } });
        } else {
          patchFolder.mutate({ id: id as unknown as FolderId, patch: { name: renameValue.trim() } });
        }
        setRenamingId(null);
        setRenameValue('');
      } else if (e.key === 'Escape') {
        setRenamingId(null);
        setRenameValue('');
      }
    },
    [renameValue, patchProject, patchFolder],
  );

  const handleCreateProject = useCallback(() => {
    if (!newProjectName.trim()) return;
    createProject.mutate({
      name: newProjectName.trim(),
      folder_id: newProjectFolderId,
      is_hierarchical: newProjectHierarchical,
      color: null,
      icon: null,
    });
    setNewProjectModal({ open: false, folderId: null });
    setNewProjectName('');
    setNewProjectFolderId(null);
    setNewProjectHierarchical(false);
  }, [newProjectName, newProjectFolderId, newProjectHierarchical, createProject]);

  const projects = projectsData?.projects ?? [];
  const folders = foldersData?.folders ?? [];
  const tags = tagsData?.tags ?? [];

  const userProjects = projects.filter((p) => !p.is_inbox);
  const inboxProject = projects.find((p) => p.is_inbox);

  const isActive = (path: string) => currentPath === path;

  return (
    <nav className={styles.sidebar} aria-label="Primary navigation">
      {/* Smart lists */}
      <ul className={styles.smartList}>
        <li>
          <Link
            to="/today"
            className={styles.navItem}
            data-active={isActive('/today') || isActive('/') ? '' : undefined}
            aria-current={isActive('/today') || isActive('/') ? 'page' : undefined}
          >
            <span className={styles.navLabel}>Today</span>
            {todayTotal > 0 && (
              <span
                className={styles.badge}
                aria-label={`${todayTotal} items${todayOverdue > 0 ? `, ${todayOverdue} overdue` : ''}`}
              >
                ({todayTotal})
                {todayOverdue > 0 && <span className={styles.overdueBadge}> ·{todayOverdue}</span>}
              </span>
            )}
          </Link>
        </li>
        <li>
          <Link
            to="/tomorrow"
            className={styles.navItem}
            data-active={isActive('/tomorrow') ? '' : undefined}
            aria-current={isActive('/tomorrow') ? 'page' : undefined}
          >
            <span className={styles.navLabel}>Tomorrow</span>
          </Link>
        </li>
        <li>
          <Link
            to="/next-7-days"
            className={styles.navItem}
            data-active={isActive('/next-7-days') ? '' : undefined}
            aria-current={isActive('/next-7-days') ? 'page' : undefined}
          >
            <span className={styles.navLabel}>Next 7 Days</span>
          </Link>
        </li>
        <li>
          <Link
            to="/inbox"
            className={styles.navItem}
            data-active={isActive('/inbox') ? '' : undefined}
            aria-current={isActive('/inbox') ? 'page' : undefined}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className={styles.navLabel}>Inbox</span>
          </Link>
        </li>
        <li>
          <Link
            to="/all"
            className={styles.navItem}
            data-active={isActive('/all') ? '' : undefined}
            aria-current={isActive('/all') ? 'page' : undefined}
          >
            <span className={styles.navLabel}>All</span>
          </Link>
        </li>
      </ul>

      {/* Projects section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle} id="projects-heading">
            PROJECTS
          </h2>
          <div className={styles.addMenuWrapper} ref={addMenuRef}>
            <button
              type="button"
              className={styles.addBtn}
              aria-label="Add project or folder"
              onClick={() => setShowAddMenu((v) => !v)}
              aria-expanded={showAddMenu}
            >
              +
            </button>
            {showAddMenu && (
              <div className={styles.addMenu} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.addMenuItem}
                  onClick={() => {
                    setShowAddMenu(false);
                    setNewProjectModal({ open: true, folderId: null });
                  }}
                >
                  New project
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.addMenuItem}
                  onClick={() => {
                    setShowAddMenu(false);
                    setInlineFolderInput(true);
                  }}
                >
                  New folder
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inline folder creation */}
        {inlineFolderInput && (
          <InlineFolderInput value={folderName} onChange={setFolderName} onKeyDown={handleFolderCreate} />
        )}

        <ul aria-labelledby="projects-heading" className={styles.projectList}>
          {/* Inbox row */}
          {inboxProject && (
            <li>
              <Link to="/inbox" className={styles.navItem} data-active={isActive('/inbox') ? '' : undefined}>
                <span className={styles.navLabel}>{inboxProject.name}</span>
              </Link>
            </li>
          )}

          {/* Folders with their projects */}
          {folders.map((folder) => {
            const folderProjects = userProjects.filter((p) => p.folder_id === folder.id);
            const isCollapsed = collapsedFolders.has(folder.id);

            return (
              <li
                key={folder.id}
                onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id, folder.name)}
              >
                <h2 className={styles.folderHeader}>
                  <button
                    type="button"
                    className={styles.folderToggle}
                    aria-expanded={!isCollapsed}
                    aria-controls={`folder-${folder.id}-list`}
                    onClick={() =>
                      setCollapsedFolders((prev) => {
                        const next = new Set(prev);
                        if (next.has(folder.id)) {
                          next.delete(folder.id);
                        } else {
                          next.add(folder.id);
                        }
                        return next;
                      })
                    }
                  >
                    {isCollapsed ? '▸' : '▾'}
                    {renamingId === folder.id ? (
                      <RenameInput
                        value={renameValue}
                        onChange={setRenameValue}
                        onKeyDown={(e) => handleRename(e, 'folder', folder.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={styles.folderName}>{folder.name}</span>
                    )}
                  </button>
                </h2>

                {!isCollapsed && (
                  <ul id={`folder-${folder.id}-list`} className={styles.folderProjects}>
                    {folderProjects.map((project) => (
                      <ProjectRow
                        key={project.id}
                        project={project}
                        isActive={isActive(`/project/${project.id}`)}
                        renamingId={renamingId}
                        renameValue={renameValue}
                        setRenameValue={setRenameValue}
                        handleRename={handleRename}
                        onContextMenu={(e) => handleContextMenu(e, 'project', project.id, project.name)}
                      />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}

          {/* Projects without a folder */}
          {userProjects
            .filter((p) => p.folder_id === null)
            .map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                isActive={isActive(`/project/${project.id}`)}
                renamingId={renamingId}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                handleRename={handleRename}
                onContextMenu={(e) => handleContextMenu(e, 'project', project.id, project.name)}
              />
            ))}
        </ul>
      </div>

      {/* Tags section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle} id="tags-heading">
          TAGS
        </h2>
        <ul aria-labelledby="tags-heading" className={styles.tagList}>
          {tags.map((tag) => (
            <li key={tag.id}>
              <Link
                to="/tag/$name"
                params={{ name: tag.name_lower }}
                className={styles.navItem}
                data-active={isActive(`/tag/${tag.name_lower}`) ? '' : undefined}
                aria-current={isActive(`/tag/${tag.name_lower}`) ? 'page' : undefined}
              >
                <span className={styles.navLabel}># {tag.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom links */}
      <ul className={styles.bottomLinks}>
        <li>
          <Link
            to="/calendar"
            className={styles.navItem}
            data-active={currentPath.startsWith('/calendar') ? '' : undefined}
            aria-current={currentPath.startsWith('/calendar') ? 'page' : undefined}
          >
            <span className={styles.navLabel}>Calendar</span>
          </Link>
        </li>
        <li>
          <Link
            to="/completed"
            className={styles.navItem}
            data-active={isActive('/completed') ? '' : undefined}
            aria-current={isActive('/completed') ? 'page' : undefined}
          >
            <span className={styles.navLabel}>Completed</span>
          </Link>
        </li>
        <li>
          <Link
            to="/trash"
            className={styles.navItem}
            data-active={isActive('/trash') ? '' : undefined}
            aria-current={isActive('/trash') ? 'page' : undefined}
          >
            <span className={styles.navLabel}>Trash</span>
          </Link>
        </li>
        <li>
          <Link
            to="/settings"
            className={styles.navItem}
            data-active={isActive('/settings') ? '' : undefined}
            aria-current={isActive('/settings') ? 'page' : undefined}
          >
            <span className={styles.navLabel}>Settings</span>
          </Link>
        </li>
      </ul>

      {/* Static footer */}
      <div className={styles.footer}>
        <span>Tasko v1.0</span>
        {health?.data_dir && <span> · Local files in {health.data_dir}</span>}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          aria-label={`Actions for ${contextMenu.name}`}
        >
          {contextMenu.type === 'project' && (
            <>
              <button
                type="button"
                role="menuitem"
                className={styles.contextMenuItem}
                onClick={() => {
                  setRenamingId(contextMenu.id);
                  setRenameValue(contextMenu.name);
                  setContextMenu(null);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.contextMenuItem}
                onClick={() => {
                  // Move to folder — TODO: show folder picker; stub
                  setContextMenu(null);
                }}
              >
                Move to folder
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.contextMenuItem}
                onClick={() => {
                  const project = projects.find((p) => p.id === contextMenu.id);
                  if (project) {
                    patchProject.mutate({
                      id: project.id as unknown as ProjectId,
                      patch: { is_hierarchical: !project.is_hierarchical },
                    });
                  }
                  setContextMenu(null);
                }}
              >
                Toggle hierarchical
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.contextMenuItemDestructive}
                onClick={() => {
                  deleteProject.mutate(contextMenu.id as unknown as ProjectId);
                  setContextMenu(null);
                }}
              >
                Delete
              </button>
            </>
          )}
          {contextMenu.type === 'folder' && (
            <>
              <button
                type="button"
                role="menuitem"
                className={styles.contextMenuItem}
                onClick={() => {
                  setRenamingId(contextMenu.id);
                  setRenameValue(contextMenu.name);
                  setContextMenu(null);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.contextMenuItemDestructive}
                onClick={() => {
                  deleteFolder.mutate(contextMenu.id as unknown as FolderId);
                  setContextMenu(null);
                }}
              >
                Delete folder
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.contextMenuItem}
                onClick={() => {
                  setShowAddMenu(false);
                  setNewProjectModal({ open: true, folderId: contextMenu.id as unknown as FolderId });
                  setContextMenu(null);
                }}
              >
                New project in folder
              </button>
            </>
          )}
        </div>
      )}

      {/* New Project Modal */}
      {newProjectModal.open && (
        <NewProjectModal
          folders={folders}
          initialFolderId={newProjectModal.folderId}
          onClose={() => {
            setNewProjectModal({ open: false, folderId: null });
            setNewProjectName('');
            setNewProjectFolderId(null);
            setNewProjectHierarchical(false);
          }}
          projectName={newProjectName}
          setProjectName={setNewProjectName}
          folderId={newProjectFolderId}
          setFolderId={setNewProjectFolderId}
          isHierarchical={newProjectHierarchical}
          setIsHierarchical={setNewProjectHierarchical}
          onSubmit={handleCreateProject}
          isPending={createProject.isPending}
        />
      )}
    </nav>
  );
}

interface RenameInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onClick?: (e: MouseEvent<HTMLInputElement>) => void;
}

function RenameInput({ value, onChange, onKeyDown, onClick }: RenameInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <input
      ref={ref}
      className={styles.renameInput}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onClick={onClick}
    />
  );
}

interface InlineFolderInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

function InlineFolderInput({ value, onChange, onKeyDown }: InlineFolderInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className={styles.inlineFolderRow}>
      <input
        ref={ref}
        className={styles.inlineFolderInput}
        placeholder="Folder name…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

interface ProjectRowProps {
  project: { id: string; name: string };
  isActive: boolean;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  handleRename: (e: KeyboardEvent<HTMLInputElement>, type: 'project' | 'folder', id: string) => void;
  onContextMenu: (e: MouseEvent<HTMLLIElement>) => void;
}

function ProjectRow({
  project,
  isActive,
  renamingId,
  renameValue,
  setRenameValue,
  handleRename,
  onContextMenu,
}: ProjectRowProps) {
  return (
    <li onContextMenu={onContextMenu}>
      {renamingId === project.id ? (
        <div className={styles.navItem}>
          <RenameInput
            value={renameValue}
            onChange={setRenameValue}
            onKeyDown={(e) => handleRename(e, 'project', project.id)}
          />
        </div>
      ) : (
        <Link
          to="/project/$id"
          params={{ id: project.id }}
          className={styles.navItem}
          data-active={isActive ? '' : undefined}
          aria-current={isActive ? 'page' : undefined}
        >
          <span className={styles.navLabel}>{project.name}</span>
        </Link>
      )}
    </li>
  );
}

interface NewProjectModalProps {
  folders: Array<{ id: string; name: string }>;
  initialFolderId: FolderId | null;
  onClose: () => void;
  projectName: string;
  setProjectName: (v: string) => void;
  folderId: FolderId | null;
  setFolderId: (v: FolderId | null) => void;
  isHierarchical: boolean;
  setIsHierarchical: (v: boolean) => void;
  onSubmit: () => void;
  isPending: boolean;
}

function NewProjectModal({
  folders,
  initialFolderId,
  onClose,
  projectName,
  setProjectName,
  folderId,
  setFolderId,
  isHierarchical,
  setIsHierarchical,
  onSubmit,
  isPending,
}: NewProjectModalProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    if (initialFolderId) {
      setFolderId(initialFolderId);
    }
  }, [initialFolderId, setFolderId]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSubmit();
  };

  return (
    <dialog
      className={styles.modalOverlay}
      open
      aria-label="Add project"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add project</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.fieldLabel} htmlFor="project-name">
            Name
            <span className={styles.required}> · Required</span>
          </label>
          <input
            ref={nameInputRef}
            id="project-name"
            className={styles.fieldInput}
            placeholder="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-required="true"
            maxLength={80}
          />

          <label className={styles.fieldLabel} htmlFor="project-folder">
            Folder (optional)
          </label>
          <select
            id="project-folder"
            className={styles.fieldSelect}
            value={folderId ?? ''}
            onChange={(e) => setFolderId((e.target.value as unknown as FolderId) || null)}
          >
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <div className={styles.toggleRow}>
            <label htmlFor="project-hierarchical" className={styles.fieldLabel}>
              Use Epic / Feature / Task hierarchy
            </label>
            <input
              type="checkbox"
              id="project-hierarchical"
              checked={isHierarchical}
              onChange={(e) => setIsHierarchical(e.target.checked)}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onSubmit}
            disabled={!projectName.trim() || isPending}
          >
            Create project
          </button>
        </div>
      </div>
    </dialog>
  );
}
