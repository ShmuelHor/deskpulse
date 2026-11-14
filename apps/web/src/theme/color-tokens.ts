import { DEFAULT_PALETTE, PaletteId } from '@deskpulse/shared/settings';

import { contrastRatio, mix, over, withAlpha } from './color-math.js';
import type { ResolvedTheme } from './theme.js';

/**
 * The "Stone and Mustard" colors (docs/DESIGN.md §2). This is the only file in
 * the web app that may hold a color literal; test/theme/no-raw-colors.test.ts
 * enforces that. The MUI theme (mui-theme.ts) publishes the derived tokens as
 * `palette.tokens` and as `--mui-palette-tokens-*` CSS variables, keyed off
 * `data-theme`.
 */

export { DEFAULT_PALETTE, PaletteId };

/** The three colors a palette defines per mode; every other token derives from them. */
export interface PaletteColors {
  readonly bg: string;
  readonly ink: string;
  readonly accent: string;
}

type PaletteDefinition = Readonly<Record<ResolvedTheme, PaletteColors>>;

export const palettes: Readonly<Record<PaletteId, PaletteDefinition>> = {
  'stone-mustard': {
    light: { bg: '#F2F0EB', ink: '#2A2723', accent: '#C9952F' },
    dark: { bg: '#18191B', ink: '#ECEAE4', accent: '#E3B65A' },
  },
  navy: {
    light: { bg: '#EEF1F5', ink: '#1E2631', accent: '#3D6DB3' },
    dark: { bg: '#15181E', ink: '#E6EAF0', accent: '#82A8E0' },
  },
  violet: {
    light: { bg: '#F1F0F4', ink: '#25232D', accent: '#6A58CF' },
    dark: { bg: '#17161B', ink: '#ECEAF2', accent: '#A99BF2' },
  },
  berry: {
    light: { bg: '#F5F0F1', ink: '#2B2326', accent: '#B0406A' },
    dark: { bg: '#1B1618', ink: '#F1E8EB', accent: '#E58BAE' },
  },
  ocean: {
    light: { bg: '#EDF2F4', ink: '#1C292E', accent: '#17799F' },
    dark: { bg: '#13191C', ink: '#E3ECEF', accent: '#68C2E2' },
  },
  crimson: {
    light: { bg: '#F3F0F0', ink: '#271F20', accent: '#B3303B' },
    dark: { bg: '#1A1616', ink: '#F1E9E9', accent: '#EC7B83' },
  },
  plum: {
    light: { bg: '#F3EFF3', ink: '#2A2229', accent: '#8A3F86' },
    dark: { bg: '#1A161A', ink: '#F0E8EF', accent: '#D79BD3' },
  },
  'dusty-rose': {
    light: { bg: '#F5F0F0', ink: '#2D2527', accent: '#A35670' },
    dark: { bg: '#1C1718', ink: '#F2EAEB', accent: '#E3A2B5' },
  },
  indigo: {
    light: { bg: '#EEEFF6', ink: '#1B1D33', accent: '#4448B5' },
    dark: { bg: '#13142A', ink: '#E8E9F5', accent: '#9EA2F2' },
  },
  graphite: {
    light: { bg: '#EFEFF0', ink: '#1C1D20', accent: '#4A5566' },
    dark: { bg: '#161719', ink: '#E9EAEC', accent: '#B8C3D3' },
  },
};

export interface ColorTokens {
  readonly bg: string;
  readonly ink: string;
  readonly accent: string;
  /** Secondary text. */
  readonly muted: string;
  /** Accent text on `bg` or `accentSoft`. */
  readonly accentText: string;
  /** Text on an accent button. */
  readonly onAccent: string;
  /** Warnings: a deeper shade of the accent, never orange. */
  readonly warn: string;
  readonly accentSoft: string;
  readonly navOn: string;
  readonly navOnText: string;
  readonly line: string;
  readonly track: string;
  readonly hover: string;
  readonly glass: string;
  readonly glassBorder: string;
  /** The surface of dialogs and menus. */
  readonly dialog: string;
  /** The two blurred orbs of the static background. */
  readonly orb1: string;
  readonly orb2: string;
  /** Focus ring. */
  readonly ring: string;
  readonly tooltip: string;
  readonly tooltipBorder: string;
  /** Switch knob. */
  readonly knob: string;
  /** Color of the elevation shadows. */
  readonly shadow: string;
  /** @deprecated Old pages only; use `ink`. Removed with the old pages (T57). */
  readonly text: string;
  /** @deprecated Old pages only; use `dialog`. */
  readonly surface: string;
  /** @deprecated Old pages only; use `accentSoft`. */
  readonly accentBg: string;
  /** @deprecated Old pages only; use `accentText`. The theme has no green. */
  readonly ok: string;
  /** @deprecated Old pages only; the category dots go away with categories (T61). */
  readonly catWork: string;
  /** @deprecated See `catWork`. */
  readonly catComms: string;
  /** @deprecated See `catWork`. */
  readonly catFun: string;
  /** @deprecated See `catWork`. */
  readonly catOther: string;
  /** @deprecated See `catWork`. */
  readonly catIdle: string;
}

const WHITE = '#FFFFFF';
const BLACK = '#000000';
/** WCAG AA for body text. */
export const MIN_TEXT_CONTRAST = 4.5;

interface ModeRules {
  readonly muted: number;
  readonly accentTextMixTarget: 'ink' | 'white';
  readonly accentTextMix: number;
  readonly warnMixTarget: 'ink' | 'white';
  readonly warnMix: number;
  readonly accentSoft: number;
  readonly line: { readonly color: 'ink' | 'white'; readonly alpha: number };
  readonly track: { readonly color: 'ink' | 'white'; readonly alpha: number };
  readonly hover: { readonly color: 'ink' | 'white'; readonly alpha: number };
  readonly glass: number;
  readonly glassBorder: number;
  readonly dialogMix: number;
  readonly orb1Mix: number;
  readonly orb2Mix: number;
  readonly shadowAlpha: number;
}

