import { describe, expect, it } from 'vitest';

import { colorTokens, palettes } from '../../src/theme/color-tokens.js';
import { appTheme, createAppTheme } from '../../src/theme/mui-theme.js';

const LIGHT_SELECTOR = ':root, [data-theme="light"]';
const DARK_SELECTOR = '[data-theme="dark"]';
const RADIUS_PX = 10;
const RADIUS_SM_PX = 3;
/** theme.spacing(6) is DESIGN.md's fifth step, 24px (6 × the 4px unit). */
const SPACE_5 = 6;
const CHART_STROKE_PX = 1.5;
const ANOMALY_OPACITY = 0.12;
const HERO_PX = 44;

/** The CSS variables MUI generates, keyed by the selector they are declared on. */
function variablesBySelector(): Map<string, Record<string, unknown>> {
  const sheets = new Map<string, Record<string, unknown>>();
  for (const sheet of appTheme.generateStyleSheets()) {
    for (const [selector, declarations] of Object.entries(sheet)) {
      sheets.set(selector, { ...sheets.get(selector), ...declarations });
    }
  }
  return sheets;
}

describe('appTheme', () => {
  it.each([
    ['light', LIGHT_SELECTOR],
    ['dark', DARK_SELECTOR],
  ] as const)('declares every %s color token under %s', (scheme, selector) => {
    const variables = variablesBySelector().get(selector);

    for (const [name, value] of Object.entries(colorTokens[scheme])) {
      expect(variables?.[`--mui-palette-tokens-${name}`]).toBe(value);
    }
  });

  it('maps the main palette roles onto the tokens', () => {
    const { palette } = appTheme.colorSchemes.light ?? {};

    expect(palette?.primary.main).toBe(colorTokens.light.accent);
    expect(palette?.primary.contrastText).toBe(colorTokens.light.onAccent);
    expect(palette?.background.default).toBe(colorTokens.light.bg);
    expect(palette?.background.paper).toBe(colorTokens.light.dialog);
    expect(palette?.text.primary).toBe(colorTokens.light.ink);
    expect(palette?.text.secondary).toBe(colorTokens.light.muted);
  });

  it('has no green or orange role: success, warning and error use the accent family', () => {
    const { palette } = appTheme.colorSchemes.dark ?? {};

    expect(palette?.success.main).toBe(colorTokens.dark.accentText);
    expect(palette?.warning.main).toBe(colorTokens.dark.warn);
    expect(palette?.error.main).toBe(colorTokens.dark.accent);
  });

  it('builds a theme per palette', () => {
    const navy = createAppTheme('navy');

    expect(navy.colorSchemes.light?.palette?.primary.main).toBe(palettes.navy.light.accent);
  });

  it('allows shadows only at the design elevations', () => {
    const shadowed = appTheme.shadows.filter((shadow) => shadow !== 'none');

    expect(new Set(shadowed)).toEqual(
      new Set([appTheme.elevation.toast, appTheme.elevation.menu, appTheme.elevation.dialog]),
    );
    expect(Object.keys(appTheme.elevation).sort()).toEqual([
      'dialog',
      'dragged',
      'menu',
      'toast',
      'tooltip',
    ]);
  });

  it('carries the DESIGN.md radii, spacing scale and chart tokens', () => {
    expect(appTheme.radii).toEqual({ tile: 18, menu: 14, dialog: 22, control: 10, pill: 999 });
    expect(appTheme.shape).toMatchObject({ borderRadius: RADIUS_PX, radiusSm: RADIUS_SM_PX });
    expect(appTheme.spacing(SPACE_5)).toBe('calc(6 * var(--mui-spacing, 4px))');
    expect(appTheme.chart).toEqual({
      strokeWidth: CHART_STROKE_PX,
      anomalyOpacity: ANOMALY_OPACITY,
    });
  });

  it('moves everything on the design easing and durations', () => {
    expect(appTheme.motionTokens.easing).toBe('cubic-bezier(.2,.7,.2,1)');
    expect(appTheme.motionTokens.duration).toEqual({
      page: 380,
      sidebar: 280,
      switch: 220,
      dialog: 280,
      flip: 300,
    });
    expect(appTheme.motionTokens.reducedMotion).toContain('prefers-reduced-motion: reduce');
    expect(appTheme.transitions.easing.easeInOut).toBe(appTheme.motionTokens.easing);
  });

  it('sets numbers in Inter with tabular figures, and the wordmark in Inter 800', () => {
    expect(appTheme.typography.hero).toMatchObject({
      fontFamily: appTheme.typography.fontFamilyNumbers,
      fontSize: HERO_PX,
      fontVariantNumeric: 'tabular-nums',
    });
    expect(appTheme.typography.fontFamilyNumbers).toContain('Inter');
    expect(appTheme.typography.wordmark).toMatchObject({ fontSize: 21, fontWeight: 800 });
  });

  it('sets the type scale of DESIGN.md §3', () => {
    const { typography } = appTheme;

    expect(typography.pageTitle).toMatchObject({ fontSize: 17, fontWeight: 600 });
    expect(typography.widgetTitle).toMatchObject({ fontSize: 13, fontWeight: 500 });
    expect(typography.body1).toMatchObject({ fontSize: 15 });
    expect(typography.small).toMatchObject({ fontSize: 13, fontWeight: 400 });
  });

  it('takes the text font from the language variable', () => {
    expect(appTheme.typography.fontFamily).toBe('var(--dp-font-text)');
  });
});
