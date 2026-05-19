import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/tomorrow')({
  component: TomorrowStub,
});

function TomorrowStub() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Tomorrow</h1>
      <p>Coming soon</p>
    </div>
  );
}
