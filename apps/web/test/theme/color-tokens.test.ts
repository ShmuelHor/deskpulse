import { describe, expect, it } from 'vitest';

import { contrastRatio, over } from '../../src/theme/color-math.js';
import {
  MIN_TEXT_CONTRAST,
  PaletteId,
  palettes,
  tokensFor,
} from '../../src/theme/color-tokens.js';
import type { ResolvedTheme } from '../../src/theme/theme.js';

const MODES: readonly ResolvedTheme[] = ['light', 'dark'];
const CASES = PaletteId.options.flatMap((id) => MODES.map((mode) => [id, mode] as const));

describe('palettes', () => {
  it('defines ten palettes with three colors per mode', () => {
    expect(PaletteId.options).toHaveLength(10);
    for (const id of PaletteId.options) {
      expect(Object.keys(palettes[id].light).sort()).toEqual(['accent', 'bg', 'ink']);
      expect(Object.keys(palettes[id].dark).sort()).toEqual(['accent', 'bg', 'ink']);
    }
  });
});

describe('text contrast (WCAG AA, 4.5:1)', () => {
  it.each(CASES)('%s %s: every text pair passes', (id, mode) => {
    const t = tokensFor(id, mode);
    const accentSoftOnBg = over(t.accentSoft, t.bg);

    const pairs: Record<string, number> = {
      'ink on bg': contrastRatio(t.ink, t.bg),
      'muted on bg': contrastRatio(t.muted, t.bg),
      'accentText on bg': contrastRatio(t.accentText, t.bg),
      'accentText on accentSoft': contrastRatio(t.accentText, accentSoftOnBg),
      'onAccent on accent': contrastRatio(t.onAccent, t.accent),
    };

    for (const [pair, ratio] of Object.entries(pairs)) {
      expect({ pair, passes: ratio >= MIN_TEXT_CONTRAST, ratio }).toMatchObject({ passes: true });
    }
  });
});

describe('derived tokens', () => {
  it('uses white on the accent only when it reads', () => {
    expect(tokensFor('stone-mustard', 'light').onAccent).toBe(palettes['stone-mustard'].light.ink);
    expect(tokensFor('navy', 'light').onAccent).toBe('#FFFFFF');
  });

  it('mixes the muted text toward the background', () => {
    const t = tokensFor('stone-mustard', 'light');

    expect(contrastRatio(t.muted, t.bg)).toBeLessThan(contrastRatio(t.ink, t.bg));
  });

  it('lets every color be an opaque hex or an rgb() with alpha', () => {
    for (const [id, mode] of CASES) {
      for (const value of Object.values(tokensFor(id, mode))) {
        expect(value).toMatch(/^(#[0-9a-f]{6}|rgb\(\d+ \d+ \d+ \/ [\d.]+\)|transparent)$/iu);
      }
    }
  });
});
