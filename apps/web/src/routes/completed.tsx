import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/completed')({
  component: CompletedStub,
});

function CompletedStub() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Completed</h1>
      <p>Coming soon</p>
    </div>
  );
}
