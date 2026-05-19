/**
 * command-catalog.test.ts
 *
 * Verifies that buildStaticCommands covers every entry from microcopy §12.2
 * and that buildDynamicCommands generates project/tag navigation commands.
 *
 * This is the downstream-dependency guard: Task 20 E2E tests and the
 * command palette itself rely on every §12.2 command being present.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  type StaticCatalogActions,
  buildDynamicCommands,
  buildStaticCommands,
} from '../../app/command-catalog';

// Minimal action stubs
function makeActions(overrides: Partial<StaticCatalogActions> = {}): StaticCatalogActions {
  return {
    navigateTo: vi.fn(),
    openTaskModal: vi.fn(),
    openProjectModal: vi.fn(),
    openFolderModal: vi.fn(),
    toggleSidebar: vi.fn(),
    showShortcutHelp: vi.fn(),
    openSettings: vi.fn(),
    switchTheme: vi.fn(),
    currentTheme: 'system',
    ...overrides,
  };
}

describe('buildStaticCommands — microcopy §12.2 coverage', () => {
  it('includes all static navigate commands', () => {
    const cmds = buildStaticCommands(makeActions());
    const labels = cmds.map((c) => c.label);

    // §12.2 static navigate entries
    expect(labels).toContain('Go to Today');
    expect(labels).toContain('Go to Tomorrow');
    expect(labels).toContain('Go to Next 7 Days');
    expect(labels).toContain('Go to Inbox');
    expect(labels).toContain('Go to Calendar');
    expect(labels).toContain('Go to All');
    expect(labels).toContain('Go to Completed');
    expect(labels).toContain('Go to Trash');
  });

  it('includes all static create commands', () => {
    const cmds = buildStaticCommands(makeActions());
    const labels = cmds.map((c) => c.label);

    // §12.2 create entries
    expect(labels).toContain('Add task');
    expect(labels).toContain('Add project');
    expect(labels).toContain('New folder');
  });

  it('includes static view commands', () => {
    const cmds = buildStaticCommands(makeActions());
    const labels = cmds.map((c) => c.label);

    expect(labels).toContain('Toggle sidebar');
    expect(labels).toContain('View keyboard shortcuts');
  });

  it('includes settings commands', () => {
    const cmds = buildStaticCommands(makeActions());
    const labels = cmds.map((c) => c.label);

    // Microcopy §12.2: "Open settings" command visible label is "Settings"
    expect(labels).toContain('Settings');
    // Theme toggle — either dark or light depending on currentTheme
    const themeCmd = cmds.find((c) => c.label.startsWith('Switch theme to'));
    expect(themeCmd).toBeDefined();
  });

  it('theme label is "Switch theme to dark" when currentTheme is "light"', () => {
    const cmds = buildStaticCommands(makeActions({ currentTheme: 'light' }));
    expect(cmds.find((c) => c.label === 'Switch theme to dark')).toBeDefined();
  });

  it('theme label is "Switch theme to light" when currentTheme is "dark"', () => {
    const cmds = buildStaticCommands(makeActions({ currentTheme: 'dark' }));
    expect(cmds.find((c) => c.label === 'Switch theme to light')).toBeDefined();
  });

  it('includes optional "Show completed" / "Hide completed" when toggleShowCompleted provided', () => {
    const toggleShowCompleted = vi.fn();

    const showCmds = buildStaticCommands(makeActions({ showCompleted: false, toggleShowCompleted }));
    expect(showCmds.find((c) => c.label === 'Show completed')).toBeDefined();

    const hideCmds = buildStaticCommands(makeActions({ showCompleted: true, toggleShowCompleted }));
    expect(hideCmds.find((c) => c.label === 'Hide completed')).toBeDefined();
  });

  it('includes sort commands when setSortBy provided', () => {
    const setSortBy = vi.fn();
    const cmds = buildStaticCommands(makeActions({ setSortBy }));
    const labels = cmds.map((c) => c.label);

    expect(labels).toContain('Sort by priority');
    expect(labels).toContain('Sort by due date');
    expect(labels).toContain('Sort by title');
  });

  it('does NOT include sort commands when setSortBy is not provided', () => {
    const cmds = buildStaticCommands(makeActions());
    const labels = cmds.map((c) => c.label);

    expect(labels).not.toContain('Sort by priority');
    expect(labels).not.toContain('Sort by due date');
    expect(labels).not.toContain('Sort by title');
  });

  it('commands have correct categories', () => {
    const cmds = buildStaticCommands(makeActions());
    const byId = Object.fromEntries(cmds.map((c) => [c.id, c]));

    expect(byId['nav-today']?.category).toBe('navigate');
    expect(byId['nav-inbox']?.category).toBe('navigate');
    expect(byId['create-task']?.category).toBe('create');
    expect(byId['create-project']?.category).toBe('create');
    expect(byId['create-folder']?.category).toBe('create');
    expect(byId['view-toggle-sidebar']?.category).toBe('view');
    expect(byId['view-keyboard-shortcuts']?.category).toBe('view');
    expect(byId['settings-open']?.category).toBe('settings');
    expect(byId['settings-theme']?.category).toBe('settings');
  });

  it('"Go to Today" has shortcut hint "T"', () => {
    const cmds = buildStaticCommands(makeActions());
    const today = cmds.find((c) => c.id === 'nav-today');
    expect(today?.shortcut).toBe('T');
  });

  it('"Go to Inbox" has shortcut hint "I"', () => {
    const cmds = buildStaticCommands(makeActions());
    const inbox = cmds.find((c) => c.id === 'nav-inbox');
    expect(inbox?.shortcut).toBe('I');
  });

  it('"Add task" has shortcut hint "N"', () => {
    const cmds = buildStaticCommands(makeActions());
    const addTask = cmds.find((c) => c.id === 'create-task');
    expect(addTask?.shortcut).toBe('N');
  });

  it('"View keyboard shortcuts" has shortcut hint "?"', () => {
    const cmds = buildStaticCommands(makeActions());
    const help = cmds.find((c) => c.id === 'view-keyboard-shortcuts');
    expect(help?.shortcut).toBe('?');
  });

  it('calling "Go to Today" action invokes navigateTo with "/today"', () => {
    const navigateTo = vi.fn();
    const cmds = buildStaticCommands(makeActions({ navigateTo }));
    const today = cmds.find((c) => c.id === 'nav-today');
    today?.action();
    expect(navigateTo).toHaveBeenCalledWith('/today');
  });

  it('calling "Go to Inbox" action invokes navigateTo with "/inbox"', () => {
    const navigateTo = vi.fn();
    const cmds = buildStaticCommands(makeActions({ navigateTo }));
    const inbox = cmds.find((c) => c.id === 'nav-inbox');
    inbox?.action();
    expect(navigateTo).toHaveBeenCalledWith('/inbox');
  });

  it('calling "View keyboard shortcuts" action invokes showShortcutHelp', () => {
    const showShortcutHelp = vi.fn();
    const cmds = buildStaticCommands(makeActions({ showShortcutHelp }));
    const help = cmds.find((c) => c.id === 'view-keyboard-shortcuts');
    help?.action();
    expect(showShortcutHelp).toHaveBeenCalled();
  });
});

describe('buildDynamicCommands', () => {
  it('generates "Go to <Project name>" for each project', () => {
    const navigateTo = vi.fn();
    const cmds = buildDynamicCommands({
      projects: [
        { id: 'p1', name: 'Alpha Project' },
        { id: 'p2', name: 'Beta Project' },
      ],
      tags: [],
      navigateTo,
    });

    const labels = cmds.map((c) => c.label);
    expect(labels).toContain('Go to Alpha Project');
    expect(labels).toContain('Go to Beta Project');
  });

  it('generates "Go to #<tag name>" for each tag', () => {
    const navigateTo = vi.fn();
    const cmds = buildDynamicCommands({
      projects: [],
      tags: [
        { name: 'urgent', name_lower: 'urgent' },
        { name: 'Work', name_lower: 'work' },
      ],
      navigateTo,
    });

    const labels = cmds.map((c) => c.label);
    expect(labels).toContain('Go to #urgent');
    expect(labels).toContain('Go to #Work');
  });

  it('project command action navigates to /project/<id>', () => {
    const navigateTo = vi.fn();
    const cmds = buildDynamicCommands({
      projects: [{ id: 'proj42', name: 'My Project' }],
      tags: [],
      navigateTo,
    });
    const cmd = cmds.find((c) => c.id === 'nav-project-proj42');
    cmd?.action();
    expect(navigateTo).toHaveBeenCalledWith('/project/proj42');
  });

  it('tag command action navigates to /tag/<name_lower>', () => {
    const navigateTo = vi.fn();
    const cmds = buildDynamicCommands({
      projects: [],
      tags: [{ name: 'Urgent', name_lower: 'urgent' }],
      navigateTo,
    });
    const cmd = cmds.find((c) => c.id === 'nav-tag-urgent');
    cmd?.action();
    expect(navigateTo).toHaveBeenCalledWith('/tag/urgent');
  });

  it('generates "Move ... to..." command when focusedItemTitle is provided', () => {
    const navigateTo = vi.fn();
    const openMoveToPickerForFocused = vi.fn();
    const cmds = buildDynamicCommands({
      projects: [],
      tags: [],
      navigateTo,
      focusedItemTitle: 'My Important Task',
      openMoveToPickerForFocused,
    });

    const moveCmd = cmds.find((c) => c.id === 'focused-move-to');
    expect(moveCmd).toBeDefined();
    expect(moveCmd?.label).toBe('Move "My Important Task" to…');
    moveCmd?.action();
    expect(openMoveToPickerForFocused).toHaveBeenCalled();
  });

  it('does not generate move command when focusedItemTitle is absent', () => {
    const cmds = buildDynamicCommands({
      projects: [],
      tags: [],
      navigateTo: vi.fn(),
    });
    expect(cmds.find((c) => c.id === 'focused-move-to')).toBeUndefined();
  });

  it('returns empty array when no projects, tags, or context', () => {
    const cmds = buildDynamicCommands({
      projects: [],
      tags: [],
      navigateTo: vi.fn(),
    });
    expect(cmds).toHaveLength(0);
  });

  it('generates "Add Epic in <project>" when focusedTreeContext is a project', () => {
    const openNewItem = vi.fn();
    const cmds = buildDynamicCommands({
      projects: [],
      tags: [],
      navigateTo: vi.fn(),
      focusedTreeContext: { type: 'project', id: 'proj1', title: 'My Project' },
      openNewItem,
    });
    const cmd = cmds.find((c) => c.id === 'add-epic-in-focused');
    expect(cmd).toBeDefined();
    expect(cmd?.label).toBe('Add Epic in My Project');
    expect(cmd?.category).toBe('create');
    cmd?.action();
    expect(openNewItem).toHaveBeenCalledWith({ type: 'epic', initialProjectId: 'proj1' });
  });

  it('generates "Add Feature under <epic>" when focusedTreeContext is an epic', () => {
    const openNewItem = vi.fn();
    const cmds = buildDynamicCommands({
      projects: [],
      tags: [],
      navigateTo: vi.fn(),
      focusedTreeContext: { type: 'epic', id: 'epic1', title: 'My Epic' },
      openNewItem,
    });
    const cmd = cmds.find((c) => c.id === 'add-feature-in-focused');
    expect(cmd).toBeDefined();
    expect(cmd?.label).toBe('Add Feature under My Epic');
    cmd?.action();
    expect(openNewItem).toHaveBeenCalledWith({ type: 'feature', initialParentId: 'epic1' });
  });

  it('generates "Add Task under <feature>" when focusedTreeContext is a feature', () => {
    const openNewItem = vi.fn();
    const cmds = buildDynamicCommands({
      projects: [],
      tags: [],
      navigateTo: vi.fn(),
      focusedTreeContext: { type: 'feature', id: 'feat1', title: 'My Feature' },
      openNewItem,
    });
    const cmd = cmds.find((c) => c.id === 'add-task-in-focused');
    expect(cmd).toBeDefined();
    expect(cmd?.label).toBe('Add Task under My Feature');
    cmd?.action();
    expect(openNewItem).toHaveBeenCalledWith({ type: 'task', initialParentId: 'feat1' });
  });

  it('does not generate tree-context commands when openNewItem is absent', () => {
    const cmds = buildDynamicCommands({
      projects: [],
      tags: [],
      navigateTo: vi.fn(),
      focusedTreeContext: { type: 'project', id: 'proj1', title: 'My Project' },
      // openNewItem intentionally omitted
    });
    expect(cmds.find((c) => c.id === 'add-epic-in-focused')).toBeUndefined();
  });
});
