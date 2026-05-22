import { createFileRoute } from '@tanstack/react-router';
import { TodayView } from '../views/today-view';

export const Route = createFileRoute('/today')({
  component: TodayView,
});
