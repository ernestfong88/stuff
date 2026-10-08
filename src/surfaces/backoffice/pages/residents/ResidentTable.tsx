import type { MouseEvent } from 'react';
import { ChevronRight, TriangleAlert } from 'lucide-react';
import { avoidLabel } from '../../../../domain/allergens';
import { residentPills } from '../../../../domain/residents';
import type { Resident } from '../../../../domain/types';
import { isOnHospice } from '../../../../domain/waivers';
import { useConfig } from '../../../../store/config';
import { Avatar, Chip, Toggle } from '../../../../ui';
import { BoSelect, useBilling } from '../../kit';
import { useResidentRecords } from '../../kit/residentRecords';
import { careLevel, planStatus } from '../../../server/features/residents/residentInfo';
import type { BoMealPlan } from '../../seed/billing';
import type { BoResident } from '../../seed/residents';
import { unlistedAllergens } from './profileFilters';
import { changePlanWithUndo, toggleHospiceWithUndo } from './residentActions';
import s from './ResidentTable.module.css';

/** Tags shown before the rest fold into "+2". */
const SHOWN_PILLS = 3;

/** Clicks on a row's controls change that control, not open the resident. */
const keep = (e: MouseEvent) => e.stopPropagation();

/**
 * Allergies (red) then diets, the first few, with the rest as "+2" (all of
 * them on hover), and a red flag when the kitchen notes mention an allergen
 * the lists leave out (the tablets' allergy warnings only use the lists).
 */
export function DietChips({ resident, kitchenNotes }: { resident: Resident; kitchenNotes?: string }) {
  const pills = residentPills(resident);
  const unlisted = unlistedAllergens(resident, kitchenNotes);
  const flag = unlisted.length > 0 && (
    <Chip
      size="xs"
      tone="danger"
      solid
      icon={<TriangleAlert size={11} strokeWidth={2.6} />}
      title={`The kitchen notes mention ${unlisted.map((k) => avoidLabel(k).toLowerCase()).join(', ')}, which the allergy list doesn't carry`}
    >
      Notes: {unlisted.map((k) => avoidLabel(k).toLowerCase()).join(', ')}
    </Chip>
  );
  if (!pills.length) return flag ? <span className={s.chips}>{flag}</span> : <span className={s.none}>None</span>;
  const more = pills.slice(SHOWN_PILLS);
  return (
    <span className={s.chips}>
      {flag}
      {pills.slice(0, SHOWN_PILLS).map((p) => (
        <Chip
          key={p.kind + p.text}
          size="xs"
          tone={p.kind === 'allergy' ? 'danger' : 'neutral'}
          title={p.kind === 'allergy' ? `Allergy: ${p.text}` : p.text}
        >
          {p.text}
        </Chip>
      ))}
      {more.length > 0 && (
        <Chip size="xs" tone="outline" title={more.map((p) => p.text).join(', ')}>
          +{more.length}
        </Chip>
      )}
    </span>
  );
}

function Row({ r, rec, plans, onOpen }: { r: Resident; rec: BoResident | undefined; plans: BoMealPlan[]; onOpen: () => void }) {
  const cfg = useConfig();
  const { plan, left } = planStatus(r);
  const unit = left === 1 ? (plan.unit ?? 'meals').replace(/s$/, '') : (plan.unit ?? 'meals');
  const hospice = isOnHospice(r.id, cfg);
  // The care assessment's own wording, on hover.
  const onFile = [...(r.allergies ?? []), ...(r.diet ?? []), ...(r.foodPrep ? [`Food prep: ${r.foodPrep}`] : [])];
  return (
    <li className={s.row} onClick={onOpen}>
      <button type="button" className={s.who} title={`Open ${r.name}'s profile`}>
        <Avatar person={r} size={34} />
        <span className={s.whoText}>
          <span className={s.name}>{r.name}</span>
          <span className={s.sub}>
            <span className={s.aptLevel}>
              Apt {r.apt} · {r.level} ·{' '}
            </span>
            {left != null ? `${left} ${unit} left` : 'à la carte'}
          </span>
        </span>
      </button>
      <span className={s.apt}>{r.apt}</span>
      <span className={s.level} title={careLevel(r.level)}>
        {r.level}
      </span>
      <span className={s.plan} onClick={keep}>
        {rec ? (
          <BoSelect
            className={s.select}
            aria-label={`Meal plan, ${r.name}`}
            value={rec.planId}
            onChange={(e) => changePlanWithUndo(r.id, r.name, e.target.value)}
          >
            {!plans.some((p) => p.id === rec.planId) && <option value={rec.planId}>No plan</option>}
            {plans
              .filter((p) => p.active || p.id === rec.planId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.text}
                </option>
              ))}
          </BoSelect>
        ) : (
          <span className={s.none}>No billing record</span>
        )}
      </span>
      <span className={s.hospice} onClick={keep}>
        <Toggle
          checked={hospice}
          onChange={(on) => toggleHospiceWithUndo(r.id, r.name, on, cfg)}
          label={<span className="sr-only">Hospice, {r.name}</span>}
        />
      </span>
      <span className={s.diets} title={onFile.length ? `On file: ${onFile.join('; ')}` : undefined}>
        <DietChips resident={r} kitchenNotes={rec?.kitchenNotes} />
      </span>
      <ChevronRight size={16} className={s.chev} aria-hidden />
    </li>
  );
}

/**
 * The Resident Dining Profile list: each resident's meal plan (changed
 * right here, logged for billing), hospice switch, and allergies and diets.
 * The rest of the row opens the profile.
 */
export function ResidentTable({ list, onOpen }: { list: Resident[]; onOpen: (id: string) => void }) {
  const records = useResidentRecords();
  const { plans } = useBilling();
  return (
    <div className={s.wrap}>
      <div className={s.head} aria-hidden>
        <span className={s.hWho}>Resident</span>
        <span className={s.apt}>Apt</span>
        <span className={s.level}>Level</span>
        <span className={s.plan}>Meal plan</span>
        <span className={s.hospice}>Hospice</span>
        <span className={s.diets}>Diets & allergies</span>
      </div>
      <ul className={s.list} aria-label="Residents">
        {list.map((r) => (
          <Row key={r.id} r={r} rec={records.find((x) => x.id === r.id && x.name === r.name)} plans={plans} onOpen={() => onOpen(r.id)} />
        ))}
      </ul>
    </div>
  );
}
