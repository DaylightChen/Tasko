import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id')({
  component: ProjectStub,
});

function ProjectStub() {
  const { id } = Route.useParams();
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Project</h1>
      <p>Project ID: {id}</p>
      <p>Coming soon</p>
    </div>
  );
}
