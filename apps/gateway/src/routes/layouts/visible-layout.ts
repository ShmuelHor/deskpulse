import { type Layout, LayoutWidget, type StoredLayout } from '@deskpulse/shared/layouts/layout';
import { isWidgetOnPage, type LayoutPage } from '@deskpulse/shared/layouts/widget-catalog';

/**
 * The layout a client may see: a stored widget that this version does not know, that its page no
 * longer offers, that no longer fits the schema or that repeats an earlier one is dropped
 * (SPEC §5 gateway). The rest keep their order.
 */
export function visibleLayout(stored: StoredLayout, page: LayoutPage): Layout {
  const seen = new Set<string>();
  const widgets: LayoutWidget[] = [];
  for (const candidate of stored.widgets) {
    const parsed = LayoutWidget.safeParse(candidate);
    if (!parsed.success || seen.has(parsed.data.id) || !isWidgetOnPage(parsed.data.id, page)) {
      continue;
    }
    seen.add(parsed.data.id);
    widgets.push(parsed.data);
  }
  return { version: stored.version, widgets };
}
