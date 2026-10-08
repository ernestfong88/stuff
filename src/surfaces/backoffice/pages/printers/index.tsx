/**
 * Printers: every printer and card terminal in the community in one place.
 * The printers themselves (name, type, IP, the venues that use them,
 * whether they can be reached), what each prints when a server sends, the
 * same rules item by item for the menu, and the card terminals. Pick a
 * venue to see only its printers, its kitchen and its terminals.
 */
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useRoute } from '../../../../shell/router';
import { useVenueSettings } from '../../../../store/venueSettings';
import { Button, Tabs } from '../../../../ui';
import { AddPrinterDialog } from '../../../kitchen/admin/AddPrinterDialog';
import { BoPage } from '../../kit';
import type { BoPageProps } from '../../nav';
import { PrinterRouting } from '../PrinterRouting';
import { ByMenuItem } from './ByMenuItem';
import { openPrinters, PRINTER_TABS, type PrintersAt } from './link';
import { PrinterList } from './PrinterList';
import { Terminals } from './Terminals';

const ALL = 'all';

export default function Page(_props: BoPageProps) {
  const settings = useVenueSettings();
  const route = useRoute();
  const want = route.path[0] === 'printers' ? route.path[1] : undefined;
  const tab = PRINTER_TABS.find((t) => t === want) ?? PRINTER_TABS[0];
  const active = settings.venues.filter((v) => v.active);
  const asked = route.query.get('venue');
  const venue = active.find((v) => v.id === asked) ?? null;
  const focus = route.query.get('printer') ?? undefined;
  const [adding, setAdding] = useState(false);
  /** Switch tab or venue in place; the printer pointed at is let go. */
  const go = (at: PrintersAt) => openPrinters({ tab, venueId: venue?.id, ...at }, { replace: true });
  // A retired or unknown venue shows every venue.
  useEffect(() => {
    if (asked && !venue) openPrinters({ tab }, { replace: true });
  }, [asked, venue, tab]);

  const linked = (printerId: string) => settings.printerLinks.some((l) => l.printerId === printerId && l.venueId === venue?.id);
  const printerCount = venue ? settings.printers.filter((p) => linked(p.id)).length : settings.printers.length;
  const terminalCount = settings.terminals.filter((t) => (venue ? t.venueId === venue.id : active.some((v) => v.id === t.venueId))).length;

  return (
    <BoPage
      title="Printers"
      sub="Every kitchen, receipt and label printer and card terminal, the venues that use them, and what each printer prints when a server sends."
      actions={
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
          Add printer
        </Button>
      }
    >
      {active.length > 1 && (
        <Tabs
          variant="segmented"
          size="sm"
          aria-label="Venue"
          value={venue?.id ?? ALL}
          onChange={(id) => go({ venueId: id === ALL ? null : id })}
          options={[{ id: ALL, label: 'All venues' }, ...active.map((v) => ({ id: v.id, label: v.name }))]}
        />
      )}
      <Tabs
        variant="underline"
        aria-label="Printers sections"
        value={tab}
        onChange={(t) => go({ tab: t })}
        options={[
          { id: 'list', label: 'Printers', count: printerCount },
          { id: 'routing', label: 'What each printer prints' },
          { id: 'items', label: 'By menu item' },
          { id: 'terminals', label: 'Card terminals', count: terminalCount },
        ]}
      />
      {tab === 'list' && <PrinterList settings={settings} venue={venue} focus={focus} onAdd={() => setAdding(true)} />}
      {tab === 'routing' && <PrinterRouting venue={venue} />}
      {tab === 'items' && <ByMenuItem key={venue?.id ?? ALL} settings={settings} venue={venue} />}
      {tab === 'terminals' && <Terminals settings={settings} venues={venue ? [venue] : active} />}
      {adding && <AddPrinterDialog settings={settings} venue={venue ?? undefined} onClose={() => setAdding(false)} />}
    </BoPage>
  );
}
