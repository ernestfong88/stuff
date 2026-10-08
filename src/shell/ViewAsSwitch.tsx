import { BO_ROLES, setBoRole, useBoRole } from '../store/boRole';
import { toast } from '../ui';
import { cx } from '../ui/cx';
import s from './ViewAsSwitch.module.css';

/** Demo control: view Back Office as a community user or as Home Office (who alone sees HO Settings). */
export function ViewAsSwitch({ className }: { className?: string }) {
  const role = useBoRole();
  return (
    <div className={cx(s.row, className)} role="radiogroup" aria-label="View Back Office as">
      <span className={s.label}>View as</span>
      <span className={s.group}>
        {BO_ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={role === r.id}
            className={cx(s.opt, role === r.id && s.on)}
            onClick={() => {
              if (role === r.id) return;
              setBoRole(r.id);
              toast(r.id === 'homeOffice' ? 'Viewing Back Office as Home Office: HO Settings shows' : 'Viewing Back Office as the community: HO Settings is hidden', {
                tone: 'success',
              });
            }}
          >
            {r.label}
          </button>
        ))}
      </span>
    </div>
  );
}
