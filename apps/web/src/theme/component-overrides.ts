import type { Components, Theme } from '@mui/material/styles';

/** Switch geometry in px: a 40 by 24 pill with a 18px knob and a 3px inset. */
const SWITCH_WIDTH_PX = 40;
const SWITCH_HEIGHT_PX = 24;
const SWITCH_KNOB_PX = 18;
const SWITCH_INSET_PX = 3;
const SWITCH_TRAVEL_PX = SWITCH_WIDTH_PX - SWITCH_KNOB_PX - 2 * SWITCH_INSET_PX;
/** Tooltip and field paddings, in theme spacing units. */
const TOOLTIP_PADDING_Y = 1.5;
const TOOLTIP_PADDING_X = 2.5;
const SKELETON_SHIMMER_MS = 1600;

/**
 * Component styling that carries the DESIGN.md look: glass tiles, solid dialog
 * surfaces, radii, the switch, the tooltip, the toast. Every value is a theme
 * token; the only gradient is the skeleton shimmer.
 */
export const componentOverrides: Components<Omit<Theme, 'components'>> = {
  MuiButtonBase: { defaultProps: { disableRipple: true } },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: ({ theme }) => ({ borderRadius: theme.radii.control }),
      outlined: ({ theme }) => ({
        borderColor: theme.vars.palette.tokens.line,
        color: theme.vars.palette.tokens.ink,
        '&:hover': {
          borderColor: theme.vars.palette.tokens.line,
          backgroundColor: theme.vars.palette.tokens.hover,
        },
      }),
      text: ({ theme }) => ({
        color: theme.vars.palette.tokens.ink,
        '&:hover': { backgroundColor: theme.vars.palette.tokens.hover },
      }),
    },
  },
  MuiPaper: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      // A tile: semi-opaque glass with no live blur (the background is a static layer).
      root: ({ theme }) => ({
        backgroundColor: theme.vars.palette.tokens.glass,
        backgroundImage: 'none',
        border: `1px solid ${theme.vars.palette.tokens.glassBorder}`,
        borderRadius: theme.radii.tile,
        color: theme.vars.palette.tokens.ink,
      }),
    },
  },
  MuiPopover: {
    styleOverrides: {
      paper: ({ theme }) => ({
        backgroundColor: theme.vars.palette.tokens.dialog,
        borderRadius: theme.radii.menu,
        boxShadow: theme.elevation.menu,
      }),
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        backgroundColor: theme.vars.palette.tokens.dialog,
        backdropFilter: theme.liveBlur,
        borderRadius: theme.radii.dialog,
        boxShadow: theme.elevation.dialog,
      }),
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: theme.radii.control,
        '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.tokens.line },
      }),
    },
  },
  MuiSwitch: {
    styleOverrides: {
      root: ({ theme }) => ({
        width: SWITCH_WIDTH_PX,
        height: SWITCH_HEIGHT_PX,
        padding: 0,
        '& .MuiSwitch-switchBase': {
          padding: SWITCH_INSET_PX,
          transitionDuration: `${theme.motionTokens.duration.switch}ms`,
          transitionTimingFunction: theme.motionTokens.easing,
          '&.Mui-checked': {
            transform: `translateX(${SWITCH_TRAVEL_PX}px)`,
            '& + .MuiSwitch-track': {
              backgroundColor: theme.vars.palette.tokens.accent,
              opacity: 1,
            },
          },
          '&.Mui-focusVisible + .MuiSwitch-track': {
            outline: `2px solid ${theme.vars.palette.tokens.ring}`,
            outlineOffset: 2,
          },
        },
        '& .MuiSwitch-thumb': {
          width: SWITCH_KNOB_PX,
          height: SWITCH_KNOB_PX,
          boxShadow: 'none',
          backgroundColor: theme.vars.palette.tokens.knob,
        },
        '& .MuiSwitch-track': {
          borderRadius: theme.radii.pill,
          backgroundColor: theme.vars.palette.tokens.track,
          opacity: 1,
          transition: `background-color ${theme.motionTokens.duration.switch}ms ${theme.motionTokens.easing}`,
        },
        // Under reduced motion the knob jumps and the track cross-fades.
        [theme.motionTokens.reducedMotion]: {
          '& .MuiSwitch-switchBase': { transitionDuration: '0ms' },
        },
      }),
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: ({ theme }) => ({
        backgroundColor: theme.vars.palette.tokens.tooltip,
        border: `1px solid ${theme.vars.palette.tokens.tooltipBorder}`,
        borderRadius: theme.radii.control,
        boxShadow: theme.elevation.tooltip,
        color: theme.vars.palette.tokens.ink,
        fontSize: theme.typography.small.fontSize,
        padding: theme.spacing(TOOLTIP_PADDING_Y, TOOLTIP_PADDING_X),
      }),
      arrow: ({ theme }) => ({ color: theme.vars.palette.tokens.tooltip }),
    },
  },
  // A toast: ink background with bg text and the accent for its action.
  MuiSnackbarContent: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.vars.palette.tokens.ink,
        borderRadius: theme.radii.menu,
        boxShadow: theme.elevation.toast,
        color: theme.vars.palette.tokens.bg,
        '& .MuiButton-root': { color: theme.vars.palette.tokens.accent },
      }),
    },
  },
  MuiSkeleton: {
    defaultProps: { animation: 'wave' },
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.vars.palette.tokens.track,
        '&::after': { animationDuration: `${SKELETON_SHIMMER_MS}ms` },
        // Under reduced motion the shimmer stops and the skeleton pulses instead.
        [theme.motionTokens.reducedMotion]: { '&::after': { animation: 'none' } },
      }),
    },
  },
  MuiTypography: {
    defaultProps: {
      variantMapping: {
        pageTitle: 'h1',
        widgetTitle: 'h2',
        small: 'p',
        wordmark: 'span',
        hero: 'p',
        number: 'p',
        table: 'span',
        label: 'p',
      },
    },
    // Widget titles and labels are always muted (DESIGN.md §3).
    variants: [
      {
        props: { variant: 'label' },
        style: ({ theme }) => ({ color: theme.vars.palette.tokens.muted }),
      },
      {
        props: { variant: 'widgetTitle' },
        style: ({ theme }) => ({ color: theme.vars.palette.tokens.muted }),
      },
    ],
  },
};
