import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/inbox')({
  component: InboxStub,
});

function InboxStub() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Inbox</h1>
      <p>Coming soon</p>
    </div>
  );
}
