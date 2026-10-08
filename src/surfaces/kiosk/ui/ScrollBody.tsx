import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown } from 'lucide-react';
import s from './ScrollBody.module.css';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The scrolling middle of the kiosk. Residents may not think to scroll, so
 * a longer screen fades at the bottom and shows a "More below" button that
 * scrolls most of a page when tapped. Both go away at the bottom. Each new
 * screen (`screenKey`) starts at the top.
 */
export function ScrollBody({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const check = useCallback(() => {
    const el = ref.current;
    if (el) setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 24);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
    check();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [screenKey, check]);

  return (
    <div className={s.wrap}>
      <div ref={ref} className={s.scroll} onScroll={check}>
        <div key={screenKey} className={s.content}>
          {children}
        </div>
      </div>
      {more && (
        <>
          <div className={s.fade} aria-hidden />
          <button
            className={s.moreBelow}
            aria-label="Scroll down to see more"
            onClick={() => ref.current?.scrollBy({ top: Math.round(ref.current.clientHeight * 0.7), behavior: reducedMotion() ? 'auto' : 'smooth' })}
          >
            More below
            <ArrowDown size="1.15em" strokeWidth={2.8} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
