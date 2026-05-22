import { createFileRoute } from '@tanstack/react-router';
import { SettingsView } from '../views/settings-view';

export const Route = createFileRoute('/settings')({
  component: SettingsView,
});
