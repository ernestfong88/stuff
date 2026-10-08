import { ArrowLeft } from 'lucide-react';
import { navigate } from '../../shell/router';
import { useHeaderFit } from '../../shell/headerFit';
import { setMineMode } from '../../store/serverMine';
import { Button } from '../../ui';
import s from './PudBoard.module.css';

/** Header button back to the server's My tables; just the arrow when the header is short of room. */
export function MyTablesButton() {
  const short = useHeaderFit() >= 2;
  return (
    <Button
      className={s.navBtn}
      icon={<ArrowLeft size={16} strokeWidth={2.25} />}
      iconOnly={short}
      aria-label={short ? 'My tables' : undefined}
      onClick={() => {
        setMineMode('tables');
        navigate('server', ['mine']);
      }}
    >
      {short ? null : 'My tables'}
    </Button>
  );
}
