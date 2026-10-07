import { useState } from 'react';
import { Plus, Printer as PrinterIcon, Send, Trash2, X } from 'lucide-react';
import { uid } from '../../../../lib/id';
import { printRoute } from '../../../../domain/printing';
import {
  linkPrinter,
  patchPrinter,
  removePrinter,
  renamePrinter,
  unlinkPrinter,
  type Printer,
  type PrinterType,
  type VenueSettings,
} from '../../../../store/venueSettings';
import { Button, Chip, MenuItem, Popover, toast, useConfirm } from '../../../../ui';
import { BoSection } from '../../kit';
import s from './printers.module.css';

const TYPES: PrinterType[] = ['Kitchen', 'Receipt', 'Label'];

/** Every printer: its name, type and IP, the venues that use it, whether it's working. */
export function PrinterList({ settings, onAdd }: { settings: VenueSettings; onAdd: () => void }) {
  const [ask, dialog] = useConfirm();
  const remove = async (p: Printer) => {
    const n = settings.printerLinks.filter((l) => l.printerId === p.id).length;
    const ok = await ask({
      title: `Remove ${p.name}?`,
      message: n
        ? `It comes off ${n === 1 ? 'the venue' : `all ${n} venues`} that use it${printRoute(p) === 'all' ? '' : ', and its items print where their group or category is set instead'}.`
        : 'No venue uses it.',
      confirmLabel: 'Remove printer',
      tone: 'danger',
    });
    if (!ok) return;
    removePrinter(p.id);
    toast(`${p.name} removed`);
  };

  return (
    <BoSection
      title="Printers"
      sub="Change a name or IP by typing over it. A printer prints for every venue it's added to; a venue's kitchen tickets go to its printers."
    >
      {settings.printers.length ? (
        <ul className={s.list}>
          {settings.printers.map((p) => (
            <PrinterRow key={p.id} printer={p} settings={settings} onRemove={() => void remove(p)} />
          ))}
        </ul>
      ) : (
        <div className={s.emptyBox}>
          <p className={s.empty}>No printers yet. Add one so tickets and receipts can print.</p>
          <Button icon={<Plus size={14} />} onClick={onAdd}>
            Add printer
          </Button>
        </div>
      )}
      {dialog}
    </BoSection>
  );
}

function PrinterRow({ printer: p, settings, onRemove }: { printer: Printer; settings: VenueSettings; onRemove: () => void }) {
  const links = settings.printerLinks.filter((l) => l.printerId === p.id);
  const linkedIds = new Set(links.map((l) => l.venueId));
  const addable = settings.venues.filter((v) => v.active && !linkedIds.has(v.id));
  const venueName = (id: string) => settings.venues.find((v) => v.id === id)?.name ?? 'Unknown venue';

  return (
    <li className={s.printer}>
      <PrinterIcon size={18} className={s.printerIcon} aria-hidden />
      <div className={s.printerMain}>
        <div className={s.fields}>
          <InlineText
            className={s.nameInput}
            value={p.name}
            label={`Name of ${p.name}`}
            onSave={(v) => {
              if (!v.trim()) return toast('A printer needs a name');
              renamePrinter(p.id, v);
            }}
          />
          <select
            className={s.typeSelect}
            aria-label={`Type of ${p.name}`}
            value={p.type}
            onChange={(e) => patchPrinter(p.id, { type: e.target.value })}
          >
            {(TYPES as string[]).includes(p.type) ? null : <option>{p.type}</option>}
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <InlineText
            className={s.ipInput}
            value={p.ip}
            label={`IP of ${p.name}`}
            placeholder="IP address"
            onSave={(v) => patchPrinter(p.id, { ip: v.trim() })}
          />
        </div>
        <div className={s.venues} role="group" aria-label={`Venues that use ${p.name}`}>
          {links.map((l) => (
            <span key={l.id} className={s.venueChip}>
              {venueName(l.venueId)}
              <button
                className={s.venueX}
                aria-label={`Remove ${p.name} from ${venueName(l.venueId)}`}
                onClick={() => {
                  unlinkPrinter(l.id);
                  toast(`${p.name} removed from ${venueName(l.venueId)}`);
                }}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {!links.length && <span className={s.noVenue}>No venue uses it</span>}
          {addable.length > 0 && (
            <Popover
              align="left"
              trigger={({ toggle }) => (
                <button className={s.addVenue} onClick={toggle} aria-label={`Add ${p.name} to a venue`}>
                  <Plus size={13} /> Venue
                </button>
              )}
            >
              {({ close }) =>
                addable.map((v) => (
                  <MenuItem
                    key={v.id}
                    onClick={() => {
                      linkPrinter({ id: uid('pr'), printerId: p.id, venueId: v.id });
                      toast(`${p.name} added to ${v.name}`);
                      close();
                    }}
                  >
                    {v.name}
                  </MenuItem>
                ))
              }
            </Popover>
          )}
        </div>
      </div>
      <div className={s.printerEnd}>
        {!p.active ? <Chip>Off</Chip> : p.reachable ? <Chip tone="success">Working</Chip> : <Chip tone="danger">Can't be reached</Chip>}
        <Button
          size="sm"
          variant="ghost"
          icon={<Send size={14} />}
          onClick={() =>
            toast(p.reachable ? `Test page sent to ${p.name}` : `${p.name} can't be reached at ${p.ip || 'no IP'}. Check it's on and plugged in.`)
          }
        >
          Test
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          icon={<Trash2 size={15} />}
          aria-label={`Remove ${p.name}`}
          title="Remove printer"
          onClick={onRemove}
        />
      </div>
    </li>
  );
}

/** A text box that saves on Enter or when it loses focus; Escape puts it back. */
function InlineText({
  value,
  label,
  placeholder,
  className,
  onSave,
}: {
  value: string;
  label: string;
  placeholder?: string;
  className?: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onSave(draft);
    setDraft(null);
  };
  return (
    <input
      className={className}
      value={draft ?? value}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(null);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}
