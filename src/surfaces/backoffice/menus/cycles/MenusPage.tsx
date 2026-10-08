import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Check, Clock, Copy, Eye, Lock, LockOpen, MoreVertical, Pencil, Plus, Printer, Send } from 'lucide-react';
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
import { approvalOf, REQUEST_APPROVAL } from '../model/approval';
import { StateChip } from '../ui/menuBits';
import { AlaCarteBuilder } from './AlaCarteBuilder';
import { CycleBuilder } from './CycleBuilder';
import s from './MenusPage.module.css';

const KIND_LABEL: Record<MenuKind, string> = {
  cycle: 'Menu cycle',
  alc: 'À la carte',
};

const date = (t?: number | null) =>
  t
    ? new Date(t).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

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
    venues.filter((v) => v.menuId === m.id || v.alcMenuId === m.id || (v.upcoming ?? []).some((u) => u.menuId === m.id)).map((v) => v.name.replace(/ Dining Room$/, ''));
  const items = (m: BoMenu) => new Set(bo.grid.filter((g) => g.menuId === m.id && g.day === 0).map((g) => g.recipeId)).size;

  return (
    <BoPage
      title="Menu Cycle & À la Carte"
      actions={
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('backoffice', ['menus', blankMenu(target, tab)])}>
          {tab === 'alc' ? 'New à la carte menu' : 'New menu cycle'}
        </Button>
      }
    >
      <div className={s.tabs} role="tablist">
        {(
          [
            ['cycle', 'Menu cycles'],
            ['alc', 'À la carte menus'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={cx(s.tab, tab === k && s.tabOn)} onClick={() => setTab(k)}>
            <span className={s.tabLabel}>{label}</span>
          </button>
        ))}
      </div>

      <div className={s.toolbar}>
        <SearchField value={q} onChange={setQ} placeholder="Search menus" className={s.search} />
        <Select
          value={quarter}
          onChange={setQuarter}
          aria-label="Quarter"
          options={[
            ...quarterFilterOptions(bo.menus, nowQ).map((x) => {
              const idx = parseQuarter(x)?.index ?? nowQ;
              return {
                value: x,
                label: `${x} · ${quarterSeason(x)}${idx === nowQ ? ' (now)' : idx < nowQ ? ' (past)' : ''}`,
              };
            }),
            { value: YEAR_ROUND, label: YEAR_ROUND },
            { value: ARCHIVE, label: ARCHIVE },
          ]}
        />
        {quarter !== ARCHIVE && quarter !== YEAR_ROUND && <span className={s.range}>{quarterRange(quarter)}</span>}
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
            options={bo.menus
              .filter((m) => m.kind === kind)
              .map((m) => ({
                value: m.id,
                label: `${m.name} · ${m.quarter || 'no quarter'}`,
              }))}
          />
        </div>
      ))}

      <div className={s.tableCard}>
        <table className={s.table}>
          <thead>
            <tr>
              <th aria-label="Favorite" />
              <th>Menu</th>
              <th>Dietitian approval</th>
              <th>Last edited</th>
              <th className={s.r}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = r.menu;
              const st = menuState(m, venues);
              const w = r.everyDay ? venues.filter((v) => v.alcMenuId === `${m.id}:everyday`).map((v) => v.name.replace(/ Dining Room$/, '')) : where(m);
              const len = cycleLenOf(bo, m.id);
              const ap = approvalOf(m);
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
                    <div className={s.meta}>
                      <StateChip state={st} />
                      <span>
                        {r.everyDay ? 'À la carte' : KIND_LABEL[m.kind]} ·{' '}
                        {m.kind === 'cycle' && !r.everyDay ? (len > 0 ? `${Math.ceil(len / 7)} ${Math.ceil(len / 7) === 1 ? 'week' : 'weeks'}` : 'no length set') : `${items(m)} ${items(m) === 1 ? 'item' : 'items'}`}
                      </span>
                      {m.locked && (
                        <span className={s.lockedTag}>
                          <Lock size={12} aria-hidden /> Locked
                        </span>
                      )}
                    </div>
                    <div className={s.muted}>{w.length ? 'Served at ' + w.join(', ') : 'Not on a venue yet'}</div>
                  </td>
                  <td>
                    {!r.everyDay && (
                      <div className={cx(s.ap, s[`ap_${ap.step}`])}>
                        <span className={s.apLabel}>
                          {ap.step === 'approved' ? (
                            <Check size={14} strokeWidth={3} aria-hidden />
                          ) : ap.step === 'waiting' ? (
                            <Clock size={14} aria-hidden />
                          ) : null}
                          {ap.label}
                        </span>
                        {ap.detail && <span className={s.apDetail}>{ap.detail}</span>}
                        {ap.step === 'none' && (
                          <button
                            className={s.apSend}
                            onClick={() => {
                              updateMenu(m.id, REQUEST_APPROVAL);
                              toast(`${m.name} sent to the dietitian to approve`, { tone: 'success' });
                            }}
                          >
                            <Send size={13} aria-hidden /> Send for approval
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={s.strong}>{m.editedBy || '–'}</div>
                    <div className={s.muted}>{date(m.editedAt)}</div>
                  </td>
                  <td className={s.r}>
                    <span className={s.actions}>
                      <Button size="sm" variant="primary" icon={m.locked ? <Eye size={14} /> : <Pencil size={14} />} onClick={() => open(r)}>
                        {m.locked ? 'View' : 'Edit'}
                      </Button>
                      <Popover
                        trigger={({ toggle }) => (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            icon={<MoreVertical size={16} />}
                            aria-label={`More for ${m.name}`}
                            onClick={toggle}
                          />
                        )}
                        minWidth={230}
                      >
                        {({ close }) => (
                          <>
                            <MenuItem
                              icon={<Printer size={15} />}
                              onClick={() => {
                                close();
                                open(r, true);
                              }}
                            >
                              Print menus
                            </MenuItem>
                            {!r.everyDay && (
                              <MenuItem
                                icon={m.locked ? <LockOpen size={15} /> : <Lock size={15} />}
                                onClick={() => {
                                  updateMenu(m.id, { locked: !m.locked });
                                  toast(
                                    m.locked
                                      ? `${m.name} unlocked. It can be changed again.`
                                      : `${m.name} locked. Nobody can change it until it's unlocked.`,
                                  );
                                  close();
                                }}
                              >
                                {m.locked ? 'Unlock' : 'Lock so nobody can change it'}
                              </MenuItem>
                            )}
                            {!r.everyDay && (
                              <>
                                <MenuDivider />
                                <div className={s.menuHead}>Copy into a quarter as a draft</div>
                                {next4.map((qq) => (
                                  <MenuItem
                                    key={qq}
                                    icon={<Copy size={15} />}
                                    onClick={() => {
                                      clone(m, qq, m.kind);
                                      close();
                                    }}
                                  >
                                    {qq} · {quarterSeason(qq)}
                                  </MenuItem>
                                ))}
                                <MenuDivider />
                                {st === 'archived' || isArchived(m, venues, nowQ) ? (
                                  <MenuItem
                                    icon={<ArchiveRestore size={15} />}
                                    onClick={() => {
                                      updateMenu(m.id, { status: 'draft' });
                                      toast('Restored as a draft');
                                      close();
                                    }}
                                  >
                                    Restore from the archive
                                  </MenuItem>
                                ) : st !== 'active' ? (
                                  <MenuItem
                                    icon={<Archive size={15} />}
                                    onClick={() => {
                                      updateMenu(m.id, { status: 'archived' });
                                      toast('Moved to the archive');
                                      close();
                                    }}
                                  >
                                    Archive
                                  </MenuItem>
                                ) : (
                                  <div className={s.menuNote}>Serving now, so it can't be archived.</div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </Popover>
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
