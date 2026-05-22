import { Link, createFileRoute } from '@tanstack/react-router';
import type { TagId } from '@tasko/types';
import { useTags } from '../api/tags';
import { TagView } from '../views/tag-view';

export const Route = createFileRoute('/tag/$name')({
  component: TagRoute,
});

function TagRoute() {
  const { name } = Route.useParams();
  const { data: tagsData, isLoading } = useTags();
  const tags = tagsData?.tags ?? [];
  const tag = tags.find((t) => t.name_lower === name);

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (!tag) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <h1>Tag not found.</h1>
        <p>
          The tag &quot;{name}&quot; does not exist or has no active items.{' '}
          <Link to="/today">Back to Today</Link>
        </p>
      </div>
    );
  }

  return <TagView tagId={tag.id as TagId} tagName={tag.name} />;
}
