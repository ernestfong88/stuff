import { useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { COMMUNITY_NAME } from '../../../../data';
import { now } from '../../../../lib/clock';
import { Button, Chip, SearchField, Tabs, toast, useConfirm } from '../../../../ui';
import { BoIconButton, BoPage, BoStatRow, BoStatTile, BoTable, type BoColumn, type BoSort } from '../../kit';
import type { BoPageProps } from '../../nav';
import { ADP_ASSOCIATES, type AdpAssociate } from '../../seed/associates';
import { addedText, currentPin, filterAssociates, newPin, setPin, usePinOverrides, type AssociateSortKey, type SignIn } from './pins';
import s from './access.module.css';

/** Associates & PINs: everyone from ADP and how they sign in to the Culinary App. */
export default function AssociatesPage(_props: BoPageProps) {
  const overrides = usePinOverrides();
  const [ask, dialog] = useConfirm();
  const [query, setQuery] = useState('');
  const [how, setHow] = useState<SignIn>('all');
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [fresh, setFresh] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<BoSort>({ key: 'name', dir: 1 });
  const rows = filterAssociates(ADP_ASSOCIATES, { query, how, sort: { key: sort.key as AssociateSortKey, dir: sort.dir } });
  const nWin = ADP_ASSOCIATES.filter((a) => a.win).length;
  const nNew = ADP_ASSOCIATES.filter((a) => a.days <= 30).length;

  const reset = async (a: AdpAssociate) => {
    const ok = await ask({ title: `Reset ${a.name}'s PIN?`, message: 'The new PIN works right away and the old one stops working.', confirmLabel: 'Reset PIN' });
    if (!ok) return;
    const inUse = new Set(ADP_ASSOCIATES.map((x) => currentPin(x, overrides)).filter((p): p is string => !!p));
    setPin(a.id, newPin(inUse));
    setShown((v) => ({ ...v, [a.id]: true }));
    setFresh((v) => ({ ...v, [a.id]: true }));
    toast(`New PIN for ${a.name}. The old one stops working now.`, { tone: 'success' });
  };

  const columns: Array<BoColumn<AdpAssociate>> = [
    {
      key: 'name',
      header: 'Associate',
      sortable: true,
      render: (a) => (
        <span className={s.person}>
          <span className={s.initials} aria-hidden>
            {a.id}
          </span>
          <span>
            <span className={s.name}>{a.name}</span>
            <span className={s.sub}>ADP #{a.emp}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Job title',
      sortable: true,
      render: (a) => (
        <span>
          <span className={s.title}>{a.title}</span>
          <span className={s.sub}>{a.dept}</span>
        </span>
      ),
    },
    {
      key: 'how',
      header: 'Signs in with',
      sortable: true,
      render: (a) =>
        a.win ? (
          <Chip tone="info" size="xs">
            Windows · {a.win}
          </Chip>
        ) : (
          <Chip tone="warning" size="xs">
            PIN
          </Chip>
        ),
    },
    {
      key: 'pin',
      header: 'Culinary App PIN',
      render: (a) => {
        if (a.win) return <span className={s.muted}>Not needed</span>;
        const visible = !!shown[a.id];
        return (
          <span className={s.pin}>
            <span className={s.pinValue} aria-label={visible ? undefined : 'PIN hidden'}>
              {visible ? currentPin(a, overrides) : '••••'}
            </span>
            <BoIconButton aria-label={`${visible ? 'Hide' : 'Show'} ${a.name}'s PIN`} onClick={() => setShown((v) => ({ ...v, [a.id]: !visible }))}>
              {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            </BoIconButton>
            {fresh[a.id] && (
              <Chip tone="success" size="xs">
                New PIN
              </Chip>
            )}
          </span>
        );
      },
    },
    { key: 'added', header: 'Added from ADP', sortable: true, render: (a) => <span className={a.days <= 30 ? s.recent : undefined}>{addedText(a.days, now())}</span> },
    {
      key: 'reset',
      header: '',
      align: 'right',
      render: (a) =>
        !a.win && (
          <Button size="sm" icon={<RefreshCw size={13} />} onClick={() => void reset(a)}>
            Reset PIN
          </Button>
        ),
    },
  ];

  return (
    <BoPage
      title="Associates & PINs"
      sub={`Everyone at ${COMMUNITY_NAME} in ADP. Accounts are created from the ADP feed, and associates without a Windows login get a Culinary App PIN automatically.`}
    >
      <div className={s.sync}>
        <span className={s.syncIcon}>
          <RefreshCw size={16} aria-hidden />
        </span>
        <div className={s.syncText}>
          <div className={s.syncTitle}>Synced with ADP today at 5:00 AM</div>
          <div className={s.syncSub}>
            New hires get an account and a PIN on the next sync. When someone leaves in ADP, their account and PIN are turned off. Names, titles and logins can only be changed in ADP.
          </div>
        </div>
        <Chip tone="success" size="xs">
          Automatic
        </Chip>
      </div>

      <BoStatRow>
        <BoStatTile value={ADP_ASSOCIATES.length} label="associates in ADP" active={how === 'all'} onClick={() => setHow('all')} />
        <BoStatTile value={nWin} label="sign in with Windows" active={how === 'win'} onClick={() => setHow(how === 'win' ? 'all' : 'win')} />
        <BoStatTile value={ADP_ASSOCIATES.length - nWin} label="use a Culinary App PIN" active={how === 'pin'} onClick={() => setHow(how === 'pin' ? 'all' : 'pin')} />
        <BoStatTile
          value={nNew}
          label="added in the last 30 days"
          onClick={() => {
            setHow('all');
            setSort({ key: 'added', dir: 1 });
          }}
        />
      </BoStatRow>

      <div className={s.toolbar}>
        <SearchField value={query} onChange={setQuery} placeholder="Search name, title, ADP number or login" aria-label="Search associates" className={s.search} />
        <Tabs
          variant="segmented"
          size="sm"
          aria-label="Signs in with"
          value={how}
          onChange={setHow}
          options={[
            { id: 'all', label: 'Everyone' },
            { id: 'pin', label: 'PIN' },
            { id: 'win', label: 'Windows' },
          ]}
        />
        <span className={s.count}>
          {rows.length} {rows.length === 1 ? 'associate' : 'associates'}
        </span>
      </div>

      <BoTable caption="Associates" columns={columns} rows={rows} rowKey={(a) => a.id} sort={sort} onSort={setSort} empty="No associate matches that search." />
      <p className={s.foot}>PINs are 4 digits and only sign in to the Culinary App. Resetting makes a new one right away, so give it to the associate before their next shift.</p>
      {dialog}
    </BoPage>
  );
}
