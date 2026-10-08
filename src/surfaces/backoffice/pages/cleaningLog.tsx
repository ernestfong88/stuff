/**
 * Cleaning Log: each kitchen's daily and weekly cleaning, who each task is
 * assigned to, and the log of who signed each one off on the prep tablet
 * with their PIN. Tasks: add, edit and remove tasks. Log: a week at a time,
 * Sunday to Saturday, task by task and day by day.
 */
import { useState } from 'react';
import { Plus, Printer, Trash2 } from 'lucide-react';
import {
  CLEANING_WHEN,
  WEEKDAYS,
  addDays,
  dateOf,
  isoOf,
  needsAttention,
  weekLog,
  type CleaningFreq,
  type CleaningTask,
  type CleaningWhen,
  type LogCell,
} from '../../../domain/cleaning';
import { formatTime } from '../../../lib/format';
import { uid } from '../../../lib/id';
import { cleaningSign, cleaningTasksFor, crewMember, isCleaningEdited, kitchenCrew, setCleaningTasks, useCleaning } from '../../../store/cleaning';
import { PRODUCTION_VENUES, getProductionVenue } from '../../../store/production';
import { Button, Tabs, TextField, cx, toast, useConfirm, useNow } from '../../../ui';
import { BoPage, BoSection, BoSelect, BoStatRow, BoStatTile } from '../kit';
import type { BoPageProps } from '../nav';
import { cellText, printCleaningLog } from './cleaningPrint';
import { usePageTab } from './pageTab';
import s from './cleaningLog.module.css';

const TABS = ['tasks', 'log'] as const;
/** How many weeks back the log goes. */
const WEEKS_BACK = 3;

/** A daily task's time of day and a weekly task's day share one dropdown value: "open", "mid", "close" or "d0" to "d6". */
const DUE_OPTIONS: Record<CleaningFreq, Array<[string, string]>> = {
  daily: CLEANING_WHEN.map(([w, l]) => [w, l]),
  weekly: WEEKDAYS.map((d, i) => [`d${i}`, d]),
};
const dueValue = (t: Pick<CleaningTask, 'freq' | 'when' | 'day'>) => (t.freq === 'daily' ? t.when : `d${t.day}`);
const fromDue = (v: string): Partial<CleaningTask> => (v.startsWith('d') ? { day: +v.slice(1) } : { when: v as CleaningWhen });

function AssigneeSelect({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const crew = kitchenCrew();
  return (
    <BoSelect className={s.who} value={value ?? ''} aria-label={label} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Anyone on shift</option>
      {crew.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} · {c.title}
        </option>
      ))}
      {value && !crew.some((c) => c.id === value) && <option value={value}>{value}</option>}
    </BoSelect>
  );
}

function DueSelect({ freq, value, onChange, label }: { freq: CleaningFreq; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <BoSelect className={s.due} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {DUE_OPTIONS[freq].map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </BoSelect>
  );
}

export default function Page(_props: BoPageProps) {
  const state = useCleaning();
  const nowMs = useNow(60_000);
  const [tab, setTab] = usePageTab('cleaningLog', TABS);
  const [venueId, setVenueId] = useState(PRODUCTION_VENUES[0].id);
  const [ask, dialog] = useConfirm();
  const venue = getProductionVenue(venueId);
  const tasks = cleaningTasksFor(state, venueId);
  const thisWeek = addDays(isoOf(new Date(nowMs)), -new Date(nowMs).getDay());
  const missedThisWeek = needsAttention(weekLog(tasks, thisWeek, (t, iso) => cleaningSign(state, venueId, t, iso, nowMs), nowMs));

  return (
    <BoPage
      title="Cleaning Log"
      actions={
        tab === 'tasks' &&
        isCleaningEdited(state, venueId) && (
          <Button
            onClick={async () => {
              const ok = await ask({
                title: 'Reset to the starter list?',
                message: `${venue.name}'s own cleaning tasks and assignments are replaced by the starter list.`,
                confirmLabel: 'Reset',
                tone: 'danger',
              });
              if (!ok) return;
              setCleaningTasks(venueId, null);
              toast(`${venue.name} is back to the starter cleaning list`);
            }}
          >
            Reset to the starter list
          </Button>
        )
      }
    >
      <Tabs
        variant="underline"
        aria-label="Cleaning log sections"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'tasks', label: 'Tasks', count: tasks.length },
          { id: 'log', label: 'Log', count: missedThisWeek || undefined, countTone: 'danger' },
        ]}
      />
      <Tabs
        variant="segmented"
        aria-label="Kitchen"
        value={venueId}
        onChange={setVenueId}
        options={PRODUCTION_VENUES.map((v) => ({ id: v.id, label: v.name }))}
        className={s.venues}
      />
      {tab === 'tasks' ? (
        <TasksTab venueId={venueId} tasks={tasks} />
      ) : (
        <LogTab venueId={venueId} venueName={venue.fullName} tasks={tasks} thisWeek={thisWeek} nowMs={nowMs} />
      )}
      {dialog}
    </BoPage>
  );
}

