import { SideWorkAssign } from './SideWorkAssign';
import s from './SideWorkManager.module.css';

/** Manager view: assign today's side work to everyone on shift and see progress. */
export function SideWorkManager() {
  return (
    <div className={s.scroll}>
      <SideWorkAssign />
    </div>
  );
}
