/**
 * Meal Credits (HO Settings): what one meal credit covers, how extras past
 * it are charged, and where residents can use their credits for guests.
 * The server's Close & charge screen counts every check with these rules.
 */
import { RotateCcw } from 'lucide-react';
import { COMMUNITY_NAME } from '../../../data';
import { DEFAULT_MEAL_CREDIT, guestCreditOn, mealCreditRules, mealCreditText, type MealCreditRules } from '../../../domain/config';
import { updateConfig, useConfig } from '../../../store/config';
import { Button, Tabs, Toggle, toast } from '../../../ui';
import { BoCallout, BoPage, BoRow, BoSection, NumberBox, useCommunity } from '../kit';
import type { BoPageProps } from '../nav';
import { ALL_COMMUNITIES } from '../seed/shell';
import s from './credits/credits.module.css';

const PARTS: Array<{ key: 'starters' | 'entrees' | 'sides' | 'desserts'; label: string; hint: string }> = [
  { key: 'starters', label: 'Starters', hint: 'Soups and starter salads' },
  { key: 'entrees', label: 'Entrées', hint: 'Mains, sandwiches and entrée salads' },
  { key: 'sides', label: 'Sides', hint: 'Swapping a default side for another keeps the count' },
  { key: 'desserts', label: 'Desserts', hint: 'Desserts and sweets' },
];

export default function Page({ goto }: BoPageProps) {
  const cfg = useConfig();
  const rules = mealCreditRules(cfg);
  const community = useCommunity();
  const set = (patch: Partial<MealCreditRules>) => updateConfig((c) => ({ mealCredit: { ...mealCreditRules(c), ...patch } }));
  const isDefault = (Object.keys(DEFAULT_MEAL_CREDIT) as Array<keyof MealCreditRules>).every((k) => rules[k] === DEFAULT_MEAL_CREDIT[k]);
  const onCount = ALL_COMMUNITIES.filter((c) => guestCreditOn(cfg, c));

  return (
    <BoPage
      title="Meal Credits"
      actions={
        <Button
          icon={<RotateCcw size={15} />}
          disabled={isDefault}
          onClick={() => {
            set(DEFAULT_MEAL_CREDIT);
            toast('Meal credit rules are back to the standard', { tone: 'success' });
          }}
        >
          Reset to standard
        </Button>
      }
    >
      <BoSection title="One meal credit covers" sub="Set a count to 0 to leave that course out of the credit; it is then always charged à la carte.">
        {PARTS.map((p) => (
          <BoRow key={p.key} label={p.label} hint={p.hint}>
            <NumberBox value={rules[p.key]} min={0} max={9} width={60} unit="per credit" aria-label={`${p.label} per credit`} onChange={(v) => v != null && v >= 0 && set({ [p.key]: Math.floor(v) })} />
          </BoRow>
        ))}
        <div className={s.preview}>
          <span className={s.previewLabel}>Servers see</span>
          {mealCreditText(rules)}
        </div>
      </BoSection>

      <BoSection title="Past one credit" sub="When a resident orders more than one credit covers.">
        <BoRow
          label="Extra sides are always à la carte"
          hint={
            rules.extraSidesAla
              ? `On: side ${rules.sides + 1} onward is charged at its à la carte price, never another credit.`
              : 'Off: extra sides count toward another credit like any other extra.'
          }
        >
          <Toggle checked={rules.extraSidesAla} onChange={(v) => set({ extraSidesAla: v })} label={<span className="sr-only">Extra sides are always à la carte</span>} />
        </BoRow>
        <BoRow label="Other extras start as" hint="A second entrée, another dessert ... The server can switch each line at close.">
          <Tabs
            variant="segmented"
            size="sm"
            aria-label="Other extras start as"
            value={rules.overflow}
            onChange={(v) => set({ overflow: v })}
            options={[
              { id: 'credit', label: 'Another credit' },
              { id: 'ala', label: 'À la carte' },
            ]}
          />
        </BoRow>
        <BoCallout tone="info">Proteins added to a salad and other add-ons are always charged on top of the credit.</BoCallout>
      </BoSection>

      <BoSection title="Guest meals on a resident's credit" sub="Where a resident can put a guest's meal on their own plan. It uses one of the host's meals.">
        {ALL_COMMUNITIES.map((c) => (
          <BoRow
            key={c}
            label={c}
            hint={c === community ? (c === COMMUNITY_NAME ? 'The community you are viewing, and the one these tablets serve' : 'The community you are viewing') : undefined}
          >
            <Toggle
              checked={guestCreditOn(cfg, c)}
              onChange={(v) => updateConfig((cur) => ({ guestCredit: { ...cur.guestCredit, [c]: v } }))}
              label={<span className="sr-only">Guest meal credits at {c}</span>}
            />
          </BoRow>
        ))}
        <p className={s.foot}>
          {onCount.length ? `On at ${onCount.join(', ')}.` : 'Off at every community.'} Plan types and their meal counts are in{' '}
          <button className={s.link} onClick={() => goto('plans')}>
            Meal Plans
          </button>
          .
        </p>
      </BoSection>
    </BoPage>
  );
}
