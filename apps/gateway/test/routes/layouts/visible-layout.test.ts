import { describe, expect, it } from 'vitest';
import { visibleLayout } from '../../../src/routes/layouts/visible-layout.js';

describe('visibleLayout', () => {
  it('drops widgets this version does not know, in any shape', () => {
    const stored = {
      version: 1 as const,
      widgets: [{ id: 'cpu', w: 1, h: 1 }, { id: 'retired-widget', w: 1, h: 1 }, 'nonsense', null],
    };

    expect(visibleLayout(stored, 'control').widgets).toEqual([{ id: 'cpu', w: 1, h: 1 }]);
  });

  it('drops a known widget that the page does not offer', () => {
    const stored = { version: 1 as const, widgets: [{ id: 'processes', w: 4, h: 3 }] };

    expect(visibleLayout(stored, 'time').widgets).toEqual([]);
  });

  it('drops a widget that no longer fits the schema', () => {
    const stored = { version: 1 as const, widgets: [{ id: 'cpu', w: 9, h: 1 }] };

    expect(visibleLayout(stored, 'control').widgets).toEqual([]);
  });

  it('keeps the first of a repeated widget and the order of the rest', () => {
    const stored = {
      version: 1 as const,
      widgets: [
        { id: 'memory', w: 1, h: 1 },
        { id: 'cpu', w: 1, h: 1 },
        { id: 'memory', w: 3, h: 3 },
      ],
    };

    expect(visibleLayout(stored, 'control').widgets).toEqual([
      { id: 'memory', w: 1, h: 1 },
      { id: 'cpu', w: 1, h: 1 },
    ]);
  });
});
