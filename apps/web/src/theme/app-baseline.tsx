import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import type { CSSObject, Theme } from '@mui/material/styles';

import { FONT_STACK_EN, FONT_STACK_HE, TEXT_FONT_VAR } from './design-tokens.js';

/** Space between an element and its focus ring, in theme spacing units. */
const FOCUS_OFFSET = 0.5;
const FOCUS_RING_PX = 2;
/** The two background orbs: diameter in vmax and the blur that softens them, painted once. */
const ORB_SIZE = '60vmax';
const ORB_BLUR_PX = 120;
const ORB_OFFSET = '-20vmax';
const BEHIND_CONTENT = -1;

/**
 * Two soft orbs on a fixed layer behind the page. The blur is applied once to
 * a static element, so the compositor caches it; nothing animates and nothing
 * live blurs behind tiles (docs/DESIGN.md §4).
 */
function orb(color: string, corner: CSSObject): CSSObject {
  return {
    content: '""',
    position: 'fixed',
    zIndex: BEHIND_CONTENT,
    inlineSize: ORB_SIZE,
    blockSize: ORB_SIZE,
    borderRadius: '50%',
    backgroundColor: color,
    filter: `blur(${ORB_BLUR_PX}px)`,
    pointerEvents: 'none',
    ...corner,
  };
}

function globalStyles(theme: Theme): CSSObject {
  const { tokens } = theme.vars.palette;
  return {
    // The language's text font; numbers and the wordmark use Inter regardless.
    ':root': { [TEXT_FONT_VAR]: FONT_STACK_EN },
    ':lang(he)': { [TEXT_FONT_VAR]: FONT_STACK_HE },
    ':focus-visible': {
      outline: `${FOCUS_RING_PX}px solid ${tokens.ring}`,
      outlineOffset: theme.spacing(FOCUS_OFFSET),
    },
    'body::before': orb(tokens.orb1, {
      insetBlockStart: ORB_OFFSET,
      insetInlineStart: ORB_OFFSET,
    }),
    'body::after': orb(tokens.orb2, {
      insetBlockEnd: ORB_OFFSET,
      insetInlineEnd: ORB_OFFSET,
    }),
    [theme.motionTokens.reducedMotion]: {
      // Anything that slides reads this distance, so with it at 0 a slide is a fade.
      ':root': { '--dp-motion-distance': '0px' },
      '*, *::before, *::after': { scrollBehavior: 'auto' },
    },
  };
}

/**
 * The page-wide styles: MUI's reset (border-box, no body margin, body colors
 * and font from the theme), the language font, the accent focus ring, the
 * static background and the reduced-motion rules.
 */
export function AppBaseline(): React.JSX.Element {
  return (
    <>
      <CssBaseline />
      <GlobalStyles styles={globalStyles} />
    </>
  );
}
