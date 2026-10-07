import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Circle, Minus, Plus, RotateCcw, Save, Square, Trash2 } from 'lucide-react';
import { rooms } from '../../../data';
import { uid } from '../../../lib/id';
import { useShared } from '../../../lib/sharedStore';
import { Button, Tabs, TextField, toast, useConfirm, cx } from '../../../ui';
import { planBox } from './FloorPlan';
import { layoutStore, resetRoomLayout, roomPlan, saveRoomLayout, sectionAt, type PlanItem } from './layout';
import { clampItem, moveItem, newItem, SNAP, type NewKind } from './planEdit';
import s from './FloorPlanEditor.module.css';

const roomKeys = Object.keys(rooms);

function withoutKey<T>(rec: Record<string, T>, key: string): Record<string, T> {
  const next = { ...rec };
  delete next[key];
  return next;
}

/**
 * Back Office floor plan editor: drag tables and walls into place, add or
 * remove them, rename and resize, then save. The host and manager floors
 * read the saved layout. A removed table stays in order history.
 */
export function FloorPlanEditor() {
  const saved = useShared(layoutStore);
  const [room, setRoom] = useState(roomKeys[0]);
  const [drafts, setDrafts] = useState<Record<string, PlanItem[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, confirmUi] = useConfirm();
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x0: number; y0: number; item: PlanItem } | null>(null);

  const plan = roomPlan(room, saved);
  const items = drafts[room] ?? plan.items;
  const dirty = !!drafts[room];
  const sel = items.find((t) => t.id === selected) ?? null;
  const edited = !!saved[room];

  const change = (fn: (list: PlanItem[]) => PlanItem[]) => setDrafts((d) => ({ ...d, [room]: fn(d[room] ?? plan.items) }));
  const patch = (id: string, p: Partial<PlanItem>) => change((list) => list.map((t) => (t.id === id ? clampItem({ ...t, ...p }) : t)));

  const add = (kind: NewKind) => {
    const it = newItem(kind, items, plan.bands, uid(kind === 'wall' ? 'w_' : 't_'), plan.name);
    change((list) => [...list, it]);
    setSelected(it.id);
  };

  const down = (e: PointerEvent<HTMLButtonElement>, it: PlanItem) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(it.id);
    drag.current = { id: it.id, x0: e.clientX, y0: e.clientY, item: it };
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const box = canvas.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = ((e.clientX - d.x0) / box.width) * 100;
    const dy = ((e.clientY - d.y0) / box.height) * 100;
    if (Math.abs(dx) < SNAP / 2 && Math.abs(dy) < SNAP / 2) return;
    const next = moveItem(d.item, dx, dy);
    change((list) => list.map((t) => (t.id === d.id ? { ...next, section: t.type === 'seat' ? sectionAt(plan.bands, next.x + next.w / 2, next.y + next.h / 2) : t.section } : t)));
  };
  const up = () => {
    drag.current = null;
  };
  /** Arrow keys nudge the selected table, for keyboard users and fine placing. */
  const nudge = (e: KeyboardEvent<HTMLButtonElement>, it: PlanItem) => {
    const step = e.shiftKey ? 5 : SNAP;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    change((list) => list.map((t) => (t.id === it.id ? moveItem(t, d[0], d[1]) : t)));
  };

  const save = () => {
    saveRoomLayout(room, items);
    setDrafts((d) => withoutKey(d, room));
    toast(`${plan.name} layout saved. The host and manager floors use it now.`, { tone: 'success' });
  };
  const reset = async () => {
    const ok = await confirm({
      title: `Go back to the original ${plan.name} layout?`,
      message: 'Moved, added and removed tables go back to how the room was set up. Order history is not affected.',
      confirmLabel: 'Reset layout',
      tone: 'danger',
    });
    if (!ok) return;
    resetRoomLayout(room);
    setDrafts((d) => withoutKey(d, room));
    setSelected(null);
  };
  const remove = (it: PlanItem) => {
    change((list) => list.filter((t) => t.id !== it.id));
    setSelected(null);
    toast(it.type === 'wall' ? 'Wall removed from the layout' : `${it.label} removed from the layout (kept for order history)`);
  };

  return (
    <div className={s.editor}>
      <div className={s.bar}>
        <Tabs
          variant="pills"
          size="sm"
          value={room}
          onChange={(r) => {
            setRoom(r);
            setSelected(null);
          }}
          aria-label="Room"
          options={roomKeys.map((k) => ({ id: k, label: rooms[k].name }))}
        />
        <span className={s.grow} />
        <Button size="sm" icon={<Square size={14} />} onClick={() => add('table')}>
          Table
        </Button>
        <Button size="sm" icon={<Circle size={14} />} onClick={() => add('round')}>
          Round
        </Button>
        <Button size="sm" icon={<Minus size={14} />} onClick={() => add('wall')}>
          Wall
        </Button>
        {edited && (
          <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={reset}>
            Original layout
          </Button>
        )}
        <Button size="sm" variant="primary" icon={<Save size={14} />} disabled={!dirty} onClick={save}>
          Save layout
        </Button>
      </div>
      <p className={s.help}>Drag to arrange. Tables snap into line, and the plan scales to any screen. Arrow keys nudge the selected table; hold Shift for bigger steps.</p>

      <div className={cx(s.layout, sel && s.withPanel)}>
        <div ref={canvas} className={s.canvas} onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          {plan.bands.map((b) => (
            <div key={b.label} className={s.band} style={planBox(b)}>
              <span className={s.bandLabel}>{b.label}</span>
            </div>
          ))}
          {items.map((it) => (
            <button
              key={it.id}
              className={cx(s.item, it.type === 'wall' && s.wall, it.shape === 'round' && s.round, it.id === selected && s.selected)}
              style={planBox(it)}
              onPointerDown={(e) => down(e, it)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onKeyDown={(e) => nudge(e, it)}
              onFocus={() => setSelected(it.id)}
              aria-label={`${it.type === 'wall' ? 'Wall' : it.label}. Drag or use the arrow keys to move.`}
              aria-pressed={it.id === selected}
            >
              {it.type === 'wall' ? '' : it.label}
            </button>
          ))}
        </div>

        {sel && (
          <aside className={s.panel} aria-label="Selected">
            <div className={s.panelCap}>Selected · {sel.type === 'wall' ? 'Wall' : sel.shape === 'round' ? 'Round table' : 'Table'}</div>
            {sel.type === 'seat' && <TextField label="Label" value={sel.label} maxLength={12} onChange={(e) => patch(sel.id, { label: e.target.value })} />}
            <div className={s.sizes}>
              <SizeStepper label="Width" value={sel.w} onChange={(w) => patch(sel.id, { w })} />
              <SizeStepper label="Height" value={sel.h} onChange={(h) => patch(sel.id, { h })} />
            </div>
            {sel.type === 'seat' && (
              <div className={s.shape}>
                <Button size="sm" active={sel.shape !== 'round'} icon={<Square size={14} />} onClick={() => patch(sel.id, { shape: undefined })}>
                  Square
                </Button>
                <Button size="sm" active={sel.shape === 'round'} icon={<Circle size={14} />} onClick={() => patch(sel.id, { shape: 'round' })}>
                  Round
                </Button>
              </div>
            )}
            {sel.type === 'seat' && sel.section && <div className={s.section}>Section: {sel.section}</div>}
            <Button size="sm" variant="softDanger" icon={<Trash2 size={14} />} onClick={() => remove(sel)}>
              Remove
            </Button>
          </aside>
        )}
      </div>
      {confirmUi}
    </div>
  );
}

function SizeStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className={s.size}>
      <span className={s.sizeLabel}>{label}</span>
      <span className={s.sizeCtl}>
        <button onClick={() => onChange(value - 1)} aria-label={`Smaller ${label.toLowerCase()}`}>
          <Minus size={14} />
        </button>
        <span className={s.sizeValue}>{Math.round(value)}%</span>
        <button onClick={() => onChange(value + 1)} aria-label={`Larger ${label.toLowerCase()}`}>
          <Plus size={14} />
        </button>
      </span>
    </div>
  );
}