// ─── Tasks ───────────────────────────────────────────────────────────────

function TasksTab({ venueId, tasks }: { venueId: string; tasks: CleaningTask[] }) {
  const save = (next: CleaningTask[]) => setCleaningTasks(venueId, next);
  const update = (id: string, patch: Partial<CleaningTask>) => save(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  return (
    <>
      {(['daily', 'weekly'] as const).map((freq) => {
        const list = tasks.filter((t) => t.freq === freq);
        return (
          <BoSection
            key={freq}
            title={freq === 'daily' ? 'Daily' : 'Weekly'}
            sub={freq === 'daily' ? 'Every day, at Opening, Mid-day or Closing' : 'Once a week, due on the day set; weeks run Sunday to Saturday'}
          >
            {!list.length && <p className={s.empty}>No {freq} tasks yet.</p>}
            {list.map((t) => (
              <div key={t.id} className={s.row}>
                <TextField
                  key={t.text}
                  defaultValue={t.text}
                  aria-label="Task"
                  className={s.text}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== t.text) update(t.id, { text: v });
                    else e.target.value = t.text;
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
                <span className={s.controls}>
                  <BoSelect
                    className={s.freq}
                    value={t.freq}
                    aria-label={`How often: ${t.text}`}
                    onChange={(e) => update(t.id, { freq: e.target.value as CleaningFreq })}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </BoSelect>
                  <DueSelect
                    freq={t.freq}
                    value={dueValue(t)}
                    label={`${t.freq === 'daily' ? 'When' : 'Due day'}: ${t.text}`}
                    onChange={(v) => update(t.id, fromDue(v))}
                  />
                  <AssigneeSelect value={t.assignee} label={`Assigned to: ${t.text}`} onChange={(assignee) => update(t.id, { assignee })} />
                  <Button
                    size="sm"
                    variant="softDanger"
                    iconOnly
                    icon={<Trash2 size={14} />}
                    aria-label={`Delete ${t.text}`}
                    onClick={() => {
                      save(tasks.filter((x) => x.id !== t.id));
                      toast(`${t.text} deleted`, { action: { label: 'Undo', onClick: () => save(tasks) } });
                    }}
                  />
                </span>
              </div>
            ))}
            <AddTask freq={freq} onAdd={(task) => save([...tasks, task])} />
          </BoSection>
        );
      })}
    </>
  );
}

function AddTask({ freq, onAdd }: { freq: CleaningFreq; onAdd: (t: CleaningTask) => void }) {
  const [text, setText] = useState('');
  const [due, setDue] = useState(freq === 'daily' ? 'close' : 'd1');
  const [assignee, setAssignee] = useState<string | null>(null);
  const label = freq === 'daily' ? 'daily' : 'weekly';
  return (
    <form
      className={cx(s.row, s.add)}
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        onAdd({ id: uid('cl-'), text: t, freq, when: 'close', day: 1, ...fromDue(due), assignee });
        setText('');
        toast(`${t} added`, { tone: 'success' });
      }}
    >
      <TextField
        className={s.text}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={freq === 'daily' ? 'New daily task, e.g. Empty and clean the fryer baskets' : 'New weekly task, e.g. Boil out the fryer'}
        aria-label={`New ${label} task`}
      />
      <span className={s.controls}>
        <DueSelect freq={freq} value={due} label={`New ${label} task ${freq === 'daily' ? 'when' : 'due day'}`} onChange={setDue} />
        <AssigneeSelect value={assignee} label={`New ${label} task assigned to`} onChange={setAssignee} />
        <Button type="submit" variant="primary" size="sm" icon={<Plus size={14} />} disabled={!text.trim()}>
          Add
        </Button>
      </span>
    </form>
  );
}

