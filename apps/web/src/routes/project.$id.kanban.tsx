import { createFileRoute } from '@tanstack/react-router';
import type { ProjectId } from '@tasko/types';
import { KanbanView } from '../views/project-view/kanban-view';

export const Route = createFileRoute('/project/$id/kanban')({
  component: ProjectKanbanPage,
});

function ProjectKanbanPage() {
  const { id } = Route.useParams();
  return <KanbanView projectId={id as ProjectId} />;
}
