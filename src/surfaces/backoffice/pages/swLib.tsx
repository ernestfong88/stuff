import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { BoPageProps } from '../nav';
import { BoPage, BoSection } from '../kit';
import { uid } from '../../../lib/id';
import {
  SIDE_WORK_WHEN,
  isLibraryEdited,
  libraryFor,
  parseTaskMinutes,
  resetSideWorkLibrary,
  saveSideWorkLibrary,
  sideWorkVenues,
  useSideWork,
  type SideWorkTask,
  type SideWorkWhen,
} from '../../../store/sideWork';
import { Button, Tabs, toast } from '../../../ui';
import s from './swLib.module.css';

function WhenSelect({ value, onChange, label }: { value: SideWorkWhen; onChange: (v: SideWorkWhen) => void; label: string }) {
  return (
    <select className={s.select} value={value} aria-label={label} onChange={(e) => onChange(e.target.value as SideWorkWhen)}>
      {SIDE_WORK_WHEN.map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** A text box that saves when it loses focus (or on Enter). */
function SaveOnBlur({
  value,
  onSave,
  label,
  placeholder,
  required,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <input
      key={value}
      className={`${s.input} ${className ?? ''}`}
      defaultValue={value}
      aria-label={label}
      placeholder={placeholder}
      maxLength={120}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (required && !v) {
          e.target.value = value;
          return;
        }
        if (v !== value) onSave(v);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

/** Side Work Tasks: each venue's side work library, in the order servers see it. */
export default function Page(_props: BoPageProps) {
  const state = useSideWork();
  const venues = sideWorkVenues();
  const [venue, setVenue] = useState(venues[0]?.id ?? 'sequoia');
  const [draft, setDraft] = useState({ name: '', note: '', when: 'close' as SideWorkWhen, mins: '' });
  const library = libraryFor(state, venue);
  const vname = venues.find((v) => v.id === venue)?.name ?? venue;
  const total = library.reduce((a, t) => a + (t.mins ?? 0), 0);

  const save = (next: SideWorkTask[]) => saveSideWorkLibrary(venue, next);
  const update = (id: string, patch: Partial<SideWorkTask>) => save(library.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= library.length) return;
    const next = [...library];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const add = () => {
    const name = draft.name.trim();
    if (!name) return;
    save([...library, { id: uid('sw'), name, note: draft.note.trim(), when: draft.when, mins: parseTaskMinutes(draft.mins) }]);
    setDraft({ ...draft, name: '', note: '', mins: '' });
    toast(`${name} added to ${vname}`, { tone: 'success' });
  };

  return (
    <BoPage
      title="Side Work Tasks"
      sub="Each venue's side work. Opening, Mid and Closing go with a shift; Breakfast, Lunch and Dinner go with whoever works that meal. Minutes are optional and add up to each person's load. Hand them out each day under Assign Side Work."
      actions={
        isLibraryEdited(state, venue) && (
          <Button
            variant="ghost"
            onClick={() => {
              resetSideWorkLibrary(venue);
              toast(`${vname} is back to the starter list`);
            }}
          >
            Reset to the starter list
          </Button>
        )
      }
    >
      <div className={s.venues}>
        <Tabs variant="segmented" aria-label="Venue" value={venue} onChange={setVenue} options={venues.map((v) => ({ id: v.id, label: v.name }))} />
      </div>
      <BoSection
        title={`${vname} side work`}
        sub={`${library.length} ${library.length === 1 ? 'task' : 'tasks'}${total ? ` · about ${total} min in all` : ''}`}
      >
        <div className={s.head} aria-hidden>
          <span>Task and short instruction</span>
          <span className={s.headRight}>Shift or meal · minutes</span>
        </div>
        {library.map((t, i) => (
          <div key={t.id} className={s.row}>
            <div className={s.texts}>
              <SaveOnBlur value={t.name} label="Task name" placeholder="Task" required className={s.name} onSave={(v) => update(t.id, { name: v })} />
              <SaveOnBlur
                value={t.note}
                label={`Instruction for ${t.name}`}
                placeholder="Short instruction (optional)"
                className={s.note}
                onSave={(v) => update(t.id, { note: v })}
              />
            </div>
            <div className={s.controls}>
              <WhenSelect value={t.when} label={`Shift or meal for ${t.name}`} onChange={(v) => update(t.id, { when: v })} />
              <input
                key={String(t.mins)}
                type="number"
                min={0}
                max={240}
                className={`${s.input} ${s.mins}`}
                defaultValue={t.mins ?? ''}
                aria-label={`Minutes for ${t.name}`}
                placeholder="min"
                onBlur={(e) => {
                  const v = parseTaskMinutes(e.target.value);
                  if (v !== t.mins) update(t.id, { mins: v });
                }}
              />
              <span className={s.unit}>min</span>
              <span className={s.actions}>
                <Button size="sm" iconOnly aria-label={`Move ${t.name} up`} disabled={i === 0} onClick={() => move(i, -1)} icon={<ArrowUp size={14} />} />
                <Button
                  size="sm"
                  iconOnly
                  aria-label={`Move ${t.name} down`}
                  disabled={i === library.length - 1}
                  onClick={() => move(i, 1)}
                  icon={<ArrowDown size={14} />}
                />
                <Button
                  size="sm"
                  variant="softDanger"
                  iconOnly
                  aria-label={`Delete ${t.name}`}
                  icon={<Trash2 size={14} />}
                  onClick={() => {
                    save(library.filter((x) => x.id !== t.id));
                    toast(`${t.name} deleted`, { action: { label: 'Undo', onClick: () => save(library) } });
                  }}
                />
              </span>
            </div>
          </div>
        ))}
        {!library.length && <p className={s.empty}>No side work yet. Add the first task below.</p>}
        <div className={`${s.row} ${s.addRow}`}>
          <div className={s.texts}>
            <input
              className={s.input}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="New task, e.g. Polish water pitchers"
              aria-label="New task name"
              maxLength={120}
            />
            <input
              className={`${s.input} ${s.note}`}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Short instruction (optional)"
              aria-label="New task instruction"
              maxLength={120}
            />
          </div>
          <div className={s.controls}>
            <WhenSelect value={draft.when} label="New task shift or meal" onChange={(v) => setDraft({ ...draft, when: v })} />
            <input
              type="number"
              min={0}
              max={240}
              className={`${s.input} ${s.mins}`}
              value={draft.mins}
              onChange={(e) => setDraft({ ...draft, mins: e.target.value })}
              placeholder="min"
              aria-label="New task minutes"
            />
            <span className={s.unit}>min</span>
            <span className={s.actions}>
              <Button variant="primary" size="sm" icon={<Plus size={14} />} disabled={!draft.name.trim()} onClick={add}>
                Add task
              </Button>
            </span>
          </div>
        </div>
      </BoSection>
    </BoPage>
  );
}
