# DeskPulse: the "Stone and Mustard" design system

Calm, near-monochrome glass on a warm stone background, with one accent color. Quiet like macOS Settings or Apple Health, with Linear's precision.
The design source of truth is the design canvas (all pages, light and dark, English, small window, edit mode, loading, states, palettes and the logo).

**Every color, font, radius, shadow and spacing value comes from the theme.** Writing a hex value in a component is not allowed.

The UI is built on MUI, and the tokens live in its theme, not in CSS files (the web app has none):
- **Colors:** `apps/web/src/theme/color-tokens.ts`, the only file allowed to hold a color literal. It holds the ten palettes (§2) and derives every other color from them. The theme exposes them as `theme.vars.palette.tokens.*` and maps them onto MUI's roles (`primary` = accent, `background`, `text`, `divider`).
- **Everything else:** `apps/web/src/theme/mui-theme.ts`: spacing (`theme.spacing(n)` = n × 4px), radii, typography variants, elevation (§4), motion (§5) and chart values.
- Components style themselves with `sx` or `styled`, with logical properties only (a Biome Grit rule enforces this).

## 1. Brand
- **Name:** DeskPulse. **Logo:** a monitor outline in ink with a pulse line in the accent; the pulse animates on hover in the sidebar.
- **Wordmark:** "Desk" in ink + "Pulse" in the accent, Inter 800, always left to right.
- **App icon:** the monitor on an accent squircle (light) or a charcoal squircle (dark).

## 2. Palettes
Every palette is **three colors per mode**: background, ink and accent. Stone and mustard is the default; the user picks another in Settings.

| Palette | Light bg · ink · accent | Dark bg · ink · accent |
|---|---|---|
| Stone & mustard (default) | `#F2F0EB` · `#2A2723` · `#C9952F` | `#18191B` · `#ECEAE4` · `#E3B65A` |
| Navy | `#EEF1F5` · `#1E2631` · `#3D6DB3` | `#15181E` · `#E6EAF0` · `#82A8E0` |
| Violet | `#F1F0F4` · `#25232D` · `#6A58CF` | `#17161B` · `#ECEAF2` · `#A99BF2` |
| Berry | `#F5F0F1` · `#2B2326` · `#B0406A` | `#1B1618` · `#F1E8EB` · `#E58BAE` |
| Ocean | `#EDF2F4` · `#1C292E` · `#17799F` | `#13191C` · `#E3ECEF` · `#68C2E2` |
| Crimson | `#F3F0F0` · `#271F20` · `#B3303B` | `#1A1616` · `#F1E9E9` · `#EC7B83` |
| Plum | `#F3EFF3` · `#2A2229` · `#8A3F86` | `#1A161A` · `#F0E8EF` · `#D79BD3` |
| Dusty rose | `#F5F0F0` · `#2D2527` · `#A35670` | `#1C1718` · `#F2EAEB` · `#E3A2B5` |
| Indigo | `#EEEFF6` · `#1B1D33` · `#4448B5` | `#13142A` · `#E8E9F5` · `#9EA2F2` |
| Graphite | `#EFEFF0` · `#1C1D20` · `#4A5566` | `#161719` · `#E9EAEC` · `#B8C3D3` |

**No orange and no green, in any palette or state.** Warnings use a deeper shade of the accent; destructive buttons use the accent.

### Derived tokens
| Token | Light | Dark |
|---|---|---|
| `muted` | ink mixed 33% toward bg | ink mixed 42% toward bg |
| `accentText` (accent text on bg or `accentSoft`) | accent mixed 35% toward ink | accent mixed 25% toward white |
| `onAccent` (text on accent buttons) | white, or near-black ink when white is below 4.5:1 | bg mixed 30% toward black |
| `warn` | accent mixed 20% toward ink | accent mixed 10% toward white |
| `accentSoft`, `navOn` | accent at 15% | accent at 16% |
| `line`, `track` | ink at 9% | white at 8% / 10% |
| `hover` | ink at 6% | white at 7% |
| `glass` / `glassBorder` | white at 60% / 92% | white at 6% / 11% |
| `dialog` | bg mixed 60% toward white | bg mixed 5% toward white |
| `orb1`, `orb2` (background) | bg mixed 14% toward accent / 4% toward ink | 12% toward accent / 5% toward ink |
| `ring` | accent | accent |
| `tooltip` | white, ink text, hairline border | bg mixed 10% toward white, ink text |

Every text pair passes **4.5:1** (muted on bg, accentText on bg and on accentSoft, onAccent on accent). Where the table's mix falls short, `accentText` deepens in 5-point steps toward its target until both of its pairs pass. A new palette ships only with a test that checks this.

## 3. Typography
| Role | Font | Size / weight |
|---|---|---|
| Page title (toolbar style, no subtitle) | Heebo (he) / Inter (en) | 17 / 600 |
| Widget title (a small muted label) | Heebo / Inter | 13 / 500, `muted` |
| Body and UI | Heebo / Inter | 15 / 400 |
| Small | Heebo / Inter | 13 / 400 |
| Numbers | Inter, `tabular-nums` | 21–44, 300–600 |
| Wordmark | Inter | 21 / 800 |

Hebrew uses Heebo for text; English uses Inter. Numbers are always Inter.

