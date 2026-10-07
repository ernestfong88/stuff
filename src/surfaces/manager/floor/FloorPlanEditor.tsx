import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Circle,
  Copy,
  Minus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react';
import { rooms } from '../../../data';
import { uid } from '../../../lib/id';
import { useShared } from '../../../lib/sharedStore';
import { Button, Tabs, TextField, toast, useConfirm, cx } from '../../../ui';
import { planBox } from './FloorPlan';
import { layoutStore, resetRoomLayout, roomPlan, saveRoomLayout, sectionAt, type PlanItem } from '../../../store/floorLayout';
import {
  alignItems,
  clampItem,
  copyItems,
  distributeItems,
  moveItem,
  newItem,
  resizeItem,
  SNAP,
  turnItem,
  type Align,
  type Handle,
  type NewKind,
} from './planEdit';
import { labelProblems } from './planCheck';
import s from './FloorPlanEditor.module.css';

const roomKeys = Object.keys(rooms);

function withoutKey<T>(rec: Record<string, T>, key: string): Record<string, T> {
  const next = { ...rec };
  delete next[key];
  return next;
}

/** Handles around the selected item, each moving its own edges. */
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type Drag =
  | { kind: 'move'; x0: number; y0: number; items: PlanItem[]; recorded: boolean }
  | { kind: 'resize'; handle: Handle; x0: number; y0: number; item: PlanItem; recorded: boolean };

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Back Office floor plan editor. Drag tables and walls to move them, drag the
 * handles of the selected one to reshape it, Shift-click to pick several, and
 * copy, line up, turn or remove them; Undo and Redo cover every change until
 * it is saved. The host and manager floors read the saved layout. A removed
 * table stays in order history.
 */
