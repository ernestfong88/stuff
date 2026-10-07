/**
 * Specials Display: a dining room TV with no controls. It shows the current
 * meal's specials, one dish at a time for four seconds each, crossfading (a
 * plain swap under reduced motion), and follows the clock from breakfast to
 * dinner. #/display?meal=Lunch pins a meal. Staff can also tap the top left
 * corner three times to step through Breakfast, Lunch and Dinner and back to
 * the clock; nothing on screen gives the spot away.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { now } from '../../lib/clock';
import { useRoute } from '../../shell/router';
import { is86, use86 } from '../../store/eightySix';
import { useNow } from '../../ui';
import { mealAt, parseMeal } from '../pud/service/meals';
import type { MealName } from '../../domain/types';
import { DishSlide } from './DishSlide';
import { displaySlides, nextPreview, slideLabel, specialsLabel } from './specials';
import { StaffCorner } from './StaffCorner';
import s from './Display.module.css';

/** How long each dish stays up. */
const SLIDE_MS = 4000;
const TAPS = 3;
const TAP_WINDOW_MS = 1500;

export default function SpecialsDisplay() {
  const { query } = useRoute();
  const clockMeal = mealAt(useNow(30_000));
  const [pin, setPin] = useState<MealName | null>(() => parseMeal(query.get('meal')));
  const [note, setNote] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const taps = useRef<number[]>([]);
  const marks = use86();

  const meal = pin ?? clockMeal;
  const slides = useMemo(() => displaySlides(meal, (id) => is86(marks, id)), [meal, marks]);
  const key = slides.map((x) => x.item.id).join();
  const entreeCount = slides.filter((x) => x.kind === 'entree').length;

  useEffect(() => {
    setIndex(0);
    if (slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [key, slides.length]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3000);
    return () => clearTimeout(t);
  }, [note]);

  const tap = () => {
    const at = now();
    taps.current = [...taps.current.filter((t) => at - t < TAP_WINDOW_MS), at];
    if (taps.current.length < TAPS) return;
    taps.current = [];
    const next = nextPreview(pin);
    setPin(next);
    setNote(next ? `Preview: ${next}` : `Following the clock (${mealAt(now())})`);
  };

  return (
    <div className={s.screen} data-meal={meal}>
      {slides.length ? (
        slides.map((slide, i) => (
          <DishSlide key={slide.item.id} slide={slide} active={i === index % slides.length} label={slideLabel(slide, meal, entreeCount)} />
        ))
      ) : (
        <div className={s.empty}>
          <div className={s.emptyLabel}>{specialsLabel(meal, false)}</div>
          <div className={s.emptyTitle}>Please ask about today&rsquo;s menu</div>
        </div>
      )}
      {slides.length > 1 && (
        <div className={s.dots} aria-hidden>
          {slides.map((x, i) => (
            <span key={x.item.id} className={i === index % slides.length ? s.dotOn : s.dot} />
          ))}
        </div>
      )}
      <div className={s.previewSpot} onPointerDown={tap} aria-hidden />
      {note && (
        <div className={s.note} role="status">
          {note}
        </div>
      )}
      <StaffCorner dark />
    </div>
  );
}
