/**
 * Chart colours, drawn from the brand palette. Fills are a step softer than
 * the text tokens so value labels in ink stay readable next to them.
 * Sentiment and on/off goal are diverging: green and red poles with a
 * neutral grey between, never a hue in the middle.
 */
export const CHART = {
  good: '#4E9A55',
  goodSoft: '#B5D9B4',
  bad: '#C9584B',
  badSoft: '#E9B4AC',
  watch: '#D9A13B',
  neutral: '#A3AEB8',
  empty: '#E4E8EC',
  ink: '#1B2630',
  goalLine: '#5E6B74',
  /** Revenue: made (soft ocean, today in full ocean) with comps stacked on top in clay. */
  made: '#A9C3D6',
  madeNow: '#3F7FA8',
  comped: '#C9805E',
  /** P-Mix: specials in greens, à la carte in ocean blues, darkest first. */
  specials: ['#1E5E2A', '#2F7A3A', '#4E9A55', '#73B378', '#9CCB9F', '#B9DBBB', '#D2E8D3'],
  alaCarte: ['#0E4469', '#145785', '#2E73A6', '#5A93BF', '#88B3D6', '#A9C8E0', '#D0E1EF'],
  specialsOther: '#E2EFE2',
  alaCarteOther: '#E1EAF2',
} as const;