## 4. Surfaces, radius and elevation
- **Glass, without live blur on tiles.** The background is two soft orbs pre-blurred into a static layer; widget tiles are semi-opaque `glass` with a `glassBorder`. Real `backdrop-filter` blur is used **only** on the sidebar and on dialogs, and is dropped when it costs too much (measured in T53).
- **Radius:** 18 for tiles and the sidebar, 14 for menus and banners, 20–22 for dialogs, 10 for buttons, fields and nav items, 999 for pills and switches.
- **Elevation tokens** (the only shadows allowed): `tooltip`, `menu`, `toast`, `dialog`, `dragged widget`. Tiles at rest have no shadow.
- **Gradients:** only the skeleton shimmer. Nothing else.

## 5. Motion
Everything that changes moves, briefly: page slide-in (380 ms), sidebar width (280 ms), switches (220 ms), dialogs pop (280 ms), drawers, toasts, and FLIP for widgets that move, resize or are added (300 ms), all on `cubic-bezier(.2,.7,.2,1)`. `prefers-reduced-motion` turns it all into fades.

## 6. Layout and the widget grid
- **Shell:** a glass sidebar (228px, or a 68px icon rail) and the content. The sidebar's brand row holds the logo and a collapse button; the rail shows tooltips that follow light and dark and open toward the content. Settings sits at the bottom, under a hairline.
- **Page header:** the page title and the page's controls on one row. No taglines and no meta chains.
- **Grid:** 4 columns, 150px rows, 14px gaps. Under 1100px: 2 columns and the icon rail. A widget spans 1–4 columns and 1–4 rows.
- **Content-aware sizing:** a widget never cuts its content. A resize (drag, preset or keyboard) that would cut it snaps back with "the content won't fit"; a view or option change that needs more room grows the widget, height first.
- **Edit mode:** an edit bar (reset to default, cancel, + add, done), a hint line, grid guides, a 6-dot grip, a corner resize handle with a live size badge, a ⋯ menu, a remove button, an undo toast (5 s), and the keyboard: arrows move, Shift + arrows resize, Delete removes, Enter opens options, Esc closes.
- **Persistence:** layouts, views and options are saved per page per user; reset restores the page's default.

### Widget catalog
One catalog of 29 widgets; each page's "add" drawer offers only the widgets that fit that page.

| Widget | Kind | Views | Options | Pages |
|---|---|---|---|---|
| CPU, Memory, Disk, Battery | metric | ring, bars, line, meter, number | title, CPU cores, battery time left | Control, Performance, Processes, Maintenance |
| Network | metric | line (default) and the rest | upload line | Control |
| Temperature | metric | number (default) and the rest | fan speed | Control, Performance |
| Load today | detail | waves (detail), ring, bars, line, number | slowdown marks | Control, Performance |
| Needs attention | list | | compact | Control |
| Active time today | detail | hours (detail) and the rest | app names | Control, Time, Focus |
| Focus | action | | | Control, Focus |
| Docker, Updates, Status | list | | compact | Control (+ Processes, Maintenance) |
| Week by day | detail | days (detail) and the rest | | Time |
| By app | detail | list (detail) and the rest | compact | Time |
| Focus this week | list | | compact | Time |
| Slowdowns today, Heat and memory, Battery detail, Power | list / detail | | compact | Performance |
| Processes (task manager) | table | | compact | Processes |
| Disk space, Cleanup, Update details, Startup apps | list | | compact | Maintenance |
| Start focus, Last focus, Profiles, Alerts that waited | list / action | | compact | Focus |

Every widget has three states besides its content: **loading** (a skeleton in its own shape), **error** (an inline message with retry), and **unavailable** (hidden from the catalog when the computer can't support it).

## 7. Rules
1. **One accent.** It marks rings, active states, the primary action and switches that are on. Never decoration.
2. **Near-monochrome.** Charts and bars are ink and `track`; only the current value or the highlight is the accent.
3. **Plain language first.** A widget says what it means ("2 slowdowns, both while Chrome was running"); raw numbers come after.
4. **Lists, not tables.** Collections are readable lists, one plain sentence per row. The task manager is the one deliberate table, because sorting is the point.
5. **Every action confirms.** Ending an app, cleaning up, removing a container or changing startup apps opens a dialog that says what will happen and what can't be undone.
6. **RTL and LTR:** logical properties only; directional icons, the collapse chevron, tooltips, resize drag and arrow keys mirror with `dir`. Time axes run left to right in both languages.
7. **Dark mode** is a different set of values for the same tokens, chosen by `system`, `light` or `dark`.
8. **Accessible as drawn:** real buttons and inputs, labels on icon-only buttons, visible focus rings in the accent, 4.5:1 text, and everything reachable by keyboard.

## 8. Components
| Component | Appearance |
|---|---|
| Button primary | accent background, `onAccent` text, radius 10 |
| Button secondary | transparent, `line` border, ink text; "quiet" variant has no border |
| Segmented control | glass track; the active segment is `accentSoft` with `accentText` |
| Switch | `track` off, accent on, white (light) or bg (dark) knob |
| Nav item | active: `navOn` background with `navOnText`, a sliding highlight between items |
| Tag | `hover` background and `muted` text; highlight variant `accentSoft` + `accentText` |
| Banner | dialog surface, icon tile, bold title and one muted sentence, one action |
| Focus banner | `accentSoft` with an accent icon: time left, profile, muted apps, +10 min, stop |
| Toast | ink background with bg text, accent action |
| Dialog | `dialog` surface, `dialog` elevation, title, one sentence, the details, Cancel + the action |
| Palette picker | a row of ten swatches (accent inside a ring of its bg), the selected one outlined in ink |

UI copy in this document is shown in English; the product strings are localized into Hebrew (the default language) in the i18n files.
