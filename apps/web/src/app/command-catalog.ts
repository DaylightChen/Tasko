/**
 * Command catalog — every entry that can appear in the command palette.
 *
 * Static commands come from microcopy §12.2.
 * Dynamic commands are generated at palette-open time from the caller.
 */
import type { LucideIcon } from 'lucide-react';

export type CommandCategory = 'navigate' | 'create' | 'view' | 'settings' | 'recent';

export interface CommandEntry {
  id: string;
  label: string;
  category: CommandCategory;
  keywords?: string[];
  shortcut?: string;
  icon?: LucideIcon;
  action: () => void;
}

/**
 * Build the static portion of the catalog.
 * Actions are injected by the caller so the catalog itself has no React dependencies.
 */
export interface StaticCatalogActions {
  navigateTo: (path: string) => void;
  openTaskModal: () => void;
  openProjectModal: () => void;
  openFolderModal: () => void;
  toggleSidebar: () => void;
  showShortcutHelp: () => void;
  openSettings: () => void;
  switchTheme: (to: 'dark' | 'light') => void;
  currentTheme: 'light' | 'dark' | 'system';
  showCompleted?: boolean;
  toggleShowCompleted?: () => void;
  setSortBy?: (sort: string) => void;
}

export function buildStaticCommands(actions: StaticCatalogActions): CommandEntry[] {
  const themeTarget = actions.currentTheme === 'dark' ? 'light' : 'dark';
  const themeLabel = themeTarget === 'dark' ? 'Switch theme to dark' : 'Switch theme to light';

  const cmds: CommandEntry[] = [
    // Navigate
    {
      id: 'nav-today',
      label: 'Go to Today',
      category: 'navigate',
      keywords: ['today', 'home'],
      shortcut: 'T',
      action: () => actions.navigateTo('/today'),
    },
    {
      id: 'nav-tomorrow',
      label: 'Go to Tomorrow',
      category: 'navigate',
      keywords: ['tomorrow'],
      action: () => actions.navigateTo('/tomorrow'),
    },
    {
      id: 'nav-next7',
      label: 'Go to Next 7 Days',
      category: 'navigate',
      keywords: ['week', 'next 7', 'next seven'],
      action: () => actions.navigateTo('/next-7-days'),
    },
    {
      id: 'nav-inbox',
      label: 'Go to Inbox',
      category: 'navigate',
      keywords: ['inbox', 'unfiled'],
      shortcut: 'I',
      action: () => actions.navigateTo('/inbox'),
    },
    {
      id: 'nav-calendar',
      label: 'Go to Calendar',
      category: 'navigate',
      keywords: ['calendar', 'month', 'week'],
      action: () => actions.navigateTo('/calendar'),
    },
    {
      id: 'nav-all',
      label: 'Go to All',
      category: 'navigate',
      keywords: ['all', 'everything'],
      action: () => actions.navigateTo('/all'),
    },
    {
      id: 'nav-completed',
      label: 'Go to Completed',
      category: 'navigate',
      keywords: ['done', 'completed', 'finished'],
      action: () => actions.navigateTo('/completed'),
    },
    {
      id: 'nav-trash',
      label: 'Go to Trash',
      category: 'navigate',
      keywords: ['trash', 'deleted'],
      action: () => actions.navigateTo('/trash'),
    },
    // Create
    {
      id: 'create-task',
      label: 'Add task',
      category: 'create',
      keywords: ['add', 'new', 'task', 'create'],
      shortcut: 'N',
      action: actions.openTaskModal,
    },
    {
      id: 'create-project',
      label: 'Add project',
      category: 'create',
      keywords: ['add', 'new', 'project', 'create'],
      action: actions.openProjectModal,
    },
    {
      id: 'create-folder',
      label: 'New folder',
      category: 'create',
      keywords: ['folder', 'new', 'group'],
      action: actions.openFolderModal,
    },
    // View
    {
      id: 'view-toggle-sidebar',
      label: 'Toggle sidebar',
      category: 'view',
      keywords: ['sidebar', 'collapse', 'expand', 'toggle'],
      shortcut: '⌘\\',
      action: actions.toggleSidebar,
    },
    {
      id: 'view-keyboard-shortcuts',
      label: 'View keyboard shortcuts',
      category: 'view',
      keywords: ['keyboard', 'shortcuts', 'hotkeys', 'help'],
      shortcut: '?',
      action: actions.showShortcutHelp,
    },
    // Settings
    {
      id: 'settings-open',
      label: 'Settings',
      category: 'settings',
      keywords: ['settings', 'preferences', 'config'],
      action: actions.openSettings,
    },
    {
      id: 'settings-theme',
      label: themeLabel,
      category: 'settings',
      keywords: ['theme', 'dark', 'light', 'mode'],
      action: () => actions.switchTheme(themeTarget),
    },
  ];

  // Optional: sort by / show-completed commands when in project view
  if (actions.toggleShowCompleted !== undefined) {
    const showLabel = actions.showCompleted ? 'Hide completed' : 'Show completed';
    cmds.push({
      id: 'view-toggle-completed',
      label: showLabel,
      category: 'view',
      keywords: ['completed', 'done', 'show', 'hide'],
      action: actions.toggleShowCompleted,
    });
  }

  if (actions.setSortBy !== undefined) {
    cmds.push(
      {
        id: 'sort-priority',
        label: 'Sort by priority',
        category: 'view',
        keywords: ['sort', 'priority'],
        action: () => actions.setSortBy?.('priority_desc'),
      },
      {
        id: 'sort-due',
        label: 'Sort by due date',
        category: 'view',
        keywords: ['sort', 'due', 'date'],
        action: () => actions.setSortBy?.('due_asc'),
      },
      {
        id: 'sort-title',
        label: 'Sort by title',
        category: 'view',
        keywords: ['sort', 'title', 'alphabetical'],
        action: () => actions.setSortBy?.('title_asc'),
      },
    );
  }

  return cmds;
}

