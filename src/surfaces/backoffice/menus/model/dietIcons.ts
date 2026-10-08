/**
 * Diet icons for printed menus: a small line drawing for each diet a
 * recipe can carry (Recipe.dietFlags, see DIETS), drawn in the text colour
 * so it prints crisp in black and grey and never relies on colour. A "free
 * of" diet (gluten, lactose, salt) is its food struck through. Each page
 * prints a legend of the icons on it, and Word gets the same drawings.
 */
import { escapeHtml as esc } from '../../../../lib/print';
import { DIETS } from './categories';

export interface DietIcon {
  /** The diet as recipes name it ("Gluten-Friendly"). */
  flag: string;
  /** Letters for where a drawing can't go (Word without images). */
  short: string;
  /** SVG shapes on a 16 × 16 grid, stroked in the text colour. */
  shapes: string;
}

const SLASH = '<path d="M2.5 2.5l11 11"/>';

const ICONS: DietIcon[] = [
  {
    flag: 'Vegetarian',
    short: 'V',
    // A leaf with its vein.
    shapes: '<path d="M3 13.5C3 7 6.5 3 13.5 2.5 13.5 9.5 9.5 13.5 3 13.5z"/><path d="M3 13.5 9.5 7"/>',
  },
  {
    flag: 'Gluten-Friendly',
    short: 'GF',
    // An ear of wheat, struck through.
    shapes:
      '<path d="M8 15V5.2"/><ellipse cx="8" cy="2.9" rx=".75" ry="1.6" transform="rotate(0 8 2.9)"/><ellipse cx="5.9" cy="6.2" rx=".75" ry="1.6" transform="rotate(-40 5.9 6.2)"/><ellipse cx="10.1" cy="6.2" rx=".75" ry="1.6" transform="rotate(40 10.1 6.2)"/>' +
      '<ellipse cx="5.9" cy="9.9" rx=".75" ry="1.6" transform="rotate(-40 5.9 9.9)"/><ellipse cx="10.1" cy="9.9" rx=".75" ry="1.6" transform="rotate(40 10.1 9.9)"/>' +
      SLASH,
  },
  {
    flag: 'Heart-Healthy',
    short: 'HH',
    shapes: '<path d="M8 14S1.8 10.2 1.8 5.9A3.1 3.1 0 0 1 8 4.6a3.1 3.1 0 0 1 6.2 1.3C14.2 10.2 8 14 8 14z"/>',
  },
  {
    flag: 'Lactose Intolerant',
    short: 'LF',
    // A drop of milk, struck through.
    shapes: '<path d="M8 1.8S3.8 6.8 3.8 10a4.2 4.2 0 0 0 8.4 0C12.2 6.8 8 1.8 8 1.8z"/>' + SLASH,
  },
  {
    flag: 'No Salt Added',
    short: 'NS',
    // A salt shaker, struck through.
    shapes: '<path d="M4.8 14.5h6.4V8.2H4.8zM4.8 8.2C4.8 4.6 6.2 2.5 8 2.5s3.2 2.1 3.2 5.7"/><path d="M6.6 5.4h.01M9.4 5.4h.01M8 4.6h.01"/>' + SLASH,
  },
  {
    flag: 'Mechanical Altered',
    short: 'MA',
    // A knife over chopped pieces.
    shapes: '<path d="M2.5 9.5 10.2 1.8a1.7 1.7 0 0 1 2.4 2.4L7 9.8"/><path d="M3 12h2.6v2.6H3zM7 12h2.6v2.6H7zM11 12h2.6v2.6H11z"/>',
  },
  {
    flag: 'Nectar',
    short: 'N',
    // A cup of thickened drink.
    shapes: '<path d="M3.5 4h9l-1.2 10.2H4.7z"/><path d="M4 7.3c1.3-.9 2.7.9 4 0s2.7.9 4 0"/>',
  },
  {
    flag: 'Pureed',
    short: 'P',
    // A bowl and spoon.
    shapes: '<path d="M1.8 8.2h12.4a6.2 6.2 0 0 1-12.4 0z"/><path d="M9.8 8.2 13.6 2"/>',
  },
];

const BY_FLAG = new Map(ICONS.map((i) => [i.flag.toLowerCase(), i]));

/** Letters for a diet with no drawing: its words' first letters ("Low Sugar" → "LS"). */
function initials(flag: string): string {
  return (
    flag
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .filter((c) => /[A-Z0-9]/.test(c))
      .join('')
      .slice(0, 3) || '?'
  );
}

/** The icon for a diet. A diet without a drawing gets a ring with its letters, so it still prints. */
export function dietIcon(flag: string): DietIcon {
  const known = BY_FLAG.get(flag.toLowerCase());
  if (known) return known;
  const short = initials(flag);
  return {
    flag,
    short,
    shapes:
      '<circle cx="8" cy="8" r="6.5"/><text x="8" y="10.6" text-anchor="middle" font-size="' +
      (short.length > 2 ? 5 : 7) +
      '" font-family="Arial,sans-serif" font-weight="700" fill="currentColor" stroke="none">' +
      esc(short) +
      '</text>',
  };
}

/** An icon as inline SVG; `color` for a stand-alone file (Word), else it takes the text colour. */
export function dietSvg(flag: string, o: { cls?: string; color?: string; px?: number } = {}): string {
  const i = dietIcon(flag);
  const size = o.px ? ` width="${o.px}" height="${o.px}"` : '';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"' +
    size +
    (o.cls ? ` class="${o.cls}"` : '') +
    ' fill="none" stroke="' +
    (o.color ?? 'currentColor') +
    '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="' +
    esc(i.flag) +
    '"' +
    (o.color ? ` color="${o.color}"` : '') +
    '>' +
    i.shapes +
    '</svg>'
  );
}

/** The diets in a list of them, each once, in the order the Recipe Book lists diets (others after, as found). */
export function dietOrder(flags: Iterable<string>): string[] {
  const seen = [...new Set(flags)];
  const rank = (f: string) => {
    const k = DIETS.indexOf(f);
    return k < 0 ? DIETS.length : k;
  };
  return seen
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .map((x) => x.f);
}
