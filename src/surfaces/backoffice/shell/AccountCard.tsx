import { useCallback, useRef, useState } from 'react';
import { Building2, ChevronUp } from 'lucide-react';
import { cx } from '../../../ui';
import { ViewAsSwitch } from '../../../shell/ViewAsSwitch';
import { useBoRole } from '../../../store/boRole';
import { backOfficeUser, type BackOfficeUser } from '../seed/associates';
import { useDismiss } from './useDismiss';
import s from './SideFooter.module.css';

function Initials({ me, size }: { me: BackOfficeUser; size: 32 | 40 }) {
  return (
    <span className={cx(s.avatar, size === 40 && s.avatarLg)} aria-hidden>
      {me.initials}
    </span>
  );
}

/** The signed-in back office user (a community user, or Home Office in the demo), with their home community and department. */
export function AccountCard() {
  const me = backOfficeUser(useBoRole());
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, trigger);
  return (
    <div className={s.anchor} ref={root}>
      <button ref={trigger} className={cx(s.me, open && s.pressed)} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Initials me={me} size={32} />
        <span className={s.meText}>
          <span className={s.meName}>{me.name}</span>
          <span className={s.meRole}>{me.role}</span>
        </span>
        <ChevronUp size={15} className={cx(s.chev, open && s.chevOpen)} aria-hidden />
      </button>
      {open && (
        <div className={cx(s.panel, s.mePanel)} role="dialog" aria-label="My account">
          <div className={s.meHead}>
            <Initials me={me} size={40} />
            <div>
              <div className={s.meHeadName}>{me.name}</div>
              <div className={s.meHeadRole}>{me.role}</div>
            </div>
          </div>
          <div className={s.meFacts}>
            <div>
              <div className={s.eyebrow}>{me.homeLabel}</div>
              <div className={s.home}>
                <Building2 size={14} aria-hidden />
                {me.home}
              </div>
            </div>
            <div>
              <div className={s.eyebrow}>{me.departments.length > 1 ? 'Departments' : 'Department'}</div>
              <div className={s.depts}>
                {me.departments.map((d) => (
                  <span key={d} className={s.dept}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className={s.meDemo}>
            <ViewAsSwitch />
          </div>
        </div>
      )}
    </div>
  );
}
