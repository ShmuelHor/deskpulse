import { createTheme, type Shadows, type Theme, type ThemeOptions } from '@mui/material/styles';
import type { CSSProperties } from 'react';

import { type ColorTokens, DEFAULT_PALETTE, type PaletteId, tokensFor } from './color-tokens.js';
import { componentOverrides } from './component-overrides.js';
import {
  ELEVATION,
  type Elevation,
  FONT_INTER,
  LIVE_BLUR,
  MOTION,
  type Motion,
  RADII,
  RADIUS_SM_PX,
  type Radii,
  TEXT_FONT_VAR,
} from './design-tokens.js';
import type { ResolvedTheme } from './theme.js';

/** Chart styling from DESIGN.md rule 2. */
export interface ChartTokens {
  /** Line width, in px. */
  readonly strokeWidth: number;
  /** Opacity of the accent fill behind an anomaly region. */
  readonly anomalyOpacity: number;
}

declare module '@mui/material/styles' {
  // Turns on the CSS-variables typings: `theme.vars` and `colorSchemes`.
  interface CssThemeVariables {
    enabled: true;
  }
  interface Theme {
    chart: ChartTokens;
    radii: Radii;
    elevation: Elevation;
    motionTokens: Motion;
    /** The `backdrop-filter` of the sidebar and dialogs, the only live blur. */
    liveBlur: string;
  }
  interface ThemeOptions {
    chart?: ChartTokens;
    radii?: Radii;
    elevation?: Elevation;
    motionTokens?: Motion;
    liveBlur?: string;
  }
  interface Palette {
    /** Every DeskPulse color by its DESIGN.md name, as `--mui-palette-tokens-*`. */
    tokens: ColorTokens;
  }
  interface PaletteOptions {
    tokens?: ColorTokens;
  }
  interface Shape {
    /** The small radius of chart bars, in px. */
    radiusSm: number;
  }
  interface ShapeOptions {
    radiusSm?: number;
  }
  interface TypographyVariants {
    /** Inter, for numbers and the wordmark; `fontFamily` is the language's text font. */
    fontFamilyNumbers: string;
    pageTitle: CSSProperties;
    widgetTitle: CSSProperties;
    small: CSSProperties;
    wordmark: CSSProperties;
    hero: CSSProperties;
    number: CSSProperties;
    table: CSSProperties;
    label: CSSProperties;
  }
  interface TypographyVariantsOptions {
    fontFamilyNumbers?: string;
    pageTitle?: CSSProperties;
    widgetTitle?: CSSProperties;
    small?: CSSProperties;
    wordmark?: CSSProperties;
    hero?: CSSProperties;
    number?: CSSProperties;
    table?: CSSProperties;
    label?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true;
    widgetTitle: true;
    small: true;
    wordmark: true;
    hero: true;
    number: true;
    table: true;
    label: true;
  }
}

/** `theme.spacing(n)` is n × 4px. */
const SPACING_UNIT_PX = 4;
const WEIGHT_LIGHT = 300;
const WEIGHT_REGULAR = 400;
const WEIGHT_MEDIUM = 500;
const WEIGHT_SEMIBOLD = 600;
const WEIGHT_EXTRABOLD = 800;
const SIZE_HERO_PX = 44;
const SIZE_NUMBER_PX = 21;
const SIZE_WORDMARK_PX = 21;
const SIZE_BODY_PX = 15;
const SIZE_PAGE_TITLE_PX = 17;
const SIZE_SMALL_PX = 13;
const NUMBER_LINE_HEIGHT = 1.1;
const CHART: ChartTokens = { strokeWidth: 1.5, anomalyOpacity: 0.12 };

/** MUI's elevation levels the design uses; every other level is flat. */
const SHADOW_LEVELS = { toast: 6, menu: 8, dialog: 24 } as const;
const SHADOW_COUNT = 25;

function shadowScale(): Shadows {
  const levels = Array.from({ length: SHADOW_COUNT }, () => 'none');
  levels[SHADOW_LEVELS.toast] = ELEVATION.toast;
  levels[SHADOW_LEVELS.menu] = ELEVATION.menu;
  levels[SHADOW_LEVELS.dialog] = ELEVATION.dialog;
  return levels as Shadows;
}

/**
 * Maps the DeskPulse colors onto MUI's palette roles, and keeps all of them as
 * `tokens`. MUI's green and orange roles map onto the accent family: the design
 * has neither color.
 */
