import { dishPhoto } from '../../data/photos';
import { cx } from '../../ui';
import s from './DishPicture.module.css';

/** The dish photo, or a plate drawing when the kitchen has not added one. */
export function DishPicture({ name, size = 'row' }: { name: string; size?: 'row' | 'card' }) {
  const url = dishPhoto(name, size !== 'row');
  return (
    <span className={cx(s.pic, s[size])} aria-hidden="true">
      {url ? (
        <img src={url} alt="" className={s.img} />
      ) : (
        <svg viewBox="0 0 48 48" className={s.plate}>
          <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="24" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <path d="M6 9v9m-2-9v5a2 2 0 0 0 4 0V9M42 9c-2 2-2 6 0 9v12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
