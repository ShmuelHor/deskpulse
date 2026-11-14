import { defineHandlers } from '../../core/route-handler.js';
import { appHandlers } from './apps.js';

/** The apps domain: the apps the sessions service has seen. */
export const handlers = defineHandlers(appHandlers);
