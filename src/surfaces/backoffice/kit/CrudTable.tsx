import { useState, type ReactNode } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { Button, toast } from '../../../ui';
import { BoIconButton, BoSelect } from './controls';
import { BoTable, type BoColumn } from './index';
import s from './CrudTable.module.css';

/** A row of a back office list. Retiring keeps it (inactive) so closed checks keep their wording. */
export interface CrudRow {
  id: string;
  text: string;
  isDefault: boolean;
  active: boolean;
}

export type CrudEditor<T> =
  | { kind: 'text'; key: keyof T & string }
  | { kind: 'number'; key: keyof T & string; prefix?: string; min?: number; step?: number }
  | { kind: 'select'; key: keyof T & string; options: Array<{ value: string | number; label: string }> };

export interface CrudColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  editor: CrudEditor<T>;
  width?: number | string;
}

/** Which row is being edited (and whether it is new). Pages hold it so their Add button can open a new row. */
export interface CrudEditing<T> {
  draft: T | null;
  isNew: boolean;
  setDraft: (update: T | null | ((d: T | null) => T | null)) => void;
  setIsNew: (v: boolean) => void;
}

export function useCrudEditing<T>(): CrudEditing<T> & { add: (row: T) => void } {
  const [draft, setDraft] = useState<T | null>(null);
  const [isNew, setIsNew] = useState(false);
  return {
    draft,
    isNew,
    setDraft,
    setIsNew,
    add: (row: T) => {
      setDraft(row);
      setIsNew(true);
    },
  };
}

interface Props<T extends CrudRow> {
  /** Name of one row for messages ("plan", "option"). */
  noun: string;
  rows: T[];
  setRows: (update: (rows: T[]) => T[]) => void;
  columns: Array<CrudColumn<T>>;
  editing: CrudEditing<T>;
  /** Show the single-default radio column (Meal Plans sets its defaults per care level instead). */
  showDefault?: boolean;
}

/**
 * Editable list with a single default: edit in place, pick the default with
 * the radio, retire with undo. Shared by Meal Plans, Meal Counts and
 * Delivery Options.
 */
export function CrudTable<T extends CrudRow>({ noun, rows, setRows, columns, editing, showDefault = true }: Props<T>) {
  const { draft, setDraft, isNew, setIsNew } = editing;
  const editId = draft?.id ?? null;
  const shown = [...(isNew && draft ? [draft] : []), ...rows.filter((r) => r.active)];

  const stopEditing = () => {
    setDraft(null);
    setIsNew(false);
  };
  const save = () => {
    if (!draft) return;
    const clean = { ...draft, text: draft.text.trim() || `New ${noun}` };
    setRows((list) => (list.some((r) => r.id === clean.id) ? list.map((r) => (r.id === clean.id ? clean : r)) : [clean, ...list]));
    toast(isNew ? `${clean.text} added` : 'Saved', { tone: 'success' });
    stopEditing();
  };
  const makeDefault = (id: string) => {
    setRows((list) => list.map((r) => ({ ...r, isDefault: r.id === id })));
    toast('Default updated', { tone: 'success' });
  };
  const retire = (row: T) => {
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, active: false } : r)));
    toast(`${row.text} retired. Closed checks keep its description.`, {
      action: { label: 'Undo', onClick: () => setRows((list) => list.map((r) => (r.id === row.id ? { ...r, active: true } : r))) },
    });
  };

  const editorFor = (col: CrudColumn<T>) => {
    if (!draft) return null;
    const ed = col.editor;
    const value = draft[ed.key];
    const set = (v: unknown) => setDraft((d) => (d ? { ...d, [ed.key]: v } : d));
    const label = `${col.header}`;
    if (ed.kind === 'select')
      return (
        <BoSelect aria-label={label} value={String(value)} onChange={(e) => set(typeof ed.options[0]?.value === 'number' ? Number(e.target.value) : e.target.value)}>
          {ed.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </BoSelect>
      );
    if (ed.kind === 'number')
      return (
        <span className={s.money}>
          {ed.prefix && <span className={s.prefix}>{ed.prefix}</span>}
          <input
            className={s.input}
            type="number"
            inputMode="decimal"
            min={ed.min ?? 0}
            step={ed.step ?? 1}
            aria-label={label}
            value={Number(value)}
            onChange={(e) => set(e.target.value === '' ? 0 : Math.max(ed.min ?? 0, Number(e.target.value)))}
            style={{ width: 90 }}
          />
        </span>
      );
    return (
      <input
        className={s.input}
        aria-label={label}
        value={String(value ?? '')}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') stopEditing();
        }}
        // Focus the name when a row opens for editing, so typing starts right away.
        autoFocus
      />
    );
  };

  // No shared radio `name`: old data can hold two defaults, and a named group would hide one of them.
  const defaultColumn: BoColumn<T> = {
    key: 'default',
    header: 'Default',
    width: 90,
    render: (r: T) => (
      <input type="radio" className={s.radio} checked={r.isDefault} disabled={r.id === editId} aria-label={`Make ${r.text} the default`} onChange={() => makeDefault(r.id)} />
    ),
  };
  const cols: Array<BoColumn<T>> = [
    ...columns.map((c) => ({
      key: c.key,
      header: c.header,
      width: c.width,
      render: (r: T) => (r.id === editId ? editorFor(c) : c.render(r)),
    })),
    ...(showDefault ? [defaultColumn] : []),
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 180,
      render: (r: T) =>
        r.id === editId ? (
          <span className={s.actions}>
            <Button size="sm" variant="ghost" onClick={stopEditing}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={save}>
              Save
            </Button>
          </span>
        ) : (
          <span className={s.actions}>
            <BoIconButton aria-label={`Edit ${r.text}`} onClick={() => setDraft({ ...r })} disabled={editId != null}>
              <Pencil size={14} />
            </BoIconButton>
            <BoIconButton tone="danger" aria-label={`Retire ${r.text}`} onClick={() => retire(r)} disabled={editId != null}>
              <Trash2 size={14} />
            </BoIconButton>
          </span>
        ),
    },
  ];

  return <BoTable columns={cols} rows={shown} rowKey={(r) => r.id} empty={`No ${noun}s yet. Add one to get started.`} caption={`${noun}s`} />;
}
