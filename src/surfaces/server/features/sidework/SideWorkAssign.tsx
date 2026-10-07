import { useState, type DragEvent } from 'react';
import { Check } from 'lucide-react';
import { serverColor } from '../../../../domain/servers';
import { formatDayShort, formatTime } from '../../../../lib/format';
import { safeStorage } from '../../../../lib/storage';
import { today } from '../../../../lib/clock';
import { useVenue } from '../../../../shell/session';
import {
  assignSideWork,
  autoAssignSideWork,
  clearSideWork,
  dayFor,
  libraryFor,
  shiftTime,
  sideWorkStore,
  sideWorkVenues,
  staffOnShift,
  useSideWork,
  whenLabel,
  type ShiftPerson,
  type SideWorkTask,
} from '../../../../store/sideWork';
import { Button, Tabs, cx, toast } from '../../../../ui';
import s from './SideWorkAssign.module.css';

const VENUE_KEY = 'kisco_sw_venue';
const POOL = 'pool';

function useAssignVenue(): [string, (v: string) => void] {
  const [deviceVenue] = useVenue();
  const [venue, setVenue] = useState(() => {
    const saved = safeStorage.get(VENUE_KEY);
    return saved && sideWorkVenues().some((v) => v.id === saved) ? saved : deviceVenue;
  });
  return [
    venue,
    (v) => {
      setVenue(v);
      safeStorage.set(VENUE_KEY, v);
    },
  ];
}

/**
 * Assign Side Work, the same view in Back Office and on the manager tablet.
 * Tap a task, then a person (or Not assigned to take it back), or drag it
 * there. A checked off task stays put and shows its time.
 */
