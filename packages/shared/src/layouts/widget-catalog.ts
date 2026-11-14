import { z } from 'zod';

/** The six pages that hold a widget grid. Settings has none (docs/DESIGN.md §6). */
export const LayoutPage = z.enum([
  'control',
  'performance',
  'time',
  'focus',
  'processes',
  'maintenance',
]);
export type LayoutPage = z.infer<typeof LayoutPage>;

const METRIC_PAGES = ['control', 'performance', 'processes', 'maintenance'] as const;
const LIST_PAGES = ['control', 'processes', 'maintenance'] as const;

/**
 * The widget catalog of docs/DESIGN.md §6: each widget ID and the pages whose "add" drawer
 * offers it. The gateway drops any stored ID that is not here, or not for the page.
 */
export const WIDGET_PAGES = {
  cpu: METRIC_PAGES,
  memory: METRIC_PAGES,
  disk: METRIC_PAGES,
  battery: METRIC_PAGES,
  network: ['control'],
  temperature: ['control', 'performance'],
  'load-today': ['control', 'performance'],
  'needs-attention': ['control'],
  'active-time': ['control', 'time', 'focus'],
  focus: ['control', 'focus'],
  docker: LIST_PAGES,
  updates: LIST_PAGES,
  status: LIST_PAGES,
  'week-by-day': ['time'],
  'by-app': ['time'],
  'focus-week': ['time'],
  'slowdowns-today': ['performance'],
  'heat-memory': ['performance'],
  'battery-detail': ['performance'],
  power: ['performance'],
  processes: ['processes'],
  'disk-space': ['maintenance'],
  cleanup: ['maintenance'],
  'update-details': ['maintenance'],
  'startup-apps': ['maintenance'],
  'start-focus': ['focus'],
  'last-focus': ['focus'],
  profiles: ['focus'],
  'held-alerts': ['focus'],
} as const satisfies Record<string, readonly LayoutPage[]>;

const WIDGET_IDS = Object.keys(WIDGET_PAGES) as [WidgetId, ...WidgetId[]];

export type WidgetId = keyof typeof WIDGET_PAGES;

export const WidgetId = z.enum(WIDGET_IDS);

/** Whether the page's catalog offers the widget. */
export function isWidgetOnPage(id: string, page: LayoutPage): boolean {
  const pages: readonly LayoutPage[] | undefined = isWidgetId(id) ? WIDGET_PAGES[id] : undefined;
  return pages?.includes(page) ?? false;
}

function isWidgetId(id: string): id is WidgetId {
  return Object.hasOwn(WIDGET_PAGES, id);
}
