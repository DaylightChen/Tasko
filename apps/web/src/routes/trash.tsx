import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/trash')({
  component: TrashStub,
});

function TrashStub() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Trash</h1>
      <p>Coming soon</p>
    </div>
  );
}
