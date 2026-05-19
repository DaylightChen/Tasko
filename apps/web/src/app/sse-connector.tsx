import { getTabId } from '@/api/client';
import { createSSEClient } from '@/api/events';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function SSEConnector(): null {
  const queryClient = useQueryClient();
  useEffect(() => {
    const tabId = getTabId();
    const close = createSSEClient(tabId, queryClient);
    return close;
  }, [queryClient]);
  return null;
}
