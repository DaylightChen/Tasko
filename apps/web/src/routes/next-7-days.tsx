import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/next-7-days')({
  component: Next7DaysStub,
});

function Next7DaysStub() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Next 7 Days</h1>
      <p>Coming soon</p>
    </div>
  );
}
