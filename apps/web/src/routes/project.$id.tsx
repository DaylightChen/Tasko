import { Outlet, createFileRoute } from '@tanstack/react-router';

// Layout route for /project/$id. The default (TreeView / FlatListView) lives
// in project.$id.index.tsx; the kanban sub-route lives in project.$id.kanban.tsx.
// Previously this file rendered the default view directly, with no <Outlet />,
// so /project/$id/kanban silently fell back to the tree/flat list and the
// kanban route never actually mounted.
export const Route = createFileRoute('/project/$id')({
  component: () => <Outlet />,
});
