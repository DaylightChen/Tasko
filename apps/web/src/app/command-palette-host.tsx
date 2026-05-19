/**
 * CommandPaletteHost — renders the command palette singleton.
 * Replaces the task-04 skeleton stub.
 */
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useConfig, useUpdateConfig } from '../api/config';
import { CommandPalette } from '../components/command-palette';
import { useCommandPaletteStore } from '../store/command-palette';
import { useTaskModalStore } from '../store/task-modal';

export function CommandPaletteHost() {
  const { open, closePalette } = useCommandPaletteStore();
  const navigate = useNavigate();
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const taskModal = useTaskModalStore();

  const handleNavigate = useCallback(
    (path: string) => {
      void navigate({ to: path as '/' });
    },
    [navigate],
  );

  const handleOpenTaskModal = useCallback(() => {
    taskModal.openNew();
  }, [taskModal]);

  const handleOpenProjectModal = useCallback(() => {
    // Project creation modal lives in the Sidebar; dispatch a custom event
    // so the sidebar can open it from outside its own component tree.
    document.dispatchEvent(new CustomEvent('tasko:open-project-modal'));
  }, []);

  const handleOpenFolderModal = useCallback(() => {
    document.dispatchEvent(new CustomEvent('tasko:open-folder-modal'));
  }, []);

  const handleOpenSettings = useCallback(() => {
    void navigate({ to: '/settings' });
  }, [navigate]);

  const handleSwitchTheme = useCallback(
    (to: 'dark' | 'light') => {
      updateConfig.mutate({ theme: to });
    },
    [updateConfig],
  );

  if (!open) return null;

  return (
    <CommandPalette
      open={open}
      onClose={closePalette}
      navigate={handleNavigate}
      openTaskModal={handleOpenTaskModal}
      openProjectModal={handleOpenProjectModal}
      openFolderModal={handleOpenFolderModal}
      openSettings={handleOpenSettings}
      currentTheme={config?.theme ?? 'system'}
      switchTheme={handleSwitchTheme}
    />
  );
}
