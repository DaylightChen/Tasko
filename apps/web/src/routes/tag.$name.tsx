import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/tag/$name')({
  component: TagStub,
});

function TagStub() {
  const { name } = Route.useParams();
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1># {name}</h1>
      <p>Coming soon</p>
    </div>
  );
}
