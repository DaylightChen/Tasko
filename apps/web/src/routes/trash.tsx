import { createFileRoute } from '@tanstack/react-router';
import { TrashView } from '../views/trash-view';

export const Route = createFileRoute('/trash')({
  component: TrashView,
});
