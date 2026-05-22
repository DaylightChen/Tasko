import { createFileRoute } from '@tanstack/react-router';
import { CalendarWeekView } from '../views/calendar-view/week';

export const Route = createFileRoute('/calendar/week')({
  component: CalendarWeekView,
});
