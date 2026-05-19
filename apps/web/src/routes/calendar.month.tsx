import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/calendar/month')({
  component: CalendarMonthStub,
});

function CalendarMonthStub() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Calendar</h1>
      <p>Coming soon</p>
    </div>
  );
}
