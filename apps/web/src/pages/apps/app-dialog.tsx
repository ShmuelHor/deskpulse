import type { App } from '@deskpulse/shared/sessions';
import { AppUpdate } from '@deskpulse/shared/sessions';
import { zodResolver } from '@hookform/resolvers/zod';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { Button } from '../../components/button.js';
import { TextField } from './form-controls.js';

type AppFormInput = z.input<typeof AppUpdate>;
type AppFormOutput = z.output<typeof AppUpdate>;

interface AppDialogProps {
  readonly app: App;
  readonly saving: boolean;
  readonly onSave: (body: AppUpdate) => void;
  readonly onClose: () => void;
}

/** Renames an app. The name is untrusted text and is only ever rendered as text. */
export function AppDialog({ app, saving, onSave, onClose }: AppDialogProps): React.JSX.Element {
  const { t } = useTranslation('apps');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AppFormInput, unknown, AppFormOutput>({
    resolver: zodResolver(AppUpdate),
    defaultValues: { name: app.name },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={(event): void => void handleSubmit(onSave)(event)} noValidate>
        <DialogTitle>{t('appDialog.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={4} sx={{ paddingBlockStart: 2 }}>
            <TextField
              label={t('columns.name')}
              register={register('name')}
              error={errors.name === undefined ? undefined : t('form.invalidName')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('form.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {t('form.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
