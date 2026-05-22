/**
 * Calendar filter state — URL search param helpers.
 *
 * Filter state lives in URL search params so the filter is preserved on refresh
 * and shareable:
 *   ?filter_project_id=<id>
 *   ?filter_tag_id=<id>
 *   ?show_completed=true
 *
 * Downstream (task-15 week view) shares this same filter model.
 */

export interface CalendarFilters {
  filter_project_id?: string;
  filter_tag_id?: string;
  show_completed: boolean;
}

export const EMPTY_FILTERS: CalendarFilters = {
  show_completed: false,
};

/** Parse CalendarFilters from URLSearchParams. */
export function parseCalendarFilters(params: URLSearchParams): CalendarFilters {
  const f: CalendarFilters = { show_completed: params.get('show_completed') === 'true' };
  const projectId = params.get('filter_project_id');
  if (projectId) f.filter_project_id = projectId;
  const tagId = params.get('filter_tag_id');
  if (tagId) f.filter_tag_id = tagId;
  return f;
}

/** Serialise CalendarFilters back to URLSearchParams. */
export function buildCalendarFilterParams(filters: CalendarFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.filter_project_id) params.set('filter_project_id', filters.filter_project_id);
  if (filters.filter_tag_id) params.set('filter_tag_id', filters.filter_tag_id);
  if (filters.show_completed) params.set('show_completed', 'true');
  return params;
}

/** Return the count of active filter chips. */
export function activeFilterCount(filters: CalendarFilters): number {
  let n = 0;
  if (filters.filter_project_id) n++;
  if (filters.filter_tag_id) n++;
  if (filters.show_completed) n++;
  return n;
}

/** Return CalendarFilters with one chip removed. */
export function removeFilter(filters: CalendarFilters, key: keyof CalendarFilters): CalendarFilters {
  if (key === 'show_completed') return { ...filters, show_completed: false };
  const next: CalendarFilters = { show_completed: filters.show_completed };
  if (key !== 'filter_project_id' && filters.filter_project_id) {
    next.filter_project_id = filters.filter_project_id;
  }
  if (key !== 'filter_tag_id' && filters.filter_tag_id) {
    next.filter_tag_id = filters.filter_tag_id;
  }
  return next;
}