const RULES: Readonly<Record<ResolvedTheme, ModeRules>> = {
  light: {
    muted: 33,
    accentTextMixTarget: 'ink',
    accentTextMix: 35,
    warnMixTarget: 'ink',
    warnMix: 20,
    accentSoft: 15,
    line: { color: 'ink', alpha: 9 },
    track: { color: 'ink', alpha: 9 },
    hover: { color: 'ink', alpha: 6 },
    glass: 60,
    glassBorder: 92,
    dialogMix: 60,
    orb1Mix: 14,
    orb2Mix: 4,
    shadowAlpha: 18,
  },
  dark: {
    muted: 42,
    accentTextMixTarget: 'white',
    accentTextMix: 25,
    warnMixTarget: 'white',
    warnMix: 10,
    accentSoft: 16,
    line: { color: 'white', alpha: 8 },
    track: { color: 'white', alpha: 10 },
    hover: { color: 'white', alpha: 7 },
    glass: 6,
    glassBorder: 11,
    dialogMix: 5,
    orb1Mix: 12,
    orb2Mix: 5,
    shadowAlpha: 50,
  },
};

const DARK_ON_ACCENT_MIX = 30;
const DARK_TOOLTIP_MIX = 10;
const LIGHT_TOOLTIP_BORDER_ALPHA = 9;

/** White text on the accent when it reads, otherwise the ink. */
function lightOnAccent(accent: string, ink: string): string {
  return contrastRatio(WHITE, accent) >= MIN_TEXT_CONTRAST ? WHITE : ink;
}

const ACCENT_TEXT_STEP = 5;
const FULL_MIX = 100;

/**
 * The accent mixed toward `target`, starting at the design's percentage and
 * deepening in steps until it reads on both `bg` and the flattened `accentSoft`.
 * A few palettes (the default one in light mode, for example) need more than the
 * table's 35%, and a fixed percentage would ship text below 4.5:1.
 */
function readableAccentText(
  accent: string,
  target: string,
  startPercent: number,
  bg: string,
  accentSoft: string,
): string {
  const tile = over(accentSoft, bg);
  let percent = startPercent;
  let color = mix(accent, target, percent);
  while (
    percent < FULL_MIX &&
    (contrastRatio(color, bg) < MIN_TEXT_CONTRAST || contrastRatio(color, tile) < MIN_TEXT_CONTRAST)
  ) {
    percent += ACCENT_TEXT_STEP;
    color = mix(accent, target, percent);
  }
  return color;
}

/** Derives every token of one mode from the palette's three colors (docs/DESIGN.md §2). */
export function deriveTokens(colors: PaletteColors, mode: ResolvedTheme): ColorTokens {
  const { bg, ink, accent } = colors;
  const rules = RULES[mode];
  const base = { ink, white: WHITE };
  const alphaOf = ({ color, alpha }: { color: 'ink' | 'white'; alpha: number }): string =>
    withAlpha(base[color], alpha);
  const accentSoft = withAlpha(accent, rules.accentSoft);
  const accentText = readableAccentText(
    accent,
    base[rules.accentTextMixTarget],
    rules.accentTextMix,
    bg,
    accentSoft,
  );
  const dark = mode === 'dark';
  return {
    bg,
    ink,
    accent,
    muted: mix(ink, bg, rules.muted),
    accentText,
    onAccent: dark ? mix(bg, BLACK, DARK_ON_ACCENT_MIX) : lightOnAccent(accent, ink),
    warn: mix(accent, base[rules.warnMixTarget], rules.warnMix),
    accentSoft,
    navOn: accentSoft,
    navOnText: accentText,
    line: alphaOf(rules.line),
    track: alphaOf(rules.track),
    hover: alphaOf(rules.hover),
    glass: withAlpha(WHITE, rules.glass),
    glassBorder: withAlpha(WHITE, rules.glassBorder),
    dialog: mix(bg, WHITE, rules.dialogMix),
    orb1: mix(bg, accent, rules.orb1Mix),
    orb2: mix(bg, ink, rules.orb2Mix),
    ring: accent,
    tooltip: dark ? mix(bg, WHITE, DARK_TOOLTIP_MIX) : WHITE,
    tooltipBorder: dark ? 'transparent' : withAlpha(ink, LIGHT_TOOLTIP_BORDER_ALPHA),
    knob: dark ? bg : WHITE,
    shadow: withAlpha(dark ? BLACK : ink, rules.shadowAlpha),
    text: ink,
    surface: mix(bg, WHITE, rules.dialogMix),
    accentBg: accentSoft,
    ok: accentText,
    catWork: accent,
    catComms: accentText,
    catFun: mix(accent, base[rules.warnMixTarget], rules.warnMix),
    catOther: mix(ink, bg, rules.muted),
    catIdle: alphaOf(rules.line),
  };
}

/** Every token of a palette in one mode. */
export function tokensFor(palette: PaletteId, mode: ResolvedTheme): ColorTokens {
  return deriveTokens(palettes[palette][mode], mode);
}

/** The default palette's tokens, for code that does not follow the user's choice. */
export const colorTokens: Readonly<Record<ResolvedTheme, ColorTokens>> = {
  light: tokensFor(DEFAULT_PALETTE, 'light'),
  dark: tokensFor(DEFAULT_PALETTE, 'dark'),
};
