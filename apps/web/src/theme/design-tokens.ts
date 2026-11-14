/**
 * Every non-color design token from docs/DESIGN.md (§3 type, §4 radii and
 * elevation, §5 motion). The colors are in color-tokens.ts; mui-theme.ts
 * publishes both on the MUI theme.
 */

/** Radii in px. */
export interface Radii {
  /** Tiles and the sidebar. */
  readonly tile: number;
  /** Menus and banners. */
  readonly menu: number;
  /** Dialogs (the design allows 20 to 22). */
  readonly dialog: number;
  /** Buttons, fields and nav items. */
  readonly control: number;
  /** Pills and switches. */
  readonly pill: number;
}

export const RADII: Radii = { tile: 18, menu: 14, dialog: 22, control: 10, pill: 999 };
/** The small radius of chart bars. */
export const RADIUS_SM_PX = 3;

/** The only shadows allowed (docs/DESIGN.md §4); tiles at rest have none. */
export interface Elevation {
  readonly tooltip: string;
  readonly menu: string;
  readonly toast: string;
  readonly dialog: string;
  readonly dragged: string;
}

/** The `shadow` color token as the CSS variable the MUI theme declares. */
const SHADOW_COLOR = 'var(--mui-palette-tokens-shadow)';

export const ELEVATION: Elevation = {
  tooltip: `0 2px 8px ${SHADOW_COLOR}`,
  menu: `0 8px 24px ${SHADOW_COLOR}`,
  toast: `0 8px 24px ${SHADOW_COLOR}`,
  dialog: `0 24px 64px ${SHADOW_COLOR}`,
  dragged: `0 16px 40px ${SHADOW_COLOR}`,
};

/** Real `backdrop-filter` blur, used only on the sidebar and on dialogs. */
export const LIVE_BLUR = 'blur(24px)';

/** Durations in ms and the one easing curve (docs/DESIGN.md §5). */
export interface Motion {
  readonly duration: {
    readonly page: number;
    readonly sidebar: number;
    readonly switch: number;
    readonly dialog: number;
    readonly flip: number;
  };
  readonly easing: string;
  /** The media query under which every move becomes a fade. */
  readonly reducedMotion: string;
}

export const MOTION: Motion = {
  duration: { page: 380, sidebar: 280, switch: 220, dialog: 280, flip: 300 },
  easing: 'cubic-bezier(.2,.7,.2,1)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
};

/** Hebrew text is Heebo and English text is Inter; numbers are always Inter. */
export const FONT_INTER = '"Inter", sans-serif';
export const FONT_HEEBO = '"Heebo", sans-serif';
export const FONT_STACK_EN = '"Inter", "Heebo", sans-serif';
export const FONT_STACK_HE = '"Heebo", "Inter", sans-serif';
/**
 * Text uses this variable, so the font follows the `lang` of whichever element
 * is nearest (the page, or a panel in the dev gallery) with no re-render.
 */
export const TEXT_FONT_VAR = '--dp-font-text';