export function FloorPlanEditor({ room: fixedRoom }: { room?: string } = {}) {
  const saved = useShared(layoutStore);
  const [pickedRoom, setRoom] = useState(roomKeys[0]);
  const room = fixedRoom ?? pickedRoom;
  const [drafts, setDrafts] = useState<Record<string, PlanItem[]>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [history, setHistory] = useState<Record<string, { past: PlanItem[][]; future: PlanItem[][] }>>({});
  const [confirm, confirmUi] = useConfirm();
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const clipboard = useRef<PlanItem[]>([]);

  const plan = roomPlan(room, saved);
  const items = drafts[room] ?? plan.items;
  const dirty = !!drafts[room];
  const chosen = items.filter((t) => picked.includes(t.id));
  const sel = chosen.length === 1 ? chosen[0] : null;
  const edited = !!saved[room];
  const problems = labelProblems(items);
  const problemCount = Object.keys(problems).length;
  const unsavedRooms = roomKeys.filter((k) => drafts[k]);
  const hist = history[room] ?? { past: [], future: [] };

  // Closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (!unsavedRooms.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsavedRooms.length]);

  /** Change the draft; `record` keeps the step for Undo (a drag records once, at its start). */
  const change = (fn: (list: PlanItem[]) => PlanItem[], record = true) => {
    if (record) setHistory((h) => ({ ...h, [room]: { past: [...(h[room]?.past ?? []), items].slice(-50), future: [] } }));
    setDrafts((d) => ({ ...d, [room]: fn(d[room] ?? plan.items) }));
  };
  const patch = (id: string, p: Partial<PlanItem>) => change((list) => list.map((t) => (t.id === id ? clampItem({ ...t, ...p }) : t)));
  const replace = (next: PlanItem[], record = true) => {
    const byId = new Map(next.map((t) => [t.id, t]));
    change((list) => list.map((t) => byId.get(t.id) ?? t), record);
  };
  const withSection = (t: PlanItem) => (t.type === 'seat' ? { ...t, section: sectionAt(plan.bands, t.x + t.w / 2, t.y + t.h / 2) } : t);

  const undo = () => {
    const prev = hist.past[hist.past.length - 1];
    if (!prev) return;
    setHistory((h) => ({ ...h, [room]: { past: hist.past.slice(0, -1), future: [items, ...hist.future] } }));
    setDrafts((d) => ({ ...d, [room]: prev }));
  };
  const redo = () => {
    const next = hist.future[0];
    if (!next) return;
    setHistory((h) => ({ ...h, [room]: { past: [...hist.past, items], future: hist.future.slice(1) } }));
    setDrafts((d) => ({ ...d, [room]: next }));
  };

  const add = (kind: NewKind) => {
    const it = newItem(kind, items, plan.bands, uid(kind === 'wall' ? 'w_' : 't_'), plan.name);
    change((list) => [...list, it]);
    setPicked([it.id]);
  };
  const duplicate = (from: PlanItem[] = chosen, at?: { x: number; y: number }) => {
    if (!from.length) return;
    const copies = copyItems(items, from, () => uid(from[0].type === 'wall' ? 'w_' : 't_'), at).map(withSection);
    change((list) => [...list, ...copies]);
    setPicked(copies.map((c) => c.id));
    toast(copies.length === 1 ? `Copied as ${copies[0].type === 'wall' ? 'a new wall' : copies[0].label}` : `${copies.length} copies added`);
  };
  const removeChosen = () => {
    if (!chosen.length) return;
    const before = items;
    change((list) => list.filter((t) => !picked.includes(t.id)));
    setPicked([]);
    const one = chosen.length === 1 ? chosen[0] : null;
    toast(one ? (one.type === 'wall' ? 'Wall removed.' : `${one.label} removed; order history keeps it.`) : `${chosen.length} removed.`, {
      action: { label: 'Undo', onClick: () => setDrafts((d) => ({ ...d, [room]: before })) },
    });
  };
  const line = (how: Align) => replace(alignItems(chosen, how).map(withSection));
  const spread = (axis: 'across' | 'down') => replace(distributeItems(chosen, axis).map(withSection));

  const toPercent = (e: { clientX: number; clientY: number }, x0: number, y0: number) => {
    const box = canvas.current?.getBoundingClientRect();
    return box ? { dx: ((e.clientX - x0) / box.width) * 100, dy: ((e.clientY - y0) / box.height) * 100 } : null;
  };

  const down = (e: PointerEvent<HTMLButtonElement>, it: PlanItem) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setPicked((p) => (p.includes(it.id) ? p.filter((x) => x !== it.id) : [...p, it.id]));
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const group = picked.includes(it.id) ? items.filter((t) => picked.includes(t.id)) : [it];
    if (!picked.includes(it.id)) setPicked([it.id]);
    drag.current = { kind: 'move', x0: e.clientX, y0: e.clientY, items: group, recorded: false };
  };
  const startResize = (e: PointerEvent<HTMLSpanElement>, it: PlanItem, handle: Handle) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: 'resize', handle, x0: e.clientX, y0: e.clientY, item: it, recorded: false };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toPercent(e, d.x0, d.y0);
    if (!p) return;
    if (!d.recorded && Math.abs(p.dx) < SNAP / 2 && Math.abs(p.dy) < SNAP / 2) return;
    const record = !d.recorded;
    d.recorded = true;
    if (d.kind === 'move')
      replace(
        d.items.map((t) => withSection(moveItem(t, p.dx, p.dy))),
        record,
      );
    else replace([withSection(resizeItem(d.item, d.handle, p.dx, p.dy))], record);
  };
  const up = () => {
    drag.current = null;
  };
  /** Arrow keys nudge what is picked, for keyboard users and fine placing. */
  const nudge = (e: KeyboardEvent<HTMLButtonElement>, it: PlanItem) => {
    const step = e.shiftKey ? 5 : SNAP;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const group = picked.includes(it.id) ? chosen : [it];
    replace(group.map((t) => withSection(moveItem(t, d[0], d[1]))));
  };

  // Shortcuts: Delete, Esc, and Ctrl/Cmd with Z, Y, C, V, D, A.
  const keys = useRef<(e: globalThis.KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    if (isTyping(e.target) || !canvas.current) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if ((e.key === 'Delete' || e.key === 'Backspace') && chosen.length) {
      e.preventDefault();
      removeChosen();
    } else if (e.key === 'Escape') setPicked([]);
    else if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && k === 'y') {
      e.preventDefault();
      redo();
    } else if (mod && k === 'c' && chosen.length) clipboard.current = chosen;
    else if (mod && k === 'v' && clipboard.current.length) {
      e.preventDefault();
      duplicate(clipboard.current);
    } else if (mod && k === 'd' && chosen.length) {
      e.preventDefault();
      duplicate();
    } else if (mod && k === 'a') {
      e.preventDefault();
      setPicked(items.map((t) => t.id));
    }
  };
  useEffect(() => {
    const on = (e: globalThis.KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const clearHistory = () => setHistory((h) => withoutKey(h, room));
  const save = () => {
    if (problemCount) return;
    saveRoomLayout(room, items);
    setDrafts((d) => withoutKey(d, room));
    clearHistory();
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
    clearHistory();
    setPicked([]);
  };
  const discard = async () => {
    const ok = await confirm({
      title: `Throw away your changes to ${plan.name}?`,
      message: 'The plan goes back to how it was last saved.',
      confirmLabel: 'Throw away changes',
      tone: 'danger',
    });
    if (!ok) return;
    setDrafts((d) => withoutKey(d, room));
    clearHistory();
    setPicked([]);
  };

  const kind = (it: PlanItem) => (it.type === 'wall' ? 'Wall' : it.shape === 'round' ? 'Round table' : 'Table');

  return (
    <div className={s.editor}>
      <div className={s.bar}>
        {!fixedRoom && (
          <Tabs
            variant="pills"
            size="sm"
            value={room}
            onChange={(r) => {
              setRoom(r);
              setPicked([]);
            }}
            aria-label="Room"
            options={roomKeys.map((k) => ({ id: k, label: drafts[k] ? `${rooms[k].name} (not saved)` : rooms[k].name }))}
          />
        )}
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          icon={<Undo2 size={15} />}
          aria-label="Undo"
          title="Undo (Ctrl/⌘ Z)"
          disabled={!hist.past.length}
          onClick={undo}
        />
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          icon={<Redo2 size={15} />}
          aria-label="Redo"
          title="Redo (Ctrl/⌘ Shift Z)"
          disabled={!hist.future.length}
          onClick={redo}
        />
        <span className={s.grow} />
        <Button size="sm" icon={<Square size={14} />} onClick={() => add('table')}>
          Add table
        </Button>
        <Button size="sm" icon={<Circle size={14} />} onClick={() => add('round')}>
          Add round table
        </Button>
        <Button size="sm" icon={<Minus size={14} />} onClick={() => add('wall')}>
          Add wall
        </Button>
      </div>
      <p className={s.help}>
        Drag to move · drag the handles to reshape · Shift-click to pick several · Ctrl/⌘ C and V to copy · Delete to remove. Nothing changes on the
        floor until you save.
      </p>
      <div className={cx(s.status, dirty && s.statusDirty)} role="status">
        <span className={s.statusText}>
          {problemCount
            ? `Fix ${problemCount === 1 ? 'one table name' : `${problemCount} table names`} before saving: each table needs its own name.`
            : dirty
              ? 'You have changes that are not saved yet.'
              : edited
                ? 'Saved. The host and manager floors use this layout.'
                : 'This is the original layout.'}
        </span>
        {edited && !dirty && (
          <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={reset}>
            Go back to the original layout
          </Button>
        )}
        {dirty && (
          <Button size="sm" variant="ghost" icon={<Undo2 size={14} />} onClick={discard}>
            Throw away changes
          </Button>
        )}
        <Button size="sm" variant="primary" icon={<Save size={14} />} disabled={!dirty || problemCount > 0} onClick={save}>
          Save layout
        </Button>
      </div>

      <div className={cx(s.layout, chosen.length > 0 && s.withPanel)}>
        <div ref={canvas} className={s.canvas} onPointerDown={(e) => e.target === e.currentTarget && setPicked([])}>
          {plan.bands.map((b) => (
            <div key={b.label} className={s.band} style={planBox(b)}>
              <span className={s.bandLabel}>{b.label}</span>
            </div>
          ))}
          {items.map((it) => (
            <button
              key={it.id}
              className={cx(
                s.item,
                it.type === 'wall' && s.wall,
                it.shape === 'round' && s.round,
                problems[it.id] && s.bad,
                picked.includes(it.id) && s.selected,
              )}
              style={planBox(it)}
              onPointerDown={(e) => down(e, it)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onKeyDown={(e) => nudge(e, it)}
              onFocus={() => !picked.includes(it.id) && setPicked([it.id])}
              aria-label={`${it.type === 'wall' ? 'Wall' : it.label}. Drag or use the arrow keys to move.`}
              aria-pressed={picked.includes(it.id)}
            >
              {it.type === 'wall' ? '' : it.label}
            </button>
          ))}
          {sel && (
            <div className={s.handles} style={planBox(sel)} aria-hidden="true">
              {HANDLES.map((h) => (
                <span
                  key={h}
                  className={cx(s.handle, s[`h_${h}`])}
                  onPointerDown={(e) => startResize(e, sel, h)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                />
              ))}
              <span className={s.sizeTag}>
                {Math.round(sel.w)} × {Math.round(sel.h)}
              </span>
            </div>
          )}
        </div>

        {chosen.length > 0 && (
          <aside className={s.panel} aria-label="Selected">
            <div className={s.panelCap}>{sel ? `Selected · ${kind(sel)}` : `${chosen.length} selected`}</div>
            {sel?.type === 'seat' && (
              <TextField
                label="Table name"
                value={sel.label}
                maxLength={12}
                error={
                  problems[sel.id] === 'blank'
                    ? 'Give the table a name.'
                    : problems[sel.id] === 'duplicate'
                      ? 'Another table has this name.'
                      : undefined
                }
                onChange={(e) => patch(sel.id, { label: e.target.value })}
              />
            )}
            {sel?.type === 'seat' && (
              <div className={s.shape}>
                <Button size="sm" active={sel.shape !== 'round'} icon={<Square size={14} />} onClick={() => patch(sel.id, { shape: undefined })}>
                  Square
                </Button>
                <Button size="sm" active={sel.shape === 'round'} icon={<Circle size={14} />} onClick={() => patch(sel.id, { shape: 'round' })}>
                  Round
                </Button>
              </div>
            )}
            {chosen.length > 1 && (
              <div className={s.alignBox}>
                <span className={s.alignCap}>Line up</span>
                <div className={s.alignRow}>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<AlignStartVertical size={16} />}
                    aria-label="Line up left edges"
                    title="Left edges"
                    onClick={() => line('left')}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<AlignCenterVertical size={16} />}
                    aria-label="Line up centres across"
                    title="Centres"
                    onClick={() => line('center')}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<AlignEndVertical size={16} />}
                    aria-label="Line up right edges"
                    title="Right edges"
                    onClick={() => line('right')}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<AlignStartHorizontal size={16} />}
                    aria-label="Line up top edges"
                    title="Top edges"
                    onClick={() => line('top')}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<AlignCenterHorizontal size={16} />}
                    aria-label="Line up middles"
                    title="Middles"
                    onClick={() => line('middle')}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<AlignEndHorizontal size={16} />}
                    aria-label="Line up bottom edges"
                    title="Bottom edges"
                    onClick={() => line('bottom')}
                  />
                </div>
                {chosen.length > 2 && (
                  <div className={s.alignRow}>
                    <Button size="sm" variant="ghost" icon={<AlignHorizontalSpaceAround size={16} />} onClick={() => spread('across')}>
                      Space across
                    </Button>
                    <Button size="sm" variant="ghost" icon={<AlignVerticalSpaceAround size={16} />} onClick={() => spread('down')}>
                      Space down
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className={s.actions}>
              <Button size="sm" icon={<Copy size={14} />} onClick={() => duplicate()} title="Ctrl/⌘ D">
                Duplicate
              </Button>
              {sel && (
                <Button size="sm" icon={<RotateCw size={14} />} onClick={() => replace([withSection(turnItem(sel))])} title="Swap width and height">
                  Turn
                </Button>
              )}
            </div>
            {sel?.type === 'seat' && sel.section && <div className={s.section}>Section: {sel.section}</div>}
            <Button size="sm" variant="softDanger" icon={<Trash2 size={14} />} onClick={removeChosen}>
              {sel ? `Remove ${sel.type === 'wall' ? 'wall' : 'table'}` : `Remove ${chosen.length}`}
            </Button>
          </aside>
        )}
      </div>
      {confirmUi}
    </div>
  );
}
