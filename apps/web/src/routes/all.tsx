import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/all')({
  component: AllStub,
});

function AllStub() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>All</h1>
      <p>Coming soon</p>
    </div>
  );
}
