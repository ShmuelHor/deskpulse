import type { App } from '@deskpulse/shared/sessions';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GatewayClient } from '../../api/gateway.js';
import { AppDialog } from './app-dialog.js';
import { AppsTable } from './apps-table.js';
import { useAppsMutations } from './mutations.js';
import { appsQuery } from './queries.js';

interface AppsPageProps {
  /** The router context's gateway client; tests inject a fake. */
  readonly client: GatewayClient;
}

const SKELETON_HEIGHT = 160;

/** The apps the agent has seen; the user can rename them. */
export function AppsPage({ client }: AppsPageProps): React.JSX.Element {
  const { t } = useTranslation('apps');
  const apps = useQuery(appsQuery(client));
  const mutations = useAppsMutations(client);
  const [editing, setEditing] = useState<App | undefined>(undefined);
  const close = (): void => setEditing(undefined);

  return (
    <Stack spacing={6}>
      <Typography variant="h1">{t('title')}</Typography>
      {apps.isError ? <Alert severity="error">{t('error')}</Alert> : null}
      {apps.isPending ? <Skeleton aria-busy variant="rounded" height={SKELETON_HEIGHT} /> : null}
      {apps.data === undefined ? null : (
        <Section title={t('apps.label')}>
          <AppsTable apps={apps.data.items} onEdit={(app): void => setEditing(app)} />
        </Section>
      )}
      {editing === undefined ? null : (
        <AppDialog
          app={editing}
          saving={mutations.updateApp.isPending}
          onClose={close}
          onSave={(body): void =>
            mutations.updateApp.mutate({ id: editing.id, body }, { onSuccess: close })
          }
        />
      )}
    </Stack>
  );
}

interface SectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

function Section({ title, children }: SectionProps): React.JSX.Element {
  return (
    <Stack component="section" spacing={3} aria-label={title}>
      <Typography variant="h2">{title}</Typography>
      {children}
    </Stack>
  );
}
