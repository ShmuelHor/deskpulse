// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ThemeProvider } from '../../src/theme/theme-provider.js';

/** Everything Emotion injected, as one string. */
function injectedCss(): string {
  return [...document.querySelectorAll('style')].map((style) => style.textContent).join('\n');
}

describe('AppBaseline', () => {
  afterEach(cleanup);

  it('paints two static, pre-blurred background orbs behind the page', () => {
    render(<ThemeProvider root={document.createElement('html')}>{null}</ThemeProvider>);

    const css = injectedCss();

    expect(css).toContain('body::before');
    expect(css).toContain('body::after');
    expect(css).toContain('--mui-palette-tokens-orb1');
    expect(css).toContain('--mui-palette-tokens-orb2');
    expect(css).toContain('filter:blur(');
  });

  it('turns slides into fades under prefers-reduced-motion', () => {
    render(<ThemeProvider root={document.createElement('html')}>{null}</ThemeProvider>);

    expect(injectedCss()).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\{[^}]*--dp-motion-distance:0px/u,
    );
  });

  it('uses Heebo first for Hebrew and Inter first for English', () => {
    render(<ThemeProvider root={document.createElement('html')}>{null}</ThemeProvider>);

    const css = injectedCss().replaceAll('"', '').replaceAll(', ', ',');

    expect(css).toContain(':root{--dp-font-text:Inter,Heebo,sans-serif;}');
    expect(css).toContain(':lang(he){--dp-font-text:Heebo,Inter,sans-serif;}');
  });
});
