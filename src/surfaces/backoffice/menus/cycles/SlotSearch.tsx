import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { cx } from '../../../../ui';
import { useBo } from '../data';
import { dishLong, normCategory } from '../model/categories';
import { PLAN_LABEL, planClass, swatchClass } from '../ui/menuBits';
import { AiRecipeDialog } from './AiRecipeDialog';
import { searchRecipes } from './slotSearchModel';
import s from './SlotSearch.module.css';

/**
 * Type a recipe straight into a menu slot: matches from the Recipe Book show
 * under the box as you type. Arrow keys and Enter pick one, Escape or
 * leaving the box puts the slot back. A dish not in the book yet can be
 * drafted with AI Assist.
 *
 * The list floats over the page (fixed, in a portal) so the builder's
 * scrolling grid never cuts it off.
 */
export function SlotSearch({
  cat,
  placeholder,
  onPick,
  onCancel,
  className,
}: {
  /** Recipe Book category to search; null searches every category. */
  cat: string | null;
  placeholder: string;
  onPick: (recipeId: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const bo = useBo();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [ai, setAi] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [box, setBox] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const update = () => input.current && setBox(input.current.getBoundingClientRect());
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, []);
  useEffect(() => input.current?.focus(), []);

  const { list, exact } = searchRecipes(bo.recipes, q, cat ? normCategory(cat) : null);
  const query = q.trim();
  const offerAi = query.length > 1 && !exact;
  const count = list.length + (offerAi ? 1 : 0);
  const pickAt = (i: number) => {
    if (i < list.length) onPick(list[i].id);
    else if (offerAi) setAi(true);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(count - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (count) pickAt(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  if (ai)
    return (
      <AiRecipeDialog
        name={query}
        cat={cat ? normCategory(cat) : undefined}
        onClose={() => {
          setAi(false);
          onCancel();
        }}
        onCreated={(id) => onPick(id)}
      />
    );

  // Below the box, or above it when there is no room underneath.
  const width = box ? Math.max(box.width, 280) : 280;
  const above = !!box && box.bottom + 320 > window.innerHeight && box.top > 320;
  const style = box
    ? { left: Math.min(box.left, window.innerWidth - width - 8), width, ...(above ? { bottom: window.innerHeight - box.top + 4 } : { top: box.bottom + 4 }) }
    : { display: 'none' };

  return (
    <>
      <input
        ref={input}
        className={cx(s.input, className)}
        value={q}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-autocomplete="list"
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKey}
        onBlur={onCancel}
      />
      {createPortal(
        // Picking with the mouse must not blur the box first.
        <div className={s.drop} style={style} role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {list.map((r, i) => (
            <button
              key={r.id}
              role="option"
              aria-selected={i === active}
              className={cx(s.item, i === active && s.itemOn)}
              onMouseEnter={() => setActive(i)}
              onClick={() => pickAt(i)}
            >
              <span className={cx(swatchClass, planClass(r.cat))} />
              <span className={s.name}>{dishLong(r.name)}</span>
              {!cat && <span className={s.cat}>{PLAN_LABEL[normCategory(r.cat)] ?? r.cat}</span>}
            </button>
          ))}
          {!list.length && !offerAi && <div className={s.none}>{query ? 'No recipe matches. Try another word.' : 'Start typing a recipe name.'}</div>}
          {offerAi && (
            <button
              role="option"
              aria-selected={active === list.length}
              className={cx(s.item, s.ai, active === list.length && s.itemOn)}
              onMouseEnter={() => setActive(list.length)}
              onClick={() => setAi(true)}
            >
              <Sparkles size={15} aria-hidden />
              <span className={s.name}>Create “{query}” with AI Assist</span>
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
