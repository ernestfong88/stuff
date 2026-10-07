/**
 * KiscoConnect brand palette and semantic colours.
 *
 * Mirrors the CSS custom properties in src/styles/tokens.css. Use the CSS
 * variables in styles; use these constants where a colour has to be computed
 * in JS (canvas, SVG fills, per-server colours, charts).
 */
export const palette = {
  ocean: '#145785',
  ocean700: '#0F4368',
  ocean100: '#DCE8F1',
  skies: '#5BA0CE',
  skies100: '#E4F0F8',
  flora: '#5D7545',
  flora100: '#E5EBDD',
  coast: '#4D7093',
  moss: '#8C996A',
  clay: '#C38A51',
  clay600: '#A8703B',
  clay100: '#F6EADB',
  plum: '#5B4A93',
  plum100: '#F3F0FA',
  gold: '#E8C46A',
  amber: '#F0A030',
  green: '#2F7A3A',
  green100: '#E3F1E4',
  limestone: '#ECEFF3',
  paper: '#F1F5F9',
  surface: '#FFFFFF',
  ink: '#1B2630',
  s700: '#3A4751',
  s500: '#5E6B74',
  s400: '#8A949B',
  s200: '#C9CFD3',
  danger: '#B23B2E',
  dangerBg: '#F7E4E1',
  night: '#0B1115',
  night2: '#161E26',
  hair: 'rgba(15,23,42,0.08)',
  hair2: 'rgba(15,23,42,0.14)',
} as const;

/** Table status colours used on floor plans and tickets. */
export const statusColor = {
  open: palette.ocean,
  seated: palette.clay,
  cooking: palette.danger,
  ready: palette.flora,
  hold: palette.clay,
} as const;

/** Order channel colours. */
export const channelColor = {
  delivery: palette.coast,
  pickup: palette.clay,
  associate: palette.moss,
} as const;

export const fonts = {
  sans: "'Geist', -apple-system, system-ui, sans-serif",
  serif: "'Fraunces', Georgia, serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;
