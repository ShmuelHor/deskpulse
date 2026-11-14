import { describe, expect, it } from 'vitest';
import { Layout, LayoutParams, layoutFitsPage, StoredLayout } from '../../src/layouts/layout.js';
import { isWidgetOnPage, WIDGET_PAGES, WidgetId } from '../../src/layouts/widget-catalog.js';

const CATALOG_SIZE = 29;
const NOT_A_WIDGET = 3;
const widget = { id: 'cpu', w: 1, h: 1 };
const layout = { version: 1, widgets: [widget, { id: 'network', w: 2, h: 1, view: 'line' }] };

describe('Layout', () => {
  it('accepts a layout with views and options', () => {
    const full = {
      version: 1,
      widgets: [{ ...widget, view: 'ring', options: { title: false, cores: 4, label: 'x' } }],
    };

    expect(Layout.safeParse(full).success).toBe(true);
    expect(Layout.safeParse({ version: 1, widgets: [] }).success).toBe(true);
  });

  it.each([
    ['an unknown version', { ...layout, version: 2 }],
    ['an unknown top-level field', { ...layout, extra: 1 }],
    ['an unknown widget field', { ...layout, widgets: [{ ...widget, x: 0 }] }],
    ['an unknown widget ID', { ...layout, widgets: [{ ...widget, id: 'nope' }] }],
    ['a width of 0', { ...layout, widgets: [{ ...widget, w: 0 }] }],
    ['a width of 5', { ...layout, widgets: [{ ...widget, w: 5 }] }],
    ['a fractional height', { ...layout, widgets: [{ ...widget, h: 1.5 }] }],
    ['a view with markup', { ...layout, widgets: [{ ...widget, view: '<b>' }] }],
    ['an option key with markup', { ...layout, widgets: [{ ...widget, options: { '<b>': 1 } }] }],
    ['a nested option value', { ...layout, widgets: [{ ...widget, options: { a: { b: 1 } } }] }],
    [
      'more than eight options',
      {
        ...layout,
        widgets: [
          {
            ...widget,
            options: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`o${i}`, true])),
          },
        ],
      },
    ],
    ['a repeated widget', { ...layout, widgets: [widget, widget] }],
    ['too many widgets', { ...layout, widgets: Array.from({ length: 41 }, () => widget) }],
  ])('rejects %s', (_name, value) => {
    expect(Layout.safeParse(value).success).toBe(false);
  });
});

describe('StoredLayout', () => {
  it('keeps widgets it cannot judge yet and rejects another version', () => {
    expect(
      StoredLayout.safeParse({ version: 1, widgets: [{ id: 'gone' }, NOT_A_WIDGET] }).success,
    ).toBe(true);
    expect(StoredLayout.safeParse({ version: 2, widgets: [] }).success).toBe(false);
  });
});

describe('the widget catalog', () => {
  it('lists the 29 widgets of DESIGN §6', () => {
    expect(WidgetId.options).toHaveLength(CATALOG_SIZE);
  });

  it('offers a widget only on its own pages', () => {
    expect(isWidgetOnPage('processes', 'processes')).toBe(true);
    expect(isWidgetOnPage('processes', 'time')).toBe(false);
    expect(isWidgetOnPage('toString', 'time')).toBe(false);
    expect(Object.values(WIDGET_PAGES).every((pages) => pages.length > 0)).toBe(true);
  });

  it('checks a whole layout against a page', () => {
    const parsed = Layout.parse(layout);

    expect(layoutFitsPage(parsed, 'control')).toBe(true);
    expect(layoutFitsPage(parsed, 'time')).toBe(false);
  });
});

describe('LayoutParams', () => {
  it('accepts the six pages and nothing else', () => {
    expect(LayoutParams.safeParse({ page: 'control' }).success).toBe(true);
    expect(LayoutParams.safeParse({ page: 'settings' }).success).toBe(false);
    expect(LayoutParams.safeParse({ page: '__proto__' }).success).toBe(false);
  });
});