export function SideWorkAssign() {
  const state = useSideWork();
  const [venue, setVenue] = useAssignVenue();
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const venues = sideWorkVenues();
  const vname = venues.find((v) => v.id === venue)?.name ?? venue;
  const library = libraryFor(state, venue);
  const people = staffOnShift(venue);
  const day = dayFor(state, venue);
  const onShift = new Set(people.map((p) => p.id));
  const owner = (t: SideWorkTask) => (onShift.has(day.asg[t.id]) ? day.asg[t.id] : null);
  const pool = library.filter((t) => !owner(t));
  const tasksOf = (id: string) => library.filter((t) => owner(t) === id);
  const loads = people.map((p) => tasksOf(p.id).reduce((a, t) => a + (t.mins ?? 0), 0));
  const maxLoad = Math.max(1, ...loads);
  const selTask = selected ? library.find((t) => t.id === selected) : undefined;

  const pickVenue = (v: string) => {
    setVenue(v);
    setSelected(null);
    setMsg('');
  };

  const give = (taskId: string, staffId: string | null) => {
    const t = library.find((x) => x.id === taskId);
    setSelected(null);
    if (!t || day.done[taskId] || owner(t) === staffId) return;
    assignSideWork(venue, taskId, staffId);
    const p = people.find((x) => x.id === staffId);
    setMsg(p ? `${t.name} is now ${p.first}'s` : `${t.name} is back in Not assigned`);
  };

  const dropTarget = (staffId: string | null) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setOver(staffId ?? POOL);
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(null);
      const id = e.dataTransfer.getData('text/plain');
      if (id) give(id, staffId);
    },
  });

  const auto = () => {
    const n = autoAssignSideWork(venue);
    setSelected(null);
    setMsg(
      n
        ? `Spread ${n} task${n === 1 ? '' : 's'} across the ${people.length} on shift. Tap a task, then a person, to move one.`
        : 'Every task already has someone.',
    );
  };

  const clear = () => {
    const before = sideWorkStore.get();
    clearSideWork(venue);
    setSelected(null);
    setMsg('Assignments cleared. Checked off tasks stay with whoever did them.');
    toast('Side work assignments cleared', {
      action: {
        label: 'Undo',
        onClick: () => {
          sideWorkStore.set(before);
          setMsg('Assignments are back.');
        },
      },
    });
  };

  const taskChip = (t: SideWorkTask, wide?: boolean) => {
    const done = day.done[t.id];
    const isSel = selected === t.id;
    return (
      <button
        key={t.id}
        type="button"
        draggable={!done}
        aria-pressed={isSel}
        aria-disabled={!!done}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', t.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!done) setSelected(isSel ? null : t.id);
        }}
        title={done ? `Done at ${formatTime(done.at)}` : t.note || t.name}
        className={cx(s.task, wide && s.taskWide, done && s.taskDone, isSel && s.taskSel)}
      >
        {done && (
          <span className={s.tick} aria-hidden>
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        <span className={s.taskText}>
          <span className={s.taskName}>{t.name}</span>
          <span className={s.taskMeta}>
            {done ? `Done ${formatTime(done.at)}` : whenLabel(t.when) + (t.mins ? ` · ${t.mins} min` : '')}
          </span>
        </span>
      </button>
    );
  };

  const personCard = (p: ShiftPerson, i: number) => {
    const mine = tasksOf(p.id);
    const done = mine.filter((t) => day.done[t.id]).length;
    const hot = over === p.id || (!!selTask && owner(selTask) !== p.id);
    const giveHere = () => {
      if (selected) give(selected, p.id);
    };
    return (
      <div
        key={p.id}
        {...dropTarget(p.id)}
        onClick={giveHere}
        className={cx(s.person, hot && s.hot, over === p.id && s.over, selTask && s.clickable)}
      >
        <div className={s.personHead}>
          <span className={s.initials} style={{ background: serverColor(p.id) }} aria-hidden>
            {p.id}
          </span>
          <div className={s.personText}>
            <div className={s.personName}>{p.name}</div>
            <div className={s.personShift}>
              {shiftTime(p.start)} to {shiftTime(p.end)} · {whenLabel(p.tag)}
            </div>
          </div>
        </div>
        <div>
          <div className={s.load}>
            <span>
              {mine.length} {mine.length === 1 ? 'task' : 'tasks'} · {loads[i]} min
            </span>
            {done > 0 && <span className={s.loadDone}>{done} done</span>}
          </div>
          <div className={s.loadTrack} aria-hidden>
            <div className={s.loadFill} style={{ width: `${Math.round((loads[i] / maxLoad) * 100)}%` }} />
          </div>
        </div>
        {mine.length ? (
          <div className={s.personTasks}>{mine.map((t) => taskChip(t, true))}</div>
        ) : (
          !selTask && <div className={s.nothing}>Nothing yet</div>
        )}
        {selTask && owner(selTask) !== p.id && (
          <Button
            variant="soft"
            block
            onClick={(e) => {
              e.stopPropagation();
              giveHere();
            }}
          >
            Give it to {p.first}
          </Button>
        )}
      </div>
    );
  };

  const poolHot = (!!selTask && !!owner(selTask)) || over === POOL;
  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        {venues.length > 1 && (
          <Tabs
            variant="segmented"
            aria-label="Venue"
            value={venue}
            onChange={pickVenue}
            options={venues.map((v) => ({ id: v.id, label: v.name }))}
          />
        )}
        <span className={s.grow} />
        <Button variant="primary" onClick={auto} disabled={!people.length || !pool.length}>
          Auto-assign evenly
        </Button>
        <Button onClick={clear} disabled={!library.some((t) => owner(t) && !day.done[t.id])}>
          Clear
        </Button>
      </div>
      <p className={s.context}>
        Today, {formatDayShort(today())} · {people.length} on shift at {vname}. Shifts are a sample roster, since there is no
        scheduling feed yet.
      </p>
      {selTask ? (
        <div className={s.selecting} role="status">
          <span>
            Now tap who does {selTask.name}
            {owner(selTask) ? ', or Not assigned to take it back.' : '.'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className={cx(s.status, msg && s.statusMsg)} role="status">
          {msg || 'Tap a task, then tap a person. Or drag it.'}
        </p>
      )}
      {library.length ? (
        <div
          {...dropTarget(null)}
          onClick={() => selTask && owner(selTask) && give(selTask.id, null)}
          className={cx(s.pool, poolHot && s.hot, over === POOL && s.over, selTask && owner(selTask) && s.clickable)}
        >
          <div className={s.poolTitle}>Not assigned · {pool.length}</div>
          {pool.length ? (
            <div className={s.poolTasks}>{pool.map((t) => taskChip(t))}</div>
          ) : (
            <div className={s.allGiven}>Every task has someone.</div>
          )}
          {selTask && owner(selTask) && (
            <Button
              variant="soft"
              className={s.takeBack}
              onClick={(e) => {
                e.stopPropagation();
                give(selTask.id, null);
              }}
            >
              Take it back to Not assigned
            </Button>
          )}
        </div>
      ) : (
        <div className={s.note}>No side work in the library for {vname} yet. Add tasks in Back Office under Side Work Tasks.</div>
      )}
      {people.length ? (
        <div className={s.people}>{people.map(personCard)}</div>
      ) : (
        <div className={s.note}>No one is on the sample schedule at {vname} today.</div>
      )}
    </div>
  );
}
