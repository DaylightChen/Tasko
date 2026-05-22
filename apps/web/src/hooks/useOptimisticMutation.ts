import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useSnackbarStore } from '../store/snackbar';
import type { SnackbarItem } from '../store/snackbar';
import { useUndoStore } from '../store/undo';
import type { UndoEntry } from '../store/undo';

export interface OptimisticMutationOpts<TInput, TOutput, TPrior> {
  mutationFn: (input: TInput) => Promise<TOutput>;
  /**
   * Apply the optimistic update to the query cache.
   * Returns a "prior" snapshot used for rollback.
   */
  buildOptimistic: (queryClient: QueryClient, input: TInput) => TPrior;
  /**
   * Build the undo entry that reverses the mutation.
   * Called in onMutate with the prior snapshot.
   */
  buildUndo: (input: TInput, prior: TPrior) => Omit<UndoEntry, 'id'>;
  /**
   * Build the snackbar to show on success.
   * Return null to show no snackbar.
   */
  buildSnackbar?: (output: TOutput, input: TInput) => Omit<SnackbarItem, 'id'> | null;
  /**
   * Called on success after the server responds.
   * Use to update the cache with server data.
   */
  onSuccess?: (output: TOutput, input: TInput, queryClient: QueryClient) => void;
  /**
   * Query keys to invalidate on success.
   */
  invalidate?: (queryClient: QueryClient, input: TInput) => void;
  /**
   * Optional error callback. Called after the error snackbar with the input and
   * prior cache snapshot, allowing callers to perform a cache rollback.
   * Per engineering spec §4.4 contract.
   */
  onError?: (input: TInput, prior: TPrior) => void;
}

export function useOptimisticMutation<TInput, TOutput, TPrior>(
  opts: OptimisticMutationOpts<TInput, TOutput, TPrior>,
): UseMutationResult<TOutput, Error, TInput, { prior: TPrior }> {
  const queryClient = useQueryClient();
  const snackbar = useSnackbarStore();
  const undo = useUndoStore();

  return useMutation<TOutput, Error, TInput, { prior: TPrior }>({
    mutationFn: opts.mutationFn,

    onMutate: async (input) => {
      const prior = opts.buildOptimistic(queryClient, input);
      const undoEntry = opts.buildUndo(input, prior);
      undo.push(undoEntry);
      return { prior };
    },

    onError: (_err, input, ctx) => {
      snackbar.show({ variant: 'error', text: "Couldn't save. Try again.", durationMs: 5000 });
      if (ctx) {
        opts.onError?.(input, ctx.prior);
      }
    },

    onSuccess: (output, input) => {
      opts.onSuccess?.(output, input, queryClient);
      opts.invalidate?.(queryClient, input);

      if (opts.buildSnackbar) {
        const item = opts.buildSnackbar(output, input);
        if (item) snackbar.show(item);
      }
    },
  });
}
