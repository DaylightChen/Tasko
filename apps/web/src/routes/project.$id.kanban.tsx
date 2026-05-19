import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id/kanban')({
  component: ProjectKanbanStub,
});

function ProjectKanbanStub() {
  const { id } = Route.useParams();
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Project — Kanban</h1>
      <p>Project ID: {id}</p>
      <p>Coming soon</p>
    </div>
  );
}
