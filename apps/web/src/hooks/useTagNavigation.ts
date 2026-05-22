import { useNavigate } from '@tanstack/react-router';
import type { TagId } from '@tasko/types';
import { useTags } from '../api/tags';

/**
 * Returns a tag-click handler that resolves a TagId to its name_lower and
 * navigates to the per-tag view at /tag/$name.
 *
 * Used by every flat-list view (Today, Inbox, All, Tag, Completed, etc.)
 * to wire TaskListRow's onTagClick prop.
 */
export function useTagNavigation(): (tagId: TagId) => void {
  const navigate = useNavigate();
  const { data: tagsData } = useTags();

  return (tagId: TagId) => {
    const tags = tagsData?.tags ?? [];
    const tag = tags.find((t) => t.id === tagId);
    if (tag) {
      void navigate({ to: '/tag/$name', params: { name: tag.name_lower } });
    }
  };
}
