import { z } from 'zod';
import { AppId, EntityId, Label, Timestamp } from './common.js';
import { LIMITS } from './limits.js';

export const App = z.strictObject({
  id: AppId,
  name: Label,
  /** A freedesktop icon name, never a path or URL. */
  icon: z
    .string()
    .regex(/^[a-zA-Z0-9._-]{1,128}$/)
    .nullable(),
});
export type App = z.infer<typeof App>;

export const AppList = z.strictObject({ items: z.array(App).max(LIMITS.listSize) });
export type AppList = z.infer<typeof AppList>;

/** `PUT /v1/apps/:id`: the user renames an app. */
export const AppUpdate = z.strictObject({
  name: Label,
});
export type AppUpdate = z.infer<typeof AppUpdate>;

export const Session = z
  .strictObject({
    id: EntityId,
    appId: AppId,
    start: Timestamp,
    end: Timestamp,
  })
  .refine((s) => Date.parse(s.start) <= Date.parse(s.end), {
    message: 'start must not be after end',
  });
export type Session = z.infer<typeof Session>;
