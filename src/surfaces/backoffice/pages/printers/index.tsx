/**
 * Printers: every printer in the community in one place. The printers
 * themselves (name, type, IP, the venues that use them), what each prints
 * when a server sends, and the same rules item by item for the menu.
 * Venue Settings' Devices tab still shows each venue's printers.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useVenueSettings } from '../../../../store/venueSettings';
import { Button, Tabs } from '../../../../ui';
import { AddPrinterDialog } from '../../../kitchen/admin/AddPrinterDialog';
import { BoPage } from '../../kit';
import type { BoPageProps } from '../../nav';
import { usePageTab } from '../pageTab';
import { PrinterRouting } from '../PrinterRouting';
import { ByMenuItem } from './ByMenuItem';
import { PrinterList } from './PrinterList';

const TABS = ['list', 'routing', 'items'] as const;

export default function Page(_props: BoPageProps) {
  const settings = useVenueSettings();
  const [tab, setTab] = usePageTab('printers', TABS);
  const [adding, setAdding] = useState(false);
  return (
    <BoPage
      title="Printers"
      sub="Every kitchen, receipt and label printer, the venues that use it, and what it prints when a server sends."
      actions={
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
          Add printer
        </Button>
      }
    >
      <Tabs
        variant="underline"
        aria-label="Printers sections"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'list', label: 'Printers', count: settings.printers.length },
          { id: 'routing', label: 'What each printer prints' },
          { id: 'items', label: 'By menu item' },
        ]}
      />
      {tab === 'list' && <PrinterList settings={settings} onAdd={() => setAdding(true)} />}
      {tab === 'routing' && <PrinterRouting />}
      {tab === 'items' && <ByMenuItem settings={settings} />}
      {adding && <AddPrinterDialog settings={settings} onClose={() => setAdding(false)} />}
    </BoPage>
  );
}