// ─── Log ─────────────────────────────────────────────────────────────────

function weekName(weekIso: string, back: number): string {
  if (back === 0) return 'This week';
  if (back === 1) return 'Last week';
  const a = dateOf(weekIso);
  const b = dateOf(addDays(weekIso, 6));
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  return `${month(a)} ${a.getDate()} – ${a.getMonth() === b.getMonth() ? '' : month(b) + ' '}${b.getDate()}`;
}

function LogTab({
  venueId,
  venueName,
  tasks,
  thisWeek,
  nowMs,
}: {
  venueId: string;
  venueName: string;
  tasks: CleaningTask[];
  thisWeek: string;
  nowMs: number;
}) {
  const state = useCleaning();
  const [back, setBack] = useState('0');
  const weekIso = addDays(thisWeek, -7 * +back);
  const log = weekLog(tasks, weekIso, (t, iso) => cleaningSign(state, venueId, t, iso, nowMs), nowMs);
  const cells = log.flatMap((r) => r.cells).filter((c): c is LogCell => !!c);
  const signed = cells.filter((c) => c.sign).length;
  const missed = needsAttention(log);
  const open = cells.filter((c) => c.status === 'open' || c.status === 'due').length;
  const todayIso = isoOf(new Date(nowMs));
  const label = weekName(weekIso, +back);

  return (
    <>
      <div className={s.weekBar}>
        <Tabs
          variant="segmented"
          aria-label="Week"
          value={back}
          onChange={setBack}
          options={Array.from({ length: WEEKS_BACK + 1 }, (_, i) => ({ id: String(i), label: weekName(addDays(thisWeek, -7 * i), i) }))}
        />
        <Button icon={<Printer size={15} />} onClick={() => printCleaningLog(venueName, label, weekIso, log)}>
          Print this week
        </Button>
      </div>
      <BoStatRow>
        <BoStatTile value={signed} label="signed off" tone="green" />
        <BoStatTile value={missed} label="missed or overdue" tone={missed ? 'danger' : undefined} />
        {+back === 0 && <BoStatTile value={open} label="still to do today" />}
      </BoStatRow>
      <BoSection flush>
        <div className={s.scroll}>
          <table className={s.log}>
            <thead>
              <tr>
                <th className={s.taskCol}>Task</th>
                {WEEKDAYS.map((d, i) => {
                  const iso = addDays(weekIso, i);
                  return (
                    <th key={d} className={cx(iso === todayIso && s.today)}>
                      {d.slice(0, 3)} <span className={s.date}>{dateOf(iso).getDate()}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {log.map(({ task, cells: row }) => (
                <tr key={task.id}>
                  <th scope="row" className={s.taskCol}>
                    <span className={s.taskName}>{task.text}</span>
                    <span className={s.taskMeta}>
                      {task.freq === 'daily' ? CLEANING_WHEN.find((w) => w[0] === task.when)?.[1] : `Weekly · ${WEEKDAYS[task.day]}`} ·{' '}
                      {crewMember(task.assignee)?.short ?? 'Anyone on shift'}
                    </span>
                  </th>
                  {row.map((c, i) => (
                    <td key={i} className={cx(!c && s.none, c && addDays(weekIso, i) === todayIso && s.today)}>
                      {c && <Cell cell={c} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BoSection>
    </>
  );
}

function Cell({ cell }: { cell: LogCell }) {
  const { sign, task } = cell;
  if (sign) {
    const covering = task.assignee && task.assignee !== sign.staffId ? crewMember(task.assignee)?.short : undefined;
    // A weekly task signed off on another day than it was due says which day.
    const day = isoOf(new Date(sign.at)) !== cell.iso ? new Date(sign.at).toLocaleDateString('en-US', { weekday: 'short' }) + ' ' : '';
    return (
      <span className={s.signed} title={covering ? `Assigned to ${covering}, signed off by ${sign.by}` : `Signed off by ${sign.by}`}>
        <span className={s.by}>{sign.by}</span>
        <span className={s.at}>
          {day}
          {formatTime(sign.at)}
        </span>
        {covering && <span className={s.cover}>for {covering}</span>}
      </span>
    );
  }
  const text = cellText(cell);
  return <span className={cx(s.state, (cell.status === 'missed' || cell.status === 'overdue') && s.missed)}>{text}</span>;
}
