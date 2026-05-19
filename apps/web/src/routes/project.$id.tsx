import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ProjectId } from '@tasko/types';
import { useProject } from '../api/projects';
import { FlatListView } from '../views/project-view/flat-list-view';
import { TreeView } from '../views/project-view/tree-view';

export const Route = createFileRoute('/project/$id')({
  component: ProjectView,
});

function ProjectView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { project, isLoading } = useProject(id);

  const handleNavigateKanban = () => {
    void navigate({ to: '/project/$id/kanban', params: { id } });
  };

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)' }} aria-busy="true">
        Loading…
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <h1>Project not found</h1>
        <p>The project with id "{id}" could not be found.</p>
      </div>
    );
  }

  if (project.is_hierarchical) {
    return (
      <TreeView
        projectId={project.id as ProjectId}
        projectName={project.name}
        onNavigateKanban={handleNavigateKanban}
      />
    );
  }

  return (
    <FlatListView
      projectId={project.id as ProjectId}
      projectName={project.name}
      onNavigateKanban={handleNavigateKanban}
    />
  );
}
