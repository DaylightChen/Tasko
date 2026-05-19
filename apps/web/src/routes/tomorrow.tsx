import { createFileRoute } from '@tanstack/react-router';
import { TomorrowView } from '../views/tomorrow-view';

export const Route = createFileRoute('/tomorrow')({
  component: TomorrowView,
});
