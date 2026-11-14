import type { App, AppUpdate } from '@deskpulse/shared/sessions';
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';

import type { GatewayClient } from '../../api/gateway.js';

/**
 * Renaming an app changes how it is shown, so the app list is refreshed after a write.
 */
const AFFECTED_QUERIES = ['listApps'] as const;

interface AppChange {
  readonly id: string;
  readonly body: AppUpdate;
}

export interface AppsMutations {
  readonly updateApp: UseMutationResult<App, Error, AppChange>;
}

/** Every write of the Apps page. Each one announces its success with a toast (`meta.successMessage`). */
export function useAppsMutations(client: GatewayClient): AppsMutations {
  const queryClient = useQueryClient();
  const refresh = async (): Promise<void> => {
    await Promise.all(
      AFFECTED_QUERIES.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    );
  };

  const updateApp = useMutation({
    mutationFn: ({ id, body }: AppChange) => client.request('updateApp', { params: { id }, body }),
    meta: { successMessage: 'apps:toast.appSaved' },
    onSuccess: refresh,
  });
  return { updateApp };
}
