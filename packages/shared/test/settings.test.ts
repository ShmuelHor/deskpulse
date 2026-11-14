import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, PaletteId, Settings } from '../src/settings.js';

const settings = {
  language: 'he',
  theme: 'system',
  palette: 'stone-mustard',
  privacy: { excludedApps: ['keepassxc'] },
  thresholds: { memory: 10, cpu: 40, io: 30 },
  systemApps: ['org.gnome.Settings'],
  quietHours: { enabled: true, start: '22:00', end: '07:00' },
};

describe('Settings', () => {
  it('accepts valid settings, with quiet hours on or off', () => {
    expect(Settings.safeParse(settings).success).toBe(true);
    expect(Settings.safeParse({ ...settings, quietHours: { enabled: false } }).success).toBe(true);
  });

  it('rejects unknown languages, themes, thresholds and keys', () => {
    expect(Settings.safeParse({ ...settings, language: 'fr' }).success).toBe(false);
    expect(Settings.safeParse({ ...settings, theme: 'neon' }).success).toBe(false);
    expect(
      Settings.safeParse({ ...settings, thresholds: { memory: 10, cpu: 400, io: 30 } }).success,
    ).toBe(false);
    expect(Settings.safeParse({ ...settings, quietHours: { enabled: true } }).success).toBe(false);
    expect(Settings.safeParse({ ...settings, isAdmin: true }).success).toBe(false);
  });

  it('accepts each of the ten palettes and rejects any other', () => {
    expect(PaletteId.options).toHaveLength(10);
    for (const palette of PaletteId.options) {
      expect(Settings.safeParse({ ...settings, palette }).success).toBe(true);
    }
    expect(Settings.safeParse({ ...settings, palette: 'neon' }).success).toBe(false);
    expect(PaletteId.options).toContain(DEFAULT_PALETTE);
  });

  it('requires a palette', () => {
    const { palette: _palette, ...withoutPalette } = settings;
    expect(Settings.safeParse(withoutPalette).success).toBe(false);
  });
});
