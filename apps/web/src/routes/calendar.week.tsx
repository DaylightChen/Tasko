import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/calendar/week')({
  component: CalendarWeekStub,
});

function CalendarWeekStub() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Calendar — Week</h1>
      <p>Coming soon</p>
    </div>
  );
}
