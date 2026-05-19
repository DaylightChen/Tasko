import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/project/$id/kanban')({
  component: ProjectKanbanStub,
});

function ProjectKanbanStub() {
  const { id } = Route.useParams();
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Kanban view</h1>
      <p style={{ color: 'var(--text-subtle)', marginTop: 'var(--space-2)' }}>
        Kanban will be available in task-15.
      </p>
      <Link to="/project/$id" params={{ id }} style={{ color: 'var(--accent)' }}>
        ← Back to project
      </Link>
    </div>
  );
}
