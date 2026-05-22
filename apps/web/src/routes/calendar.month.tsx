import { createFileRoute } from '@tanstack/react-router';
import { CalendarMonthView } from '../views/calendar-view/month';

export const Route = createFileRoute('/calendar/month')({
  component: CalendarMonthView,
});
