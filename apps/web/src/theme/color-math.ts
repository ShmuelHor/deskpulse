/**
 * Color arithmetic for deriving tokens from a palette's three colors
 * (docs/DESIGN.md §2). Pure functions over `#rrggbb` strings; the palette values
 * themselves live in color-tokens.ts, the one file allowed to hold literals.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu;
const HEX_RADIX = 16;
const CHANNEL_MAX = 255;
/** Percent values in the design tables are whole numbers. */
const PERCENT = 100;
const HEX_DIGITS_PER_CHANNEL = 2;

/** WCAG 2.x relative luminance constants. */
const SRGB_LINEAR_CUTOFF = 0.039_28;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_SCALE = 1.055;
const SRGB_GAMMA = 2.4;
const LUMA_RED = 0.2126;
const LUMA_GREEN = 0.7152;
const LUMA_BLUE = 0.0722;
const LUMA_FLARE = 0.05;

/** Parses `#rrggbb`. Throws on anything else: a malformed palette is a bug. */
export function parseHex(hex: string): Rgb {
  const match = HEX_COLOR.exec(hex);
  if (match === null) {
    throw new Error(`Not a #rrggbb color: ${hex}`);
  }
  const [, r = '', g = '', b = ''] = match;
  return {
    r: Number.parseInt(r, HEX_RADIX),
    g: Number.parseInt(g, HEX_RADIX),
    b: Number.parseInt(b, HEX_RADIX),
  };
}

function channelHex(value: number): string {
  const clamped = Math.min(CHANNEL_MAX, Math.max(0, Math.round(value)));
  return clamped.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_CHANNEL, '0');
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`;
}

/** `from` moved `percent` of the way toward `to`. */
export function mix(from: string, to: string, percent: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const t = percent / PERCENT;
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

/** `color` at `percent` opacity, as `#rrggbbaa`. */
export function withAlpha(color: string, percent: number): string {
  return `${color}${channelHex((percent / PERCENT) * CHANNEL_MAX)}`;
}

const ALPHA_HEX_COLOR = /^(#[0-9a-f]{6})([0-9a-f]{2})$/iu;

/** Flattens a color made by {@link withAlpha} onto an opaque background. */
export function over(color: string, background: string): string {
  const match = ALPHA_HEX_COLOR.exec(color);
  if (match === null) {
    return color;
  }
  const [, opaque = '', alpha = 'ff'] = match;
  const opacity = Number.parseInt(alpha, HEX_RADIX) / CHANNEL_MAX;
  return mix(background, opaque, opacity * PERCENT);
}

function linear(channel: number): number {
  const value = channel / CHANNEL_MAX;
  return value <= SRGB_LINEAR_CUTOFF
    ? value / SRGB_LINEAR_DIVISOR
    : ((value + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_SCALE) ** SRGB_GAMMA;
}

function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return LUMA_RED * linear(r) + LUMA_GREEN * linear(g) + LUMA_BLUE * linear(b);
}

/** WCAG contrast ratio between two opaque colors, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + LUMA_FLARE) / ((dark ?? 0) + LUMA_FLARE);
}