function paletteOf(tokens: ColorTokens): NonNullable<ThemeOptions['palette']> {
  return {
    tokens,
    primary: { main: tokens.accent, contrastText: tokens.onAccent },
    secondary: { main: tokens.ink, contrastText: tokens.bg },
    error: { main: tokens.accent, contrastText: tokens.onAccent },
    warning: { main: tokens.warn, contrastText: tokens.onAccent },
    info: { main: tokens.accent, contrastText: tokens.onAccent },
    success: { main: tokens.accentText, contrastText: tokens.onAccent },
    background: { default: tokens.bg, paper: tokens.dialog },
    text: { primary: tokens.ink, secondary: tokens.muted },
    divider: tokens.line,
  };
}

function colorScheme(
  palette: PaletteId,
  mode: ResolvedTheme,
): { palette: NonNullable<ThemeOptions['palette']> } {
  return { palette: paletteOf(tokensFor(palette, mode)) };
}

const numbers: CSSProperties = {
  fontFamily: FONT_INTER,
  fontWeight: WEIGHT_MEDIUM,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: NUMBER_LINE_HEIGHT,
};

/**
 * The MUI theme for one palette (docs/DESIGN.md), and the home of every design
 * token except the colors (color-tokens.ts). Colors become CSS variables scoped
 * by `data-theme`, so light and dark switch in CSS on `<html>` or on any element
 * that sets the attribute, without a re-render. Picking another palette builds
 * another theme.
 */
export function createAppTheme(palette: PaletteId = DEFAULT_PALETTE): Theme {
  return createTheme({
    cssVariables: { colorSchemeSelector: 'data-theme' },
    colorSchemes: { light: colorScheme(palette, 'light'), dark: colorScheme(palette, 'dark') },
    shape: { borderRadius: RADII.control, radiusSm: RADIUS_SM_PX },
    spacing: SPACING_UNIT_PX,
    shadows: shadowScale(),
    chart: CHART,
    radii: RADII,
    elevation: ELEVATION,
    motionTokens: MOTION,
    liveBlur: LIVE_BLUR,
    transitions: {
      easing: {
        easeInOut: MOTION.easing,
        easeOut: MOTION.easing,
        easeIn: MOTION.easing,
        sharp: MOTION.easing,
      },
      duration: { enteringScreen: MOTION.duration.dialog, leavingScreen: MOTION.duration.switch },
    },
    typography: {
      fontFamily: `var(${TEXT_FONT_VAR})`,
      fontFamilyNumbers: FONT_INTER,
      fontSize: SIZE_BODY_PX,
      fontWeightLight: WEIGHT_LIGHT,
      fontWeightRegular: WEIGHT_REGULAR,
      fontWeightMedium: WEIGHT_MEDIUM,
      fontWeightBold: WEIGHT_SEMIBOLD,
      h1: { fontSize: SIZE_PAGE_TITLE_PX, fontWeight: WEIGHT_SEMIBOLD },
      h2: { fontSize: SIZE_SMALL_PX, fontWeight: WEIGHT_MEDIUM },
      h3: { fontSize: SIZE_BODY_PX, fontWeight: WEIGHT_MEDIUM },
      body1: { fontSize: SIZE_BODY_PX },
      body2: { fontSize: SIZE_SMALL_PX },
      button: { fontWeight: WEIGHT_MEDIUM, textTransform: 'none' },
      pageTitle: { fontSize: SIZE_PAGE_TITLE_PX, fontWeight: WEIGHT_SEMIBOLD },
      widgetTitle: { fontSize: SIZE_SMALL_PX, fontWeight: WEIGHT_MEDIUM },
      small: { fontSize: SIZE_SMALL_PX, fontWeight: WEIGHT_REGULAR },
      wordmark: {
        fontFamily: FONT_INTER,
        fontSize: SIZE_WORDMARK_PX,
        fontWeight: WEIGHT_EXTRABOLD,
        // The wordmark always reads left to right.
        direction: 'ltr',
      },
      hero: { ...numbers, fontSize: SIZE_HERO_PX, fontWeight: WEIGHT_LIGHT },
      number: { ...numbers, fontSize: SIZE_NUMBER_PX },
      table: { ...numbers, fontWeight: WEIGHT_REGULAR, fontSize: SIZE_BODY_PX },
      label: { fontSize: SIZE_SMALL_PX, fontWeight: WEIGHT_MEDIUM },
    },
    components: componentOverrides,
  });
}

/** The default palette's theme. */
export const appTheme: Theme = createAppTheme();
