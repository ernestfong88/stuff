import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronLeft, X } from 'lucide-react';
import type { Diner, MenuItem, ModSelection, Resident } from '../../../../domain/types';
import { useDining } from '../../../../store/dining';
import { Button, cx } from '../../../../ui';
import {
  ACTIONS,
  groupFull,
  groupsForItem,
  hasRule,
  missingRequired,
  modsFromPicks,
  pickedCount,
  picksFromMods,
  ruleText,
  togglePick,
  groupRule,
  type ModPick,
} from './modifiers';
import s from './ModifierEditor.module.css';

/**
 * Change how an item is made. Adding a new item asks before it goes on the
 * check; editing a line already on it (`onAuto`) saves as you go.
 */
export function ModifierEditor({
  item,
  diner,
  person,
  initialMods,
  initialNote,
  confirmLabel,
  onCancel,
  onConfirm,
  onAuto,
}: {
  item: MenuItem;
  diner: Diner;
  person: Resident | undefined;
  initialMods?: ModSelection;
  initialNote?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (mods: ModSelection, note: string) => void;
  /** Save each change as it happens (the line is already on the check). */
  onAuto?: (mods: ModSelection, note: string) => void;
}) {
  const { usageFor, recordModUsage } = useDining();
  const [picks, setPicks] = useState<ModPick[]>(() => picksFromMods(initialMods));
  const [action, setAction] = useState('Add');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [note, setNote] = useState(initialNote ?? '');
  const editing = !!onAuto;

  // Editing saves as you go, 350 ms after the last change, and on leaving.
  const pending = useRef<[ModSelection, string] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const first = useRef(true);
  const autoRef = useRef(onAuto);
  autoRef.current = onAuto;
  useEffect(() => {
    if (!editing) return;
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = [modsFromPicks(item.id, picks), note];
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pending.current) autoRef.current?.(...pending.current);
      pending.current = null;
    }, 350);
  }, [picks, note, editing, item.id]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current) autoRef.current?.(...pending.current);
    },
    [],
  );

  const usage = usageFor(item.id);
  const { top, more } = groupsForItem(item.id, usage);
  const missing = missingRequired(item.id, picks);
  const price = diner.kind === 'resident' && !diner.isGuest ? item.residentPrice : item.guestPrice;
  const conflicts = item.allergens.filter((a) => person?.allergies?.includes(a));

  const confirm = () => {
    if (missing && !editing) return;
    clearTimeout(timer.current);
    pending.current = null;
    for (const p of picks) if (p.group) recordModUsage(item.id, p.group);
    onConfirm(modsFromPicks(item.id, picks), note);
  };

  const options = (groupId: string, mods: string[], light: boolean) => (
    <div className={s.options}>
      {[...mods].sort().map((m) => {
        const picked = picks.find((p) => p.name === m);
        return (
          <button
            key={m}
            className={cx(s.option, light && s.optionLight, picked && s.optionOn, !picked && groupFull(picks, groupId, action) && s.optionDim)}
            aria-pressed={!!picked}
            onClick={() => setPicks((ps) => togglePick(ps, groupId, m, action))}
          >
            {picked ? picked.label : m}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={cx(s.editor, 'fade-in')}>
      <button className={s.back} onClick={onCancel}>
        <ChevronLeft size={19} strokeWidth={2.5} aria-hidden /> Back to menu
      </button>
      <div className={s.titleRow}>
        <h3 className={s.title}>{item.name}</h3>
        {price > 0 && <span className={s.price}>${price}</span>}
      </div>
      {item.desc && <p className={s.desc}>{item.desc}</p>}
      {conflicts.length > 0 && (
        <div className={s.allergy} role="alert">
          <AlertTriangle size={14} aria-hidden /> {person?.name.split(' ')[0]} is allergic to {conflicts.join(', ').toLowerCase()}. Confirm before sending.
        </div>
      )}
      {picks.length > 0 && (
        <div className={s.picked}>
          {picks.map((p) => (
            <button key={p.name} className={s.pick} title={'Remove ' + p.label} onClick={() => setPicks((ps) => ps.filter((x) => x.name !== p.name))}>
              {p.label}
              <span className={s.pickX}>
                <X size={15} strokeWidth={2.75} aria-hidden />
              </span>
            </button>
          ))}
        </div>
      )}
      <div className={s.eyebrow}>Action</div>
      <div className={s.actions} role="radiogroup" aria-label="Action">
        {ACTIONS.map((a) => (
          <button key={a} role="radio" aria-checked={action === a} className={cx(s.action, action === a && s.actionOn)} onClick={() => setAction(a)}>
            {a}
          </button>
        ))}
      </div>
      <div className={s.eyebrow}>Most used with this item</div>
      <div className={s.groups}>
        {top.map((g) => {
          const r = groupRule(g.id);
          const n = pickedCount(picks, g.id);
          return (
            <div key={g.id}>
              <div className={s.groupHead}>
                <span className={s.groupName}>{g.name}</span>
                {hasRule(g.id) && (
                  <span className={cx(s.rule, r.required && !n && s.ruleMissing)}>
                    {ruleText(g.id) + (r.max !== 1 && n ? ` · ${n}${r.max ? ` of ${r.max}` : ''} chosen` : '')}
                  </span>
                )}
                {(usage[g.id] || 0) > 0 && <span className={s.usage}>×{usage[g.id]} this quarter</span>}
              </div>
              {options(g.id, g.mods, false)}
            </div>
          );
        })}
      </div>
      <button className={s.more} onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
        {showAll ? 'Hide other groups' : `View all groups (${more.length} more)`}
        <ChevronDown size={14} strokeWidth={2.5} className={cx(s.chev, showAll && s.chevUp)} aria-hidden />
      </button>
      {showAll && (
        <div className={cx(s.accordion, 'fade-in')}>
          {more.map((g) => {
            const open = openGroup === g.id;
            const n = picks.filter((p) => p.group === g.id).length;
            return (
              <div key={g.id} className={s.fold}>
                <button className={s.foldHead} aria-expanded={open} onClick={() => setOpenGroup(open ? null : g.id)}>
                  <span className={s.foldName}>{g.name}</span>
                  {n > 0 && <span className={s.foldCount}>{n}</span>}
                  {(usage[g.id] || 0) > 0 && <span className={s.usage}>×{usage[g.id]}</span>}
                  <ChevronDown size={15} className={cx(s.chev, open && s.chevUp)} aria-hidden />
                </button>
                {open && <div className={s.foldBody}>{options(g.id, g.mods, true)}</div>}
              </div>
            );
          })}
        </div>
      )}
      <input className={s.note} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to kitchen (optional)" aria-label="Note to kitchen" />
      {editing ? (
        <div className={s.footer}>
          <span className={cx(s.status, missing && s.statusMissing)}>{missing ? missing.replace(' before adding it.', '') : 'Changes save as you go.'}</span>
          <Button variant="primary" size="lg" className={s.grow} onClick={confirm}>
            Done
          </Button>
        </div>
      ) : (
        <div className={s.footer}>
          {missing && <div className={s.missing}>{missing}</div>}
          <Button size="lg" variant="ghost" className={cx(s.grow, s.cancel)} onClick={onCancel}>
            Cancel
          </Button>
          <Button size="lg" variant="primary" className={s.grow2} aria-disabled={!!missing} onClick={confirm}>
            {confirmLabel ?? 'Add to order'}
            {picks.length ? ` · ${picks.length} mod${picks.length !== 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      )}
    </div>
  );
}
