import { createFileRoute } from '@tanstack/react-router';
import { Next7DaysView } from '../views/next-7-view';

export const Route = createFileRoute('/next-7-days')({
  component: Next7DaysView,
});
