import { z } from 'zod';
import { LIMITS } from '../limits.js';
import { isWidgetOnPage, LayoutPage, WidgetId } from './widget-catalog.js';

/** The grid is 4 columns wide and a widget spans 1 to 4 columns and rows (DESIGN §6). */
export const GRID_COLUMNS = 4;
const MAX_SPAN = GRID_COLUMNS;
const MAX_WIDGETS = 40;
const MAX_OPTIONS = 8;
const OPTION_KEY = /^[a-z][a-zA-Z0-9-]{0,31}$/;
const VIEW_ID = /^[a-z][a-z0-9-]{0,31}$/;

export const LAYOUT_VERSION = 1;

const Span = z.number().int().min(1).max(MAX_SPAN);

/** A widget's options: a few named flags, numbers or short words (title, compact, ...). */
const WidgetOptions = z
  .record(
    z.string().regex(OPTION_KEY),
    z.union([
      z.boolean(),
      z.number().min(-LIMITS.bytes).max(LIMITS.bytes),
      z.string().max(LIMITS.paramKeyLength),
    ]),
  )
  .refine((options) => Object.keys(options).length <= MAX_OPTIONS, {
    message: `at most ${MAX_OPTIONS} options`,
  });

/** One tile; its place in `widgets` is its place on the grid. */
export const LayoutWidget = z.strictObject({
  id: WidgetId,
  w: Span,
  h: Span,
  /** `ring`, `bars`, `line`, `meter`, `number` or the widget's detail view; absent means its default. */
  view: z.string().regex(VIEW_ID).optional(),
  options: WidgetOptions.optional(),
});
export type LayoutWidget = z.infer<typeof LayoutWidget>;

/** A page's layout (SPEC §5 gateway): every widget at most once. */
export const Layout = z
  .strictObject({
    version: z.literal(LAYOUT_VERSION),
    widgets: z.array(LayoutWidget).max(MAX_WIDGETS),
  })
  .refine(
    (layout) => new Set(layout.widgets.map((widget) => widget.id)).size === layout.widgets.length,
    {
      message: 'a widget appears more than once',
      path: ['widgets'],
    },
  );
export type Layout = z.infer<typeof Layout>;

/**
 * What the store holds: the version and a bounded list that is not yet trusted, so a row
 * written by another version still parses and the reader can discard widgets this one lacks.
 */
export const StoredLayout = z.strictObject({
  version: z.literal(LAYOUT_VERSION),
  widgets: z.array(z.unknown()).max(MAX_WIDGETS),
});
export type StoredLayout = z.infer<typeof StoredLayout>;

/** Path parameter of `/v1/layouts/:page`. */
export const LayoutParams = z.strictObject({ page: LayoutPage });
export type LayoutParams = z.infer<typeof LayoutParams>;

/**
 * Whether every widget is in the page's catalog. A saved layout must pass; unlike a stored one
 * it is never silently trimmed, so the client learns about its mistake.
 */
export function layoutFitsPage(layout: Layout, page: LayoutPage): boolean {
  return layout.widgets.every((widget) => isWidgetOnPage(widget.id, page));
}
