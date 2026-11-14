import { layoutFixture } from '@deskpulse/shared/fixtures/data';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { toHandlerMap } from '../../../src/core/route-handler.js';
import { handlers } from '../../../src/routes/layouts/index.js';
import { testGateway, webSession } from '../../gateway-harness.js';
import { GATEWAY_HOST, STATUS } from '../../harness.js';
import { memorySettings } from '../../memory-settings.js';

const JSON_HEADERS = { 'content-type': 'application/json' };
const URL = '/v1/layouts/control';

describe('layout routes', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function start(
    settings = memorySettings(),
  ): Promise<{ gateway: FastifyInstance; headers: Record<string, string> }> {
    app = await testGateway({ handlers: toHandlerMap(handlers), settings });
    const { headers } = await webSession(app);
    return { gateway: app, headers: { ...headers } };
  }

  it('answers null for a page the user never arranged', async () => {
    const { gateway, headers } = await start();

    const response = await gateway.inject({ method: 'GET', url: URL, headers });

    expect(response.statusCode).toBe(STATUS.OK);
    expect(response.json()).toBeNull();
  });

  it('saves a layout and reads it back, per page', async () => {
    const { gateway, headers } = await start();

    const save = await gateway.inject({
      method: 'PUT',
      url: URL,
      headers: { ...headers, ...JSON_HEADERS },
      payload: layoutFixture,
    });
    const read = await gateway.inject({ method: 'GET', url: URL, headers });
    const other = await gateway.inject({ method: 'GET', url: '/v1/layouts/time', headers });

    expect(save.statusCode).toBe(STATUS.OK);
    expect(read.json()).toEqual(layoutFixture);
    expect(other.json()).toBeNull();
  });

  it('drops widgets it does not know when reading', async () => {
    const settings = memorySettings();
    await settings.writeLayout('control', {
      version: 1,
      widgets: [...layoutFixture.widgets, { id: 'from-the-future', w: 1, h: 1 }],
    });
    const { gateway, headers } = await start(settings);

    const response = await gateway.inject({ method: 'GET', url: URL, headers });

    expect(response.json()).toEqual(layoutFixture);
  });

  it('resets a page to its default by deleting the saved layout', async () => {
    const { gateway, headers } = await start();
    await gateway.inject({
      method: 'PUT',
      url: URL,
      headers: { ...headers, ...JSON_HEADERS },
      payload: layoutFixture,
    });

    const reset = await gateway.inject({ method: 'DELETE', url: URL, headers });
    const read = await gateway.inject({ method: 'GET', url: URL, headers });
    const again = await gateway.inject({ method: 'DELETE', url: URL, headers });

    expect(reset.statusCode).toBe(STATUS.NO_CONTENT);
    expect(read.json()).toBeNull();
    expect(again.statusCode).toBe(STATUS.NO_CONTENT);
  });

  it.each([
    ['an unknown widget', { version: 1, widgets: [{ id: 'nope', w: 1, h: 1 }] }],
    ['a widget of another page', { version: 1, widgets: [{ id: 'processes', w: 1, h: 1 }] }],
    ['an unknown field', { ...layoutFixture, extra: true }],
    ['a width of 5', { version: 1, widgets: [{ id: 'cpu', w: 5, h: 1 }] }],
  ])('refuses to save %s and stores nothing', async (_name, payload) => {
    const { gateway, headers } = await start();

    const save = await gateway.inject({
      method: 'PUT',
      url: URL,
      headers: { ...headers, ...JSON_HEADERS },
      payload,
    });
    const read = await gateway.inject({ method: 'GET', url: URL, headers });

    expect(save.statusCode).toBe(STATUS.BAD_REQUEST);
    expect(read.json()).toBeNull();
  });

  it('answers 400 for a page that does not exist', async () => {
    const { gateway, headers } = await start();

    const response = await gateway.inject({ method: 'GET', url: '/v1/layouts/settings', headers });

    expect(response.statusCode).toBe(STATUS.BAD_REQUEST);
  });

  it('needs a session', async () => {
    const { gateway } = await start();

    const response = await gateway.inject({
      method: 'GET',
      url: URL,
      headers: { host: GATEWAY_HOST },
    });

    expect(response.statusCode).toBe(STATUS.UNAUTHORIZED);
  });
});
