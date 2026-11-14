// @vitest-environment happy-dom

import { responseFixtures } from '@deskpulse/shared/fixtures/responses';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GatewayClient } from '../../../src/api/gateway.js';
import { createQueryClient } from '../../../src/app/query-client.js';
import { bundledResources } from '../../../src/i18n/bundled.js';
import { createI18n } from '../../../src/i18n/i18n.js';
import { AppsPage } from '../../../src/pages/apps/apps-page.js';
import { fakeNotifier } from '../../support/fake-notifier.js';
import { renderWithTheme } from '../../support/render-with-theme.js';

type Answer = unknown;

/** The app's query client retries a failed read once, after a backoff. */
const RETRY_TIMEOUT_MS = 5000;
/** Dialogs with a data grid behind them are slow to drive in happy-dom, more so when the whole suite runs. */
const DIALOG_TIMEOUT_MS = 30_000;

function clientAnswering(overrides: Record<string, Answer> = {}): {
  client: GatewayClient;
  request: ReturnType<typeof vi.fn>;
} {
  const answers: Record<string, Answer> = {
    listApps: structuredClone(responseFixtures.listApps),
    updateApp: structuredClone(responseFixtures.updateApp),
    ...overrides,
  };
  const request = vi.fn((name: string) => {
    const answer = answers[name];
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  });
  return { client: { request } as unknown as GatewayClient, request };
}

function renderPage(client: GatewayClient): ReturnType<typeof fakeNotifier> {
  const notifier = fakeNotifier();
  const i18n = createI18n(bundledResources, document.createElement('html'));
  void i18n.changeLanguage('en');
  renderWithTheme(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={createQueryClient(notifier)}>
        <AppsPage client={client} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return notifier;
}

afterEach(cleanup);

describe('Apps page', { timeout: DIALOG_TIMEOUT_MS }, () => {
  it('shows skeletons while the requests are pending', () => {
    renderPage({ request: () => new Promise(() => undefined) } as unknown as GatewayClient);

    expect(document.querySelector('[aria-busy]')).not.toBeNull();
  });

  it('lists the apps', async () => {
    const { client } = clientAnswering();
    renderPage(client);

    const apps = await screen.findByRole('grid', { name: 'Your apps' });
    expect(within(apps).getByText('Firefox')).toBeTruthy();
  });

  it('shows an error when the gateway cannot be reached', async () => {
    const { client } = clientAnswering({ listApps: new Error('down') });
    renderPage(client);

    expect(
      await screen.findByText('Apps could not be loaded.', undefined, {
        timeout: RETRY_TIMEOUT_MS,
      }),
    ).toBeTruthy();
  });

  it('renders an app name with markup in it as plain text', async () => {
    const name = '<img src=x onerror="alert(1)">';
    const { client } = clientAnswering({
      listApps: { items: [{ id: 'evil', name, icon: null }] },
    });
    renderPage(client);

    const apps = await screen.findByRole('grid', { name: 'Your apps' });
    expect(within(apps).getByText(name)).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
  });

  it('saves an edited app and announces it with a toast', async () => {
    const user = userEvent.setup();
    const { client, request } = clientAnswering();
    const notifier = renderPage(client);

    const apps = await screen.findByRole('grid', { name: 'Your apps' });
    const [edit] = within(apps).getAllByRole('button', { name: 'Edit' });
    if (edit === undefined) {
      throw new Error('no edit button');
    }
    await user.click(edit);
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(notifier.success).toHaveBeenCalledWith('apps:toast.appSaved'));
    expect(request).toHaveBeenCalledWith(
      'updateApp',
      expect.objectContaining({ body: expect.objectContaining({ name: 'Renamed' }) }),
    );
  });
});
