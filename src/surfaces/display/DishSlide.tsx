import { dishPhoto } from '../../data/photos';
import { cx } from '../../ui';
import { PlateGlyph } from './PlateGlyph';
import { listWords } from '../kiosk/model/menu';
import type { DisplaySlide } from './specials';
import s from './DishSlide.module.css';

/**
 * One dish full screen: its wide photo with the name over a dark fade, or,
 * when there is no photo, a typographic card with a drawn place setting.
 */
export function DishSlide({ slide, label, active }: { slide: DisplaySlide; label: string; active: boolean }) {
  const photo = dishPhoto(slide.item.name, true);
  return (
    <div className={cx(s.slide, active && s.active, !photo && s.plain)} aria-hidden={!active}>
      {photo ? (
        <>
          <img className={s.photo} src={photo} alt="" draggable={false} />
          <div className={s.fade} />
        </>
      ) : (
        <PlateGlyph className={s.plate} />
      )}
      <div className={s.text}>
        <div className={s.label}>{label}</div>
        <h2 className={s.name}>{slide.name}</h2>
        {slide.item.desc && <p className={s.desc}>{slide.item.desc}</p>}
        {slide.sides.length > 0 && <p className={s.sides}>Served with {listWords(slide.sides)}</p>}
      </div>
    </div>
  );
}
