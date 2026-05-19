import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/today')({
  component: TodayStub,
});

function TodayStub() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Today</h1>
      <p>Coming soon</p>
    </div>
  );
}
