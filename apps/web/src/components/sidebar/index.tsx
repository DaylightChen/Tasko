import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { FolderId, ProjectId } from '@tasko/types';
import {
  CalendarDays,
  CheckCircle2,
  Hash,
  Inbox,
  List,
  Plus,
  Settings as SettingsIcon,
  Sun,
  Sunrise,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useCreateFolder, useDeleteFolder, useFolders, usePatchFolder } from '../../api/folders';
import { useHealth } from '../../api/health.js';
import { useItems } from '../../api/items';
import { useCreateProject, useDeleteProject, usePatchProject, useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import { useSidebarStore } from '../../store/sidebar';
import { Button } from '../button';
import { ConfirmationPrompt } from '../confirmation-prompt';
import { Dropdown } from '../dropdown';
import { FolderHeader } from '../folder-header';
import { Modal } from '../modal';
import { ProjectRow } from '../project-row';
import { SidebarNavItem } from '../sidebar-nav-item';
import { SyncFooter } from '../sync-footer';
import { TextInput } from '../text-input';
import {
  SidebarDndContext,
  SortableFolder,
  SortableProject,
  TopLevelDropZone,
  useFolderDroppable,
} from './dnd';
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
  const { collapsed } = useSidebarStore();
  const { data: projectsData } = useProjects();
  const { data: foldersData } = useFolders();
  const { data: tagsData } = useTags();
  const { data: health } = useHealth();
  const { total: todayTotal, overdue: todayOverdue } = useTodayBadge();
  const { data: allItemsData } = useItems({ view: 'all' });

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
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{
    id: ProjectId;
    name: string;
    itemCount: number;
  } | null>(null);
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
  const navigate = useNavigate();

  const addMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const addProjectBtnRef = useRef<HTMLButtonElement>(null);

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

  const handleCloseModal = useCallback(() => {
    setNewProjectModal({ open: false, folderId: null });
    setNewProjectName('');
    setNewProjectFolderId(null);
    setNewProjectHierarchical(false);
  }, []);

  const projects = projectsData?.projects ?? [];
  const folders = foldersData?.folders ?? [];
  const tags = tagsData?.tags ?? [];

  const userProjects = projects.filter((p) => !p.is_inbox);
  const inboxProject = projects.find((p) => p.is_inbox);

  const sidebarRef = useRef<HTMLElement>(null);

  const isActive = (path: string) => currentPath === path;

  // Build folder options for Dropdown
  type FolderValue = string;
  const folderOptions: Array<{ value: FolderValue; label: string }> = [
    { value: '', label: 'No folder' },
    ...folders.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <nav
      ref={sidebarRef}
      className={styles.sidebar}
      aria-label="Primary navigation"
      data-collapsed={collapsed ? '' : undefined}
    >
      <div className={styles.logo}>Tasko</div>

      {/* Smart lists */}
      <ul className={styles.smartList}>
        <li>
          <SidebarNavItem
            to="/today"
            icon={Sun}
            label="Today"
            count={todayTotal > 0 ? todayTotal : undefined}
            overdueCount={todayOverdue > 0 ? todayOverdue : undefined}
            selected={isActive('/today') || isActive('/')}
          />
        </li>
        <li>
          <SidebarNavItem to="/tomorrow" icon={Sunrise} label="Tomorrow" selected={isActive('/tomorrow')} />
        </li>
        <li>
          <SidebarNavItem
            to="/next-7-days"
            icon={CalendarDays}
            label="Next 7 Days"
            selected={isActive('/next-7-days')}
          />
        </li>
        <li>
          <SidebarNavItem to="/inbox" icon={Inbox} label="Inbox" selected={isActive('/inbox')} />
        </li>
        <li>
          <SidebarNavItem to="/all" icon={List} label="All" selected={isActive('/all')} />
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
              ref={addProjectBtnRef}
              type="button"
              className={styles.addBtn}
              aria-label="Add project or folder"
              onClick={() => setShowAddMenu((v) => !v)}
              aria-expanded={showAddMenu}
            >
              <Plus size={14} aria-hidden="true" />
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

        <SidebarDndContext
          projects={userProjects}
          folders={folders}
          scrollContainerRef={sidebarRef as React.RefObject<HTMLElement>}
          onAutoExpandFolder={(folderId) =>
            setCollapsedFolders((prev) => {
              const next = new Set(prev);
              next.delete(folderId);
              return next;
            })
          }
        >
          <ul aria-labelledby="projects-heading" className={styles.projectList}>
            {/* Inbox row — not draggable */}
            {inboxProject && (
              <li>
                {renamingId === inboxProject.id ? (
                  <div className={styles.navItem}>
                    <RenameInput
                      value={renameValue}
                      onChange={setRenameValue}
                      onKeyDown={(e) => handleRename(e, 'project', inboxProject.id)}
                    />
                  </div>
                ) : (
                  <ProjectRow
                    id={inboxProject.id}
                    name={inboxProject.name}
                    selected={isActive('/inbox')}
                    color={inboxProject.color}
                    isInbox
                  />
                )}
              </li>
            )}

            {/* Folders with their projects */}
            {folders.map((folder) => {
              const folderProjects = userProjects
                .filter((p) => p.folder_id === folder.id)
                .sort((a, b) => a.sort_order - b.sort_order);
              const isCollapsed = collapsedFolders.has(folder.id);

              return (
                <li
                  key={folder.id}
                  onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id, folder.name)}
                >
                  <SortableFolder folderId={folder.id}>
                    <FolderDroppableHeader
                      folder={folder}
                      renamingId={renamingId}
                      renameValue={renameValue}
                      isCollapsed={isCollapsed}
                      onToggle={() =>
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
                      onRename={() => {
                        setRenamingId(folder.id);
                        setRenameValue(folder.name);
                        setContextMenu(null);
                      }}
                      onDelete={() => {
                        deleteFolder.mutate(folder.id as unknown as FolderId);
                      }}
                      onNewProject={() => {
                        setNewProjectModal({ open: true, folderId: folder.id as unknown as FolderId });
                      }}
                    />
                  </SortableFolder>

                  {!isCollapsed && (
                    <ul id={`folder-${folder.id}-list`} className={styles.folderProjects}>
                      {folderProjects.map((project) => (
                        <li
                          key={project.id}
                          onContextMenu={(e) => handleContextMenu(e, 'project', project.id, project.name)}
                        >
                          <SortableProject projectId={project.id}>
                            {renamingId === project.id ? (
                              <div className={styles.navItem}>
                                <RenameInput
                                  value={renameValue}
                                  onChange={setRenameValue}
                                  onKeyDown={(e) => handleRename(e, 'project', project.id)}
                                />
                              </div>
                            ) : (
                              <ProjectRow
                                id={project.id}
                                name={project.name}
                                selected={isActive(`/project/${project.id}`)}
                                color={project.color}
                              />
                            )}
                          </SortableProject>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}

            {/* Top-level drop zone (for dragging a project out of a folder) */}
            <li>
              <TopLevelDropZone />
            </li>

            {/* Projects without a folder */}
            {userProjects
              .filter((p) => p.folder_id === null)
              .map((project) => (
                <li
                  key={project.id}
                  onContextMenu={(e) => handleContextMenu(e, 'project', project.id, project.name)}
                >
                  <SortableProject projectId={project.id}>
                    {renamingId === project.id ? (
                      <div className={styles.navItem}>
                        <RenameInput
                          value={renameValue}
                          onChange={setRenameValue}
                          onKeyDown={(e) => handleRename(e, 'project', project.id)}
                        />
                      </div>
                    ) : (
                      <ProjectRow
                        id={project.id}
                        name={project.name}
                        selected={isActive(`/project/${project.id}`)}
                        color={project.color}
                      />
                    )}
                  </SortableProject>
                </li>
              ))}
          </ul>
        </SidebarDndContext>
      </div>

      {/* Tags section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle} id="tags-heading">
            TAGS
          </h2>
        </div>
        <ul aria-labelledby="tags-heading" className={styles.tagList}>
          {tags.map((tag) => (
            <li key={tag.id}>
              <SidebarNavItem
                to={`/tag/${tag.name_lower}`}
                icon={Hash}
                label={`# ${tag.name}`}
                selected={isActive(`/tag/${tag.name_lower}`)}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom links */}
      <ul className={styles.bottomLinks}>
        <li>
          <SidebarNavItem
            to="/calendar"
            icon={CalendarDays}
            label="Calendar"
            selected={currentPath.startsWith('/calendar')}
          />
        </li>
        <li>
          <SidebarNavItem
            to="/completed"
            icon={CheckCircle2}
            label="Completed"
            selected={isActive('/completed')}
          />
        </li>
        <li>
          <SidebarNavItem to="/trash" icon={Trash2} label="Trash" selected={isActive('/trash')} />
        </li>
        <li>
          <SidebarNavItem
            to="/settings"
            icon={SettingsIcon}
            label="Settings"
            selected={isActive('/settings')}
          />
        </li>
      </ul>

      {/* Static footer using SyncFooter component */}
      <SyncFooter dataDir={health?.data_dir} />

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
                  const projectId = contextMenu.id as unknown as ProjectId;
                  const activeItemCount = (allItemsData?.items ?? []).filter(
                    (i) => i.project_id === contextMenu.id && i.trashed_at === null,
                  ).length;
                  setDeleteProjectConfirm({
                    id: projectId,
                    name: contextMenu.name,
                    itemCount: activeItemCount,
                  });
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
      <NewProjectModal
        open={newProjectModal.open}
        folders={folders}
        initialFolderId={newProjectModal.folderId}
        onClose={handleCloseModal}
        projectName={newProjectName}
        setProjectName={setNewProjectName}
        folderId={newProjectFolderId}
        setFolderId={setNewProjectFolderId}
        isHierarchical={newProjectHierarchical}
        setIsHierarchical={setNewProjectHierarchical}
        onSubmit={handleCreateProject}
        isPending={createProject.isPending}
        folderOptions={folderOptions}
        returnFocusTo={addProjectBtnRef as React.RefObject<HTMLElement>}
      />

      {/* Delete Project Confirmation */}
      <ConfirmationPrompt
        open={deleteProjectConfirm !== null}
        onCancel={() => setDeleteProjectConfirm(null)}
        onConfirm={async () => {
          if (deleteProjectConfirm) {
            await deleteProject.mutateAsync(deleteProjectConfirm.id);
            setDeleteProjectConfirm(null);
            // Navigate to /today after project deletion per brief step 14
            void navigate({ to: '/today' });
          }
        }}
        title={`Delete project "${deleteProjectConfirm?.name ?? ''}"?`}
        body={`${deleteProjectConfirm?.itemCount ?? 0} active items will be moved to Trash. This cannot be undone in v1.`}
        confirmLabel="Delete project"
        destructive={true}
        isPending={deleteProject.isPending}
      />
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

// ─── FolderDroppableHeader ────────────────────────────────────────────────────

interface FolderDroppableHeaderProps {
  folder: { id: string; name: string };
  renamingId: string | null;
  renameValue: string;
  isCollapsed: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewProject: () => void;
}

function FolderDroppableHeader({
  folder,
  renamingId,
  renameValue,
  isCollapsed,
  onToggle,
  onRename,
  onDelete,
  onNewProject,
}: FolderDroppableHeaderProps) {
  const { setNodeRef, isOver } = useFolderDroppable(folder.id);

  return (
    <h2
      ref={setNodeRef}
      className={styles.folderHeaderWrapper}
      data-state={isOver ? 'drop-target' : undefined}
    >
      <FolderHeader
        name={renamingId === folder.id ? renameValue : folder.name}
        expanded={!isCollapsed}
        onToggle={onToggle}
        onRename={onRename}
        onDelete={onDelete}
        onNewProject={onNewProject}
        id={folder.id}
      />
    </h2>
  );
}

interface NewProjectModalProps {
  open: boolean;
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
  folderOptions: Array<{ value: string; label: string }>;
  returnFocusTo: React.RefObject<HTMLElement>;
}

function NewProjectModal({
  open,
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
  folderOptions,
  returnFocusTo,
}: NewProjectModalProps) {
  // Set initial folder id on open
  useEffect(() => {
    if (open && initialFolderId) {
      setFolderId(initialFolderId);
    }
  }, [open, initialFolderId, setFolderId]);

  const footer = (
    <>
      <Button variant="ghost" size="md" onClick={onClose}>
        Cancel
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={onSubmit}
        disabled={!projectName.trim()}
        isLoading={isPending}
      >
        Create project
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add project"
      maxWidth={480}
      footer={footer}
      returnFocusTo={returnFocusTo}
    >
      <div className={styles.modalFields}>
        <TextInput
          label="Name"
          placeholder="Project name"
          value={projectName}
          onChange={setProjectName}
          required
          autoFocus
          maxLength={80}
        />

        <div className={styles.fieldGroup}>
          {/* biome-ignore lint/a11y/noLabelWithoutControl: Dropdown's ariaLabel prop provides the accessible name; this is a visual label only */}
          <label className={styles.fieldLabel}>Folder (optional)</label>
          <Dropdown
            options={folderOptions}
            value={folderId ?? ''}
            onChange={(v) => setFolderId((v as unknown as FolderId) || null)}
            ariaLabel="Folder (optional)"
            placeholder="No folder"
          />
        </div>

        <div className={styles.toggleRow}>
          <label htmlFor="project-hierarchical-modal" className={styles.fieldLabel}>
            Use Epic / Feature / Task hierarchy
          </label>
          <input
            type="checkbox"
            id="project-hierarchical-modal"
            checked={isHierarchical}
            onChange={(e) => setIsHierarchical(e.target.checked)}
          />
        </div>
      </div>
    </Modal>
  );
}
