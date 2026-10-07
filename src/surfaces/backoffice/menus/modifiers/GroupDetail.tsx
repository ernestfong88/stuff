import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { BoModGroup, ModRuleEdit } from '../../../../store/menuEdits';
import { Button, Toggle, toast } from '../../../../ui';
import { RULE_DEFAULTS, updateBo, useBo } from '../data';
import { categoryWithSub, dishLong } from '../model/categories';
import { resolveRule, ruleText } from '../model/modRules';
import { Input, MoneyInput } from '../ui/controls';
import s from './GroupDetail.module.css';

const money = (v?: number) => (v ? '+$' + v.toFixed(2).replace(/\.00$/, '') : 'Included');

/** One modifier group: its name, choices, ordering rules and the recipes it is pinned to. */
export function GroupDetail({ group: g, onChange, onRetire }: { group: BoModGroup; onChange: (fn: (g: BoModGroup) => BoModGroup) => void; onRetire: () => void }) {
  const bo = useBo();
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState<number | null>(null);
  const [pinQ, setPinQ] = useState('');

  const upCharged = g.mods.filter((m) => (m.price ?? 0) > 0).length;
  const addChoice = () => {
    const n = newName.trim();
    if (!n) return;
    if (g.mods.some((m) => m.n.toLowerCase() === n.toLowerCase())) {
      toast('Already in this group', { tone: 'warning' });
      return;
    }
    onChange((x) => ({ ...x, mods: [...x.mods, newPrice ? { n, price: newPrice } : { n }] }));
    setNewName('');
    setNewPrice(null);
  };
  const q = pinQ.trim().toLowerCase();
  const pinHits =
    q.length > 1
      ? bo.recipes.filter((r) => !r.retired && !g.pinned.includes(r.id) && (r.name.toLowerCase().includes(q) || dishLong(r.name).toLowerCase().includes(q))).slice(0, 8)
      : [];
  const nameOf = (id: string) => {
    const r = bo.recipes.find((x) => x.id === id);
    return r ? dishLong(r.name) : id;
  };

  return (
    <div className={s.detail}>
      <section className={s.card}>
        <div className={s.titleRow}>
          <input className={s.title} aria-label="Group name" value={g.name} onChange={(e) => onChange((x) => ({ ...x, name: e.target.value }))} />
          <Button size="sm" variant="softDanger" icon={<Trash2 size={14} />} onClick={onRetire}>
            Retire group
          </Button>
        </div>
        <p className={s.summary}>
          {[
            g.mods.length + (g.mods.length === 1 ? ' choice' : ' choices'),
            upCharged ? upCharged + ' with an up-charge' : null,
            'used ' + g.usage90 + ' times in 90 days',
            g.pinned.length ? 'pinned to ' + g.pinned.length + (g.pinned.length === 1 ? ' recipe' : ' recipes') : 'not pinned',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </section>

      <section className={s.card}>
        <h3 className={s.label}>Choices</h3>
        <ol className={s.choices}>
          {g.mods.map((m, i) => (
            <li key={i} className={s.choice}>
              <span className={s.idx}>{i + 1}</span>
              <input
                className={s.choiceName}
                aria-label={`Choice ${i + 1}`}
                value={m.n}
                onChange={(e) => onChange((x) => ({ ...x, mods: x.mods.map((o, j) => (j === i ? { ...o, n: e.target.value } : o)) }))}
              />
              <MoneyInput
                value={m.price ?? null}
                placeholder="Included"
                width={110}
                aria-label={`Up-charge for ${m.n}`}
                onChange={(v) =>
                  onChange((x) => ({
                    ...x,
                    mods: x.mods.map((o, j) => (j === i ? (v ? { n: o.n, price: v } : { n: o.n }) : o)),
                  }))
                }
              />
              <button className={s.remove} aria-label={`Remove ${m.n}`} onClick={() => onChange((x) => ({ ...x, mods: x.mods.filter((_, j) => j !== i) }))}>
                <X size={14} />
              </button>
            </li>
          ))}
          {!g.mods.length && <li className={s.none}>No choices yet. Add the first one below.</li>}
        </ol>
        <div className={s.addRow}>
          <Input
            size="sm"
            className={s.grow}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addChoice()}
            placeholder="Add a choice, e.g. Sourdough"
            aria-label="New choice"
          />
          <MoneyInput value={newPrice} onChange={setNewPrice} placeholder="Up-charge" width={110} aria-label="Up-charge for the new choice" onKeyDown={(e) => e.key === 'Enter' && addChoice()} />
          <Button size="sm" variant="primary" iconOnly icon={<Plus size={15} />} aria-label="Add choice" disabled={!newName.trim()} onClick={addChoice} />
        </div>
        <p className={s.note}>Servers choose Add, No, Sub, Extra, Light or On the side when they order.</p>
      </section>

      <RulesCard group={g} />

      <section className={s.card}>
        <h3 className={s.label}>Pinned to recipes · shown first when these are ordered</h3>
        <div className={s.pins}>
          {g.pinned.map((id) => (
            <span key={id} className={s.pin}>
              {nameOf(id)}
              <button aria-label={`Unpin ${nameOf(id)}`} onClick={() => onChange((x) => ({ ...x, pinned: x.pinned.filter((p) => p !== id) }))}>
                <X size={12} />
              </button>
            </span>
          ))}
          {!g.pinned.length && <span className={s.none}>Not pinned. Servers find it in the modifier list by how often it is used.</span>}
        </div>
        <div className={s.pinSearch}>
          <Input size="sm" value={pinQ} onChange={(e) => setPinQ(e.target.value)} placeholder="Pin a recipe: type a dish name" aria-label="Pin a recipe" />
          {pinHits.length > 0 && (
            <div className={s.hits}>
              {pinHits.map((r) => (
                <button
                  key={r.id}
                  className={s.hit}
                  onClick={() => {
                    onChange((x) => ({ ...x, pinned: [...x.pinned, r.id] }));
                    setPinQ('');
                    toast('Pinned to ' + dishLong(r.name), { tone: 'success' });
                  }}
                >
                  <span className={s.hitName}>{dishLong(r.name)}</span>
                  <span className={s.hitCat}>{categoryWithSub(r)}</span>
                </button>
              ))}
            </div>
          )}
          {q.length > 1 && !pinHits.length && <div className={s.none}>No recipe matches.</div>}
        </div>
      </section>

      <section className={s.preview} aria-label="Preview on the server tablet">
        <div className={s.previewLabel}>On the server tablet</div>
        <div className={s.previewTitle}>{g.name || 'Untitled group'}</div>
        <div className={s.previewChips}>
          {g.mods.map((m, i) => (
            <span key={i} className={s.previewChip}>
              {m.n}
              {(m.price ?? 0) > 0 && <span className={s.previewPrice}>{money(m.price)}</span>}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Required, how many picks, how many included and the charge past that. */
function RulesCard({ group: g }: { group: BoModGroup }) {
  const bo = useBo();
  const edit = bo.modRules[g.id] ?? {};
  const rule = resolveRule(RULE_DEFAULTS[g.id], edit);
  const set = (patch: ModRuleEdit) => updateBo((st) => ({ modRules: { ...st.modRules, [g.id]: { ...st.modRules[g.id], ...patch } } }));
  const num = (v: string) => (v === '' ? 0 : Math.max(0, Math.round(Number(v))));
  return (
    <section className={s.card}>
      <div className={s.rulesHead}>
        <h3 className={s.label}>Ordering rules</h3>
        <span className={s.ruleText}>{ruleText(rule)}</span>
        {bo.modRules[g.id] && (
          <button
            className={s.link}
            onClick={() =>
              updateBo((st) => {
                const next = { ...st.modRules };
                delete next[g.id];
                return { modRules: next };
              })
            }
          >
            Use the default
          </button>
        )}
      </div>
      <div className={s.rules}>
        <Toggle checked={rule.required} onChange={(v) => set({ req: v, min: v ? Math.max(1, rule.min) : 0 })} label="Required" />
        <label className={s.ruleField}>
          <span>Pick up to</span>
          <Input size="sm" type="number" min={0} value={rule.max || ''} placeholder="Any" onChange={(e) => set({ max: num(e.target.value) })} className={s.ruleNum} />
        </label>
        <label className={s.ruleField}>
          <span>Included</span>
          <Input
            size="sm"
            type="number"
            min={0}
            value={rule.included ?? ''}
            placeholder="0"
            onChange={(e) => set({ incl: e.target.value === '' ? null : num(e.target.value) })}
            className={s.ruleNum}
          />
        </label>
        <label className={s.ruleField}>
          <span>Then each</span>
          <MoneyInput value={rule.extra || null} placeholder="Free" width={96} onChange={(v) => set({ extra: v ?? 0 })} aria-label="Charge for each extra pick" />
        </label>
      </div>
      <div className={s.rules}>
        <label className={s.ruleWide}>
          <span>The kiosk asks</span>
          <Input size="sm" value={rule.ask} placeholder={`Choose from ${g.name}`} onChange={(e) => set({ ask: e.target.value })} />
        </label>
        <label className={s.ruleField}>
          <span>Short label</span>
          <Input size="sm" value={rule.label} placeholder={g.name} onChange={(e) => set({ lbl: e.target.value })} className={s.ruleLabel} />
        </label>
      </div>
      <p className={s.note}>The kiosk asks each pinned group as its own step and the server&apos;s Modify screen holds to the same rules. A group with no rule stays free and open.</p>
    </section>
  );
}
