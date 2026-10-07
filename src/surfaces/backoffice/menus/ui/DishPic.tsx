import { dishPhoto } from '../../../../data/photos';
import { cx } from '../../../../ui';
import s from './DishPic.module.css';

/** Kitchen icons for drinks, drawn on a 24 grid. */
const DRINK_ICONS: Record<string, string[]> = {
  coffee: [
    'M4 9h12v5.5A5.5 5.5 0 0 1 10.5 20h-1A5.5 5.5 0 0 1 4 14.5Z',
    'M16 10.5h1.2a2.8 2.8 0 0 1 0 5.6H16',
    'M8 6.5c-.8-.9.8-1.8 0-3',
    'M12 6.5c-.8-.9.8-1.8 0-3',
  ],
  tea: [
    'M4 10h13v3.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6Z',
    'M17 11.5h1a2.5 2.5 0 0 1 0 5h-1.6',
    'M3 21.5h16',
    'M11 10V6.5c0-1 .8-1.5 1.8-1.5',
    'M12.8 3.5h3v3h-3Z',
  ],
  soda: ['M6 8h12l-1.4 12.1a1 1 0 0 1-1 .9H8.4a1 1 0 0 1-1-.9Z', 'M5 8h14', 'M12.5 8l1.8-5.5h3', 'M10 13.5h.01', 'M13.5 16h.01'],
  juice: ['M6.5 6.5h9.5l-1.5 14h-6.5Z', 'M7.1 11.5h8.3', 'M14.5 6.5a2.8 2.8 0 0 1 5.5 0Z'],
  milk: [
    'M7.5 9.5 9.5 5.5h5l2 4V20a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1Z',
    'M7.5 9.5h9',
    'M9.5 5.5V3h5v2.5',
    'M12 13.2c-1 1.3-1.6 2.1-1.6 2.9a1.6 1.6 0 0 0 3.2 0c0-.8-.6-1.6-1.6-2.9Z',
  ],
  wine: ['M7.8 3h8.4c.6 2.7.6 5-.4 6.9a4.6 4.6 0 0 1-7.6 0c-1-1.9-1-4.2-.4-6.9Z', 'M7.5 6.5h9', 'M12 12.3V20', 'M8.5 20.5h7'],
  beer: [
    'M5 9h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z',
    'M15 11h2.2a1.8 1.8 0 0 1 1.8 1.8v2.4a1.8 1.8 0 0 1-1.8 1.8H15',
    'M5 9c-1.3-.5-1.3-2.4.1-2.8.4-1.6 2.3-2.1 3.5-1.1 1-1.3 3.2-1.2 4 .4 1.3-.2 2.4.8 2.4 2.1V9',
    'M8.5 12.5v5.5',
    'M11.5 12.5v5.5',
  ],
  cocktail: ['M4 4h16l-8 9Z', 'M12 13v7.5', 'M8.5 20.5h7', 'M16.5 4 19 1.5'],
};

/** Order matters: iced tea is a cold drink, not a pot of hot tea. */
const DRINK_RULES: Array<[string, RegExp]> = [
  ['soda', /\biced\b|sweet tea/i],
  ['coffee', /coffee|espresso|latte|cappuccino|mocha|decaf|hot chocolate|cocoa/i],
  ['tea', /\btea\b|chai/i],
  ['milk', /milk/i],
  ['soda', /ginger ale|cola|coke|sprite|soda|lemonade|root beer|pepsi|sparkling|seltzer|tonic/i],
  ['juice', /juice|water|smoothie/i],
  ['beer', /beer|lager|\bipa\b|stout|pilsner|porter|\bale\b/i],
  [
    'cocktail',
    /cocktail|martini|margarita|mojito|manhattan|old fashioned|mimosa|bloody mary|spritz|vodka|\bgin\b|\brum\b|whisk|bourbon|tequila|negroni|daiquiri/i,
  ],
  ['wine', /wine|merlot|cabernet|chardonnay|pinot|sauvignon|riesling|ros[eé]\b|champagne|prosecco|sangria/i],
];

/** The kitchen icon for a drink, from its name. */
export function drinkIcon(name: string): string {
  for (const [k, re] of DRINK_RULES) if (re.test(name)) return k;
  return 'soda';
}

/** A dish photo when there is one; otherwise a plain plate (or the drink's icon). */
export function DishPic({ name, drink, size = 40, className }: { name: string; drink?: boolean; size?: number | string; className?: string }) {
  const src = dishPhoto(name);
  if (src) return <img src={src} alt="" className={cx(s.pic, className)} style={{ width: size, height: size }} draggable={false} />;
  const glyph = typeof size === 'number' ? Math.round(size * 0.45) : 36;
  return (
    <span className={cx(s.pic, s.blank, className)} style={{ width: size, height: size }} aria-hidden>
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {drink ? (
          <>
            {DRINK_ICONS[drinkIcon(name)].map((d) => (
              <path key={d} d={d} />
            ))}
            {drinkIcon(name) === 'cocktail' && <circle cx={9.8} cy={6.6} r={1} />}
          </>
        ) : (
          <>
            <circle cx={12} cy={12} r={9.5} />
            <circle cx={12} cy={12} r={5.5} />
          </>
        )}
      </svg>
    </span>
  );
}
