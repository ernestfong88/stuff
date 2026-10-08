import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import type { RecipeInfo } from '../../../store/recipes';
import s from './RecipeSearchBox.module.css';

/** Recipes whose name has every typed word at the start of one of its words, names starting with the text first. */
export function matchRecipes(options: RecipeInfo[], text: string, limit = 8): RecipeInfo[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const hits = options.filter((o) => {
    const name = o.name.toLowerCase().split(/[^a-z0-9]+/);
    return words.every((w) => name.some((n) => n.startsWith(w)));
  });
  const starts = (o: RecipeInfo) => (o.name.toLowerCase().startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name)).slice(0, limit);
}

/**
 * Pick one recipe by typing its name: the chosen recipe shows with a clear
 * button; otherwise a search box lists matches as you type (Enter takes the
 * first, arrow keys move, Escape closes).
 */
export function RecipeSearchBox({
  value,
  options,
  onChange,
  label,
  placeholder = 'Search the Recipe Book…',
}: {
  value: RecipeInfo | undefined;
  options: RecipeInfo[];
  onChange: (id: string | undefined) => void;
  label: string;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);
  const listId = useId();
  const hits = useMemo(() => matchRecipes(options, text), [options, text]);

  const pick = (id: string) => {
    onChange(id);
    setText('');
    setEditing(false);
  };

  if (value && !editing)
    return (
      <span className={s.chosen}>
        <button className={s.chosenName} onClick={() => setEditing(true)} title="Change" aria-label={`${label}: ${value.name}. Change`}>
          {value.name}
        </button>
        <button className={s.clear} onClick={() => onChange(undefined)} aria-label={`Clear ${label}`}>
          <X size={14} strokeWidth={2.6} />
        </button>
      </span>
    );

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, hits.length - 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
    else if (e.key === 'Enter' && hits[active]) pick(hits[active].id);
    else if (e.key === 'Escape') {
      setText('');
      setEditing(false);
    } else return;
    e.preventDefault();
  };

  return (
    <span className={s.wrap}>
      <span className={s.box}>
        <Search size={15} strokeWidth={2.4} aria-hidden />
        <input
          className={s.input}
          role="combobox"
          aria-label={label}
          aria-expanded={hits.length > 0}
          aria-controls={listId}
          autoFocus={editing}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          onBlur={() => setTimeout(() => editing && !text && setEditing(false), 150)}
        />
      </span>
      {hits.length > 0 && (
        <ul className={s.list} id={listId} role="listbox">
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <button className={i === active ? s.hitOn : s.hit} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h.id)}>
                {h.name}
                {h.sub && <span className={s.sub}>{h.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {text.trim() && hits.length === 0 && <span className={s.none}>No entrée called “{text.trim()}”</span>}
    </span>
  );
}
