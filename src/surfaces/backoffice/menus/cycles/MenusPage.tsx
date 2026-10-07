import { useMemo, useState } from 'react';
import { Check, Copy, Lock, LockOpen, MoreVertical, Plus, Printer, X } from 'lucide-react';
import { now } from '../../../../lib/clock';
import { navigate, useRoute } from '../../../../shell/router';
import type { BoMenu, MenuKind } from '../../../../store/menuEdits';
import { Button, MenuDivider, MenuItem, Popover, SearchField, cx, toast } from '../../../../ui';
import { BoPage } from '../../kit';
import { cycleLenOf, useBo } from '../data';
import { blankMenu, cloneMenu, updateMenu } from '../menuActions';
import { menuState, parseQuarter, quarterIndexOf, quarterLabel, quarterRange, quarterSeason, venuesAt } from '../../../../domain/menuCycle';
import { ARCHIVE, YEAR_ROUND, isArchived, menuRows, quarterFilterOptions, quarterGaps, type MenuRow } from '../model/menuList';
import { Select } from '../ui/controls';
import { QuarterBadge, StateChip } from '../ui/menuBits';
import { AlaCarteBuilder } from './AlaCarteBuilder';
import { CycleBuilder } from './CycleBuilder';
import s from './MenusPage.module.css';

const KIND_LABEL: Record<MenuKind, string> = { cycle: 'Menu cycle', alc: 'À la carte' };

const date = (t?: number | null) => (t ? new Date(t).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '');

/** Menu Cycle & À la Carte: the quarter's menus, and the builders. */
export function MenusPage() {
  const { path } = useRoute();
  const bo = useBo();
  const openId = path[1];
  const menu = bo.menus.find((m) => m.id === openId);
  const back = () => navigate('backoffice', ['menus']);
  if (menu) {
    if (path[2] === 'everyday' || menu.kind === 'alc') return <AlaCarteBuilder menu={menu} everyDay={path[2] === 'everyday'} onBack={back} />;
    return <CycleBuilder menu={menu} onBack={back} />;
  }
  return <MenuList />;
}

