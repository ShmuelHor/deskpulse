import { layoutFitsPage } from '@deskpulse/shared/layouts/layout';
import { ValidationError } from '../../core/errors.js';
import { defineHandlers } from '../../core/route-handler.js';
import { visibleLayout } from './visible-layout.js';

/** The layouts domain: one saved widget layout per page, in the gateway's own settings. */
export const handlers = defineHandlers({
  getLayout: async ({ params, settings }) => {
    const stored = await settings.readLayout(params.page);
    return stored === null ? null : visibleLayout(stored, params.page);
  },
  saveLayout: async ({ params, body, settings }) => {
    if (!layoutFitsPage(body, params.page)) {
      throw new ValidationError([
        { path: 'widgets', message: 'a widget is not offered on this page' },
      ]);
    }
    await settings.writeLayout(params.page, body);
    return body;
  },
  resetLayout: async ({ params, settings }) => {
    await settings.deleteLayout(params.page);
    return undefined;
  },
});