export interface DynamicCatalogContext {
  projects: Array<{ id: string; name: string }>;
  tags: Array<{ name_lower: string; name: string }>;
  navigateTo: (path: string) => void;
  focusedItemTitle?: string;
  openMoveToPickerForFocused?: () => void;
  focusedTreeContext?: { type: 'project' | 'epic' | 'feature'; id: string; title: string };
  openNewItem?: (args: {
    type: 'epic' | 'feature' | 'task';
    initialProjectId?: string;
    initialParentId?: string;
  }) => void;
}

export function buildDynamicCommands(ctx: DynamicCatalogContext): CommandEntry[] {
  const cmds: CommandEntry[] = [];

  // Go to <Project>
  for (const project of ctx.projects) {
    cmds.push({
      id: `nav-project-${project.id}`,
      label: `Go to ${project.name}`,
      category: 'navigate',
      keywords: ['go', 'project', project.name.toLowerCase()],
      action: () => ctx.navigateTo(`/project/${project.id}`),
    });
  }

  // Go to #<tag>
  for (const tag of ctx.tags) {
    cmds.push({
      id: `nav-tag-${tag.name_lower}`,
      label: `Go to #${tag.name}`,
      category: 'navigate',
      keywords: ['go', 'tag', tag.name.toLowerCase()],
      action: () => ctx.navigateTo(`/tag/${tag.name_lower}`),
    });
  }

  // Tree-context dynamic commands
  if (ctx.focusedTreeContext && ctx.openNewItem) {
    const { type, id, title } = ctx.focusedTreeContext;
    const opener = ctx.openNewItem;

    if (type === 'project') {
      cmds.push({
        id: 'add-epic-in-focused',
        label: `Add Epic in ${title}`,
        category: 'create',
        keywords: ['add', 'epic', 'new', title.toLowerCase()],
        action: () => opener({ type: 'epic', initialProjectId: id }),
      });
    } else if (type === 'epic') {
      cmds.push({
        id: 'add-feature-in-focused',
        label: `Add Feature under ${title}`,
        category: 'create',
        keywords: ['add', 'feature', 'new', title.toLowerCase()],
        action: () => opener({ type: 'feature', initialParentId: id }),
      });
    } else if (type === 'feature') {
      cmds.push({
        id: 'add-task-in-focused',
        label: `Add Task under ${title}`,
        category: 'create',
        keywords: ['add', 'task', 'new', title.toLowerCase()],
        action: () => opener({ type: 'task', initialParentId: id }),
      });
    }
  }

  // Move focused item
  if (ctx.focusedItemTitle && ctx.openMoveToPickerForFocused) {
    const opener = ctx.openMoveToPickerForFocused;
    cmds.push({
      id: 'focused-move-to',
      label: `Move "${ctx.focusedItemTitle}" to…`,
      category: 'view',
      keywords: ['move', 'project', 'reparent'],
      shortcut: '⌘⇧M',
      action: opener,
    });
  }

  return cmds;
}

const RECENT_KEY = 'tasko.command.recent';
const MAX_RECENT = 5;

export function getRecentCommandIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function addRecentCommandId(id: string): void {
  try {
    const current = getRecentCommandIds().filter((x) => x !== id);
    const next = [id, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable
  }
}
