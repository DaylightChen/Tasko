/**
 * CommandPalette — full implementation using cmdk.
 *
 * Opens via ⌘K. Pushes 'command-palette' mode on mount; pops on unmount.
 * Recent commands persisted to localStorage under 'tasko.command.recent'.
 *
 * ARIA: cmdk automatically applies combobox + listbox roles per §3.10.
 */
import { Command } from 'cmdk';
import { Command as CommandIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useProjects } from '../../api/projects';
import { useTags } from '../../api/tags';
import type { StaticCatalogActions } from '../../app/command-catalog';
import {
  type CommandEntry,
  addRecentCommandId,
  buildDynamicCommands,
  buildStaticCommands,
  getRecentCommandIds,
} from '../../app/command-catalog';
import { useHotkeyStore } from '../../store/hotkey-registry';
import { useShortcutHelpStore } from '../../store/shortcut-help';
import { useSidebarStore } from '../../store/sidebar';
import styles from './styles.module.css';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  navigate: (path: string) => void;
  openTaskModal: () => void;
  openProjectModal: () => void;
  openFolderModal: () => void;
  openSettings: () => void;
  currentTheme: 'light' | 'dark' | 'system';
  switchTheme: (to: 'dark' | 'light') => void;
}

export function CommandPalette({
  open,
  onClose,
  navigate,
  openTaskModal,
  openProjectModal,
  openFolderModal,
  openSettings,
  currentTheme,
  switchTheme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: projectsData } = useProjects();
  const { data: tagsData } = useTags();
  const sidebar = useSidebarStore();
  const shortcutHelp = useShortcutHelpStore();

  const projects = projectsData?.projects ?? [];
  const tags = tagsData?.tags ?? [];

  // task-18: hotkey mode
  useEffect(() => {
    if (!open) return;
    useHotkeyStore.getState().push('command-palette');
    return () => {
      useHotkeyStore.getState().pop();
    };
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const closeAndRun = useCallback(
    (entry: CommandEntry) => {
      addRecentCommandId(entry.id);
      onClose();
      // slight defer so the palette closes before the action fires
      setTimeout(() => entry.action(), 0);
    },
    [onClose],
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Escape is a top-level concern: use a document capture-phase listener so it
  // works regardless of which element currently has focus.
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, handleClose]);

  const staticActions: StaticCatalogActions = useMemo(
    () => ({
      navigateTo: navigate,
      openTaskModal,
      openProjectModal,
      openFolderModal,
      toggleSidebar: sidebar.toggle,
      showShortcutHelp: () => {
        shortcutHelp.show();
      },
      openSettings,
      switchTheme,
      currentTheme,
    }),
    [
      navigate,
      openTaskModal,
      openProjectModal,
      openFolderModal,
      sidebar.toggle,
      shortcutHelp,
      openSettings,
      switchTheme,
      currentTheme,
    ],
  );

  const staticCommands = useMemo(() => buildStaticCommands(staticActions), [staticActions]);

  const dynamicCommands = useMemo(
    () =>
      buildDynamicCommands({
        projects: projects.filter((p) => !p.is_inbox),
        tags,
        navigateTo: navigate,
      }),
    [projects, tags, navigate],
  );

  const allCommands = useMemo(
    () => [...staticCommands, ...dynamicCommands],
    [staticCommands, dynamicCommands],
  );

  const recentIds = useMemo(() => getRecentCommandIds(), []);
  const recentCommands = useMemo(
    () =>
      recentIds
        .map((id) => allCommands.find((c) => c.id === id))
        .filter((c): c is CommandEntry => c !== undefined),
    [recentIds, allCommands],
  );

  const navigateCommands = useMemo(() => allCommands.filter((c) => c.category === 'navigate'), [allCommands]);
  const createCommands = useMemo(() => allCommands.filter((c) => c.category === 'create'), [allCommands]);
  const viewCommands = useMemo(() => allCommands.filter((c) => c.category === 'view'), [allCommands]);
  const settingsCommands = useMemo(() => allCommands.filter((c) => c.category === 'settings'), [allCommands]);

  if (!open) return null;

  const curated = [
    allCommands.find((c) => c.id === 'nav-today'),
    allCommands.find((c) => c.id === 'nav-inbox'),
    allCommands.find((c) => c.id === 'create-task'),
    allCommands.find((c) => c.id === 'create-project'),
    allCommands.find((c) => c.id === 'settings-open'),
    allCommands.find((c) => c.id === 'view-keyboard-shortcuts'),
  ].filter((c): c is CommandEntry => c !== undefined);

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard dismissal is handled via document-level Escape listener above (palette is non-modal; backdrop click is mouse-only sugar).
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <dialog className={styles.dialog} aria-label="Command palette" aria-modal="true" open>
        <Command className={styles.command} label="Command palette">
          <div className={styles.inputRow}>
            <CommandIcon size={18} className={styles.searchIcon} aria-hidden="true" />
            <Command.Input
              ref={inputRef}
              className={styles.input}
              placeholder="Type a command…"
              value={query}
              onValueChange={setQuery}
              aria-label="Type a command"
            />
          </div>

          <Command.List className={styles.list}>
            <Command.Empty className={styles.empty}>
              No matching commands. Try a different word.
            </Command.Empty>

            {/* Initial state (no query): recent + curated */}
            {!query && recentCommands.length > 0 && (
              <Command.Group heading="Recent" className={styles.groupHeading}>
                {recentCommands.map((entry) => (
                  <CommandItem key={entry.id} entry={entry} onSelect={closeAndRun} />
                ))}
              </Command.Group>
            )}

            {!query && (
              <Command.Group heading="Navigate" className={styles.groupHeading}>
                {curated
                  .filter((c) => c.category === 'navigate')
                  .map((entry) => (
                    <CommandItem key={entry.id} entry={entry} onSelect={closeAndRun} />
                  ))}
              </Command.Group>
            )}

            {!query && (
              <Command.Group heading="Create" className={styles.groupHeading}>
                {curated
                  .filter((c) => c.category === 'create')
                  .map((entry) => (
                    <CommandItem key={entry.id} entry={entry} onSelect={closeAndRun} />
                  ))}
              </Command.Group>
            )}

            {!query && (
              <Command.Group heading="View" className={styles.groupHeading}>
                {curated
                  .filter((c) => c.category === 'view')
                  .map((entry) => (
                    <CommandItem key={entry.id} entry={entry} onSelect={closeAndRun} />
                  ))}
              </Command.Group>
            )}

            {!query && (
              <Command.Group heading="Settings" className={styles.groupHeading}>
                {curated
                  .filter((c) => c.category === 'settings')
                  .map((entry) => (
                    <CommandItem key={entry.id} entry={entry} onSelect={closeAndRun} />
                  ))}
              </Command.Group>
            )}

            {/* Filtered state: show all matching commands grouped */}
            {query && (
              <>
                <Command.Group heading="Navigate" className={styles.groupHeading}>
                  {navigateCommands.map((entry) => (
                    <CommandItem key={entry.id} entry={entry} onSelect={closeAndRun} />
                  ))}
                </Command.Group>
                <Command.Group heading="Create" className={styles.groupHeading}>
                  {createCommands.map((entry) => (
                    <CommandItem key={entry.id} entry={entry} onSelect={closeAndRun} />
                  ))}
                </Command.Group>
                <Command.Group heading="View" className={styles.groupHeading}>
                  {viewCommands.map((entry) => (
                    <CommandItem key={entry.id} entry={entry} onSelect={closeAndRun} />
                  ))}
                </Command.Group>
                <Command.Group heading="Settings" className={styles.groupHeading}>
                  {settingsCommands.map((entry) => (
                    <CommandItem key={entry.id} entry={entry} onSelect={closeAndRun} />
                  ))}
                </Command.Group>
              </>
            )}
          </Command.List>
        </Command>
      </dialog>
    </div>,
    document.body,
  );
}

// ─── CommandItem ──────────────────────────────────────────────────────────────

interface CommandItemProps {
  entry: CommandEntry;
  onSelect: (entry: CommandEntry) => void;
}

function CommandItem({ entry, onSelect }: CommandItemProps) {
  return (
    <Command.Item
      className={styles.item}
      value={[entry.label, ...(entry.keywords ?? [])].join(' ')}
      onSelect={() => onSelect(entry)}
    >
      {entry.icon && <entry.icon size={16} className={styles.itemIcon} aria-hidden="true" />}
      <span className={styles.itemLabel}>{entry.label}</span>
      {entry.shortcut && <kbd className={styles.shortcutChip}>{entry.shortcut}</kbd>}
    </Command.Item>
  );
}
