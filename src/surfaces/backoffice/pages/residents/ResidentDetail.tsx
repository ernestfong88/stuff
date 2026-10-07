import { ArrowLeft, Info } from 'lucide-react';
import { now } from '../../../../lib/clock';
import { formatTime } from '../../../../lib/format';
import { residentPref, updateResidentPref, useResidentPrefs } from '../../../../store/residentPrefs';
import { Button, Chip, TextArea, toast } from '../../../../ui';
import { BoCallout, BoField, BoPage, BoSection, BoSelect, NumberBox, updateResidentRecord, useBilling, useResidentRecords } from '../../kit';
import { BACK_OFFICE_USER } from '../../seed/associates';
import { diningResident, type BoResident } from '../../seed/residents';
import { HospiceCard } from './HospiceCard';
import { RecentOrders } from './RecentOrders';
import s from './residents.module.css';

const dayValue = (v: number | null) => (v == null ? null : Math.min(28, Math.max(1, Math.round(v))));

export function ResidentDetail({ resident: r, onBack, goto }: { resident: BoResident; onBack: () => void; goto: (pageId: string) => void }) {
  const { plans } = useBilling();
  const records = useResidentRecords();
  const prefs = useResidentPrefs();
  const dining = diningResident(r);
  const spouse = records.find((x) => x.id === r.spouseId);
  const plan = plans.find((p) => p.id === r.planId);
  // The tablets' resident list is what reaches the kitchen ticket, so prefer it.
  const allergies = dining?.allergies ?? r.allergies;
  const diet = [...(dining?.diet ?? r.diet), ...(dining?.foodPrep ? [`Food prep: ${dining.foodPrep}`] : [])];
  const set = (patch: Partial<BoResident>) => updateResidentRecord(r.id, patch);
  // The dining tablets read preferences from the shared store, so a change here shows at the table.
  const prefText = dining ? residentPref({ [r.id]: r.prefs, ...prefs }, r.id) : r.prefs;
  const setPref = (text: string) => (dining ? updateResidentPref(r.id, text) : set({ prefs: text }));

  const changePlan = (planId: string) => {
    const to = plans.find((p) => p.id === planId);
    set({ planId, planLog: [{ at: now(), by: BACK_OFFICE_USER.name, from: plan?.text ?? 'No plan', to: to?.text ?? planId }, ...(r.planLog ?? [])].slice(0, 10) });
    toast(`Plan changed to ${to?.text}. The change is recorded for billing.`, { tone: 'success' });
  };

  return (
    <BoPage
      title={r.name}
      sub={`Apt ${r.apt} · ${r.level}${spouse ? ` · spouse: ${spouse.name}` : ''}`}
      actions={
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={onBack}>
          All residents
        </Button>
      }
    >
      <div className={s.grid}>
        <div className={s.col}>
          <BoSection title="Meal plan" sub="Plan changes drive billing, so every change is recorded.">
            <div className={s.form}>
              <BoField label="Plan">
                {(id) => (
                  <BoSelect id={id} value={r.planId} onChange={(e) => changePlan(e.target.value)}>
                    {plans
                      .filter((p) => p.active || p.id === r.planId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.text} ({p.type})
                        </option>
                      ))}
                  </BoSelect>
                )}
              </BoField>
              {plan?.type === 'Monthly $' ? (
                <BoCallout tone="info">
                  <span className={s.inline}>
                    <Info size={15} aria-hidden />
                    <span>
                      Dollar spend-down: the balance is pooled across the couple's account{spouse ? ` (shared with ${spouse.name.split(' ')[0]})` : ''} and goes down with each charge.
                    </span>
                  </span>
                </BoCallout>
              ) : (
                <div className={s.days}>
                  <BoField label="Meal start day" hint="The day the billing cycle starts (1 to 28), not always the 1st">
                    {(id) => <NumberBox id={id} value={r.startDay} min={1} max={28} onChange={(v) => v != null && set({ startDay: dayValue(v) ?? 1 })} />}
                  </BoField>
                  <BoField label="Couple start day" hint="Used at checkout for a couple's shared meals">
                    {(id) => <NumberBox id={id} value={r.coupleStartDay} min={1} max={28} placeholder="—" onChange={(v) => set({ coupleStartDay: dayValue(v) })} />}
                  </BoField>
                </div>
              )}
              {(r.planLog?.length ?? 0) > 0 && (
                <ul className={s.audit}>
                  {r.planLog!.slice(0, 3).map((e, i) => (
                    <li key={i}>
                      {e.from} → {e.to} · {e.by}, {new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {formatTime(e.at)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </BoSection>

          <BoSection title="Diet and allergies" sub="Read only. These come from the care assessment.">
            <div className={s.chips}>
              {allergies.map((a) => (
                <Chip key={a} tone="danger">
                  Allergy: {a}
                </Chip>
              ))}
              {diet.map((d) => (
                <Chip key={d} tone="success">
                  {d}
                </Chip>
              ))}
              {allergies.length + diet.length === 0 && <span className={s.muted}>Nothing on file.</span>}
            </div>
            <button className={s.link} onClick={() => goto('resDiets')}>
              See everyone's allergies and diets
            </button>
          </BoSection>
        </div>

        <div className={s.col}>
          <BoSection>
            <div className={s.form}>
              <TextArea label="Dining preferences" hint="Servers see this at the table." rows={2} value={prefText} onChange={(e) => setPref(e.target.value)} />
              <TextArea label="Kitchen notes" hint="The cook line sees this on every ticket." rows={2} value={r.kitchenNotes} onChange={(e) => set({ kitchenNotes: e.target.value })} />
            </div>
          </BoSection>
          {dining ? (
            <HospiceCard rid={r.id} name={r.name} />
          ) : (
            <BoSection title="Hospice" sub={`${r.name} is not on the dining tablets' resident list, so hospice can't be set here yet.`} />
          )}
          <RecentOrders residentId={dining ? r.id : null} />
        </div>
      </div>
    </BoPage>
  );
}
