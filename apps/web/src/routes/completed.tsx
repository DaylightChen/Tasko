import { createFileRoute } from '@tanstack/react-router';
import { CompletedView } from '../views/completed-view';

export const Route = createFileRoute('/completed')({
  component: CompletedView,
});