function MenuList() {
  const bo = useBo();
  const [at] = useState(now);
  const nowQ = quarterIndexOf(at);
  const venues = useMemo(() => venuesAt(bo.venues, at), [bo.venues, at]);
  const [tab, setTab] = useState<MenuKind>('cycle');
  const [quarter, setQuarter] = useState(quarterLabel(nowQ));
  const [q, setQ] = useState('');
  const rows = menuRows(bo.menus, bo.grid, venues, tab, quarter, q, nowQ);
  const gaps = quarterGaps(bo.menus, bo.grid, venues, tab, quarter, nowQ);
  const target = quarter === ARCHIVE || quarter === YEAR_ROUND ? quarterLabel(nowQ) : quarter;
  const next4 = [0, 1, 2, 3].map((k) => quarterLabel(nowQ + k));
  const open = (r: MenuRow, print?: boolean) => {
    navigate('backoffice', ['menus', r.menu.id, ...(r.everyDay ? ['everyday'] : [])]);
    if (print) toast(`Opening ${r.menu.name} to print. Print menus is at the top of the builder.`);
  };
  const clone = (m: BoMenu, qq: string, kind: MenuKind) => {
    const id = cloneMenu(m.id, qq, kind);
    toast(`Copied ${m.name} into ${qq} as a draft`, { tone: 'success' });
    return id;
  };
  const where = (m: BoMenu) =>
    venues.filter((v) => v.menuId === m.id || (v.upcoming ?? []).some((u) => u.menuId === m.id)).map((v) => v.name.replace(/ Dining Room$/, ''));
  const items = (m: BoMenu) => new Set(bo.grid.filter((g) => g.menuId === m.id && g.day === 0).map((g) => g.recipeId)).size;

  return (
    <BoPage
      title="Menu Cycle & À la Carte"
      sub="Every quarter needs a weekly menu cycle and an à la carte menu. Past menus stay in the Archive for reference."
      actions={
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('backoffice', ['menus', blankMenu(target, tab)])}>
          {tab === 'alc' ? 'New à la carte menu' : 'New menu cycle'}
        </Button>
      }
    >
      <div className={s.tabs} role="tablist">
        {(
          [
            ['cycle', 'Menu cycles', 'Weekly menus that rotate'],
            ['alc', 'À la carte menus', 'The standing menu, every day'],
          ] as const
        ).map(([k, label, sub]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={cx(s.tab, tab === k && s.tabOn)} onClick={() => setTab(k)}>
            <span className={s.tabLabel}>{label}</span>
            <span className={s.tabSub}>{sub}</span>
          </button>
        ))}
      </div>

      <div className={s.toolbar}>
        <SearchField value={q} onChange={setQ} placeholder="Search…" className={s.search} />
        <Select
          value={quarter}
          onChange={setQuarter}
          aria-label="Quarter"
          options={[
            ...quarterFilterOptions(bo.menus, nowQ).map((x) => {
              const idx = parseQuarter(x)?.index ?? nowQ;
              return { value: x, label: `${x} · ${quarterSeason(x)}${idx === nowQ ? ' (now)' : idx < nowQ ? ' (past)' : ''}` };
            }),
            { value: YEAR_ROUND, label: YEAR_ROUND },
            { value: ARCHIVE, label: ARCHIVE },
          ]}
        />
        {quarter !== ARCHIVE && quarter !== YEAR_ROUND && (
          <>
            <QuarterBadge q={quarter} big />
            <span className={s.range}>{quarterRange(quarter)}</span>
          </>
        )}
      </div>

      {gaps.map((kind) => (
        <div key={kind} className={s.gap}>
          <b>
            {quarter} still needs {kind === 'alc' ? 'an à la carte menu' : 'a menu cycle'}.
          </b>
          <Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => navigate('backoffice', ['menus', blankMenu(quarter, kind)])}>
            Start {kind === 'alc' ? 'à la carte' : 'menu cycle'}
          </Button>
          <Select
            size="sm"
            value=""
            aria-label={`Copy from ${KIND_LABEL[kind]}`}
            onChange={(id) => {
              const m = bo.menus.find((x) => x.id === id);
              if (m) navigate('backoffice', ['menus', clone(m, quarter, kind)]);
            }}
            placeholder={`Copy ${kind === 'alc' ? 'à la carte' : 'menu cycle'} from…`}
            options={bo.menus.filter((m) => m.kind === kind).map((m) => ({ value: m.id, label: `${m.name} · ${m.quarter || 'no quarter'}` }))}
          />
        </div>
      ))}

      <div className={s.tableCard}>
        <table className={s.table}>
          <thead>
            <tr>
              <th aria-label="Favorite" />
              <th>Name</th>
              <th>Last edited</th>
              <th className={s.c}>Locked</th>
              <th className={s.c}>Date signed</th>
              <th className={s.c}>Approve my menu</th>
              <th className={s.c}>Approval status</th>
              <th className={s.r}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = r.menu;
              const st = menuState(m, venues);
              const w = where(m);
              const len = cycleLenOf(bo, m.id);
              return (
                <tr key={(r.everyDay ? 'ev' : '') + m.id}>
                  <td className={s.starCell}>
                    {!r.everyDay && (
                      <button
                        className={cx(s.star, m.fav && s.starOn)}
                        aria-pressed={!!m.fav}
                        aria-label={m.fav ? `Remove ${m.name} from favorites` : `Add ${m.name} to favorites`}
                        onClick={() => updateMenu(m.id, { fav: !m.fav })}
                      >
                        {m.fav ? '★' : '☆'}
                      </button>
                    )}
                  </td>
                  <td>
                    <button className={s.name} onClick={() => open(r)}>
                      {r.everyDay ? `${m.name} · Every-day items` : m.name}
                    </button>
                    {r.everyDay && <div className={s.muted}>Served every day alongside the {m.name} cycle</div>}
                    <div className={s.meta}>
                      <span className={s.kind}>{r.everyDay ? 'À la carte' : KIND_LABEL[m.kind]}</span>
                      <StateChip state={st} />
                      <span>{m.kind === 'cycle' && !r.everyDay ? (len > 0 ? `${Math.ceil(len / 7)} weeks` : 'no cycle set') : `${items(m)} items`}</span>
                    </div>
                    <div className={s.muted}>{w.length ? 'Served at ' + w.join(', ') : 'Not on a venue'}</div>
                  </td>
                  <td>
                    <div className={s.strong}>{m.editedBy || '–'}</div>
                    <div className={s.muted}>{date(m.editedAt)}</div>
                  </td>
                  <td className={s.c}>
                    <button
                      className={cx(s.lock, m.locked && s.locked)}
                      aria-label={m.locked ? `Unlock ${m.name}` : `Lock ${m.name}`}
                      title={m.locked ? 'Locked. Tap to unlock.' : 'Unlocked. Tap to lock.'}
                      onClick={() => {
                        updateMenu(m.id, { locked: !m.locked });
                        toast(m.locked ? 'Unlocked' : 'Locked so it cannot be edited');
                      }}
                    >
                      {m.locked ? <Lock size={18} /> : <LockOpen size={18} />}
                    </button>
                  </td>
                  <td className={s.c}>
                    {m.signedBy && (
                      <>
                        <div className={s.signed}>{m.signedBy}</div>
                        <div className={s.muted}>{date(m.signedAt)}</div>
                      </>
                    )}
                  </td>
                  <td className={s.c}>
                    <button
                      className={s.approve}
                      disabled={!!m.approveReq}
                      title={m.approveReq ? 'Approval requested' : 'Request approval'}
                      onClick={() => {
                        updateMenu(m.id, { approveReq: true, approval: 'Pending signature' });
                        toast('Sent to the dietitian to approve', { tone: 'success' });
                      }}
                    >
                      {m.approveReq ? 'Yes' : 'No'}
                      <span className={cx(s.shield, m.approveReq && s.shieldOn)}>
                        {m.approveReq ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  </td>
                  <td className={cx(s.c, s.approval, m.approval === 'Approved' && s.approved)}>{m.approval}</td>
                  <td className={s.r}>
                    <span className={s.actions}>
                      <Button size="sm" variant="success" onClick={() => open(r)}>
                        Menu builder
                      </Button>
                      <Button size="sm" variant="warning" iconOnly icon={<Printer size={15} />} aria-label={`Print ${m.name}`} onClick={() => open(r, true)} />
                      {!r.everyDay && (
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          icon={<Copy size={15} />}
                          aria-label={`Copy ${m.name} into ${target}`}
                          title={`Copy into ${target}`}
                          onClick={() => clone(m, target, m.kind)}
                        />
                      )}
                      {!r.everyDay && (
                        <Popover
                          trigger={({ toggle }) => (
                            <Button size="sm" variant="ghost" iconOnly icon={<MoreVertical size={16} />} aria-label={`More for ${m.name}`} onClick={toggle} />
                          )}
                          minWidth={220}
                        >
                          {({ close }) => (
                            <>
                              {st === 'archived' || isArchived(m, venues, nowQ) ? (
                                <MenuItem
                                  onClick={() => {
                                    updateMenu(m.id, { status: 'draft' });
                                    toast('Restored as a draft');
                                    close();
                                  }}
                                >
                                  Restore
                                </MenuItem>
                              ) : st !== 'active' ? (
                                <MenuItem
                                  onClick={() => {
                                    updateMenu(m.id, { status: 'archived' });
                                    toast('Moved to the archive');
                                    close();
                                  }}
                                >
                                  Archive
                                </MenuItem>
                              ) : (
                                <div className={s.menuNote}>Serving now, so it cannot be archived.</div>
                              )}
                              <MenuDivider />
                              <div className={s.menuHead}>Copy into</div>
                              {next4.map((qq) => (
                                <MenuItem
                                  key={qq}
                                  onClick={() => {
                                    clone(m, qq, m.kind);
                                    close();
                                  }}
                                >
                                  {qq} · {quarterSeason(qq)}
                                </MenuItem>
                              ))}
                            </>
                          )}
                        </Popover>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className={s.empty}>
            {q.trim()
              ? 'No menus match your search.'
              : quarter === ARCHIVE
                ? 'Nothing archived yet.'
                : `No ${tab === 'alc' ? 'à la carte menus' : 'menu cycles'} for ${quarter} yet.`}
          </div>
        )}
      </div>
    </BoPage>
  );
}
