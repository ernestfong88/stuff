/**
 * Release Phases (HO Settings): mark each back office page Phase 1 or
 * Phase 2. Phase 2 pages get a tag in the side nav and a banner on the page,
 * and the side nav's "Phase 1 only" view hides them.
 */
import { Copy, RotateCcw } from 'lucide-react';
import { Button, Tabs, toast } from '../../../ui';
import { BoCallout, BoPage, BoRow, BoSection, BoStatRow, BoStatTile } from '../kit';
import { BO_PAGES, BO_SECTIONS } from '../nav';
import { phaseListText, phaseOf, phaseTwoPages, resetPhases, setPhase, setPhaseView, usePhasePlan, usePhaseView, type Phase } from '../phases';
import s from './phases/phases.module.css';

export default function Page() {
  const plan = usePhasePlan();
  const view = usePhaseView();
  const later = phaseTwoPages(plan).length;
  const isDefault = BO_PAGES.every((p) => phaseOf(p.id, plan) === (p.phase ?? 1));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phaseListText(plan));
      toast('The phase list is copied', { tone: 'success' });
    } catch {
      toast("Couldn't copy. Your browser blocked the clipboard.", { tone: 'danger' });
    }
  };

  return (
    <BoPage
      title="Release Phases"
      sub="Mark which back office pages ship in Phase 1 and which come in Phase 2. Phase 2 pages show a tag in the menu and a banner at the top."
      actions={
        <>
          <Button icon={<Copy size={15} />} onClick={copy}>
            Copy as a list
          </Button>
          <Button
            icon={<RotateCcw size={15} />}
            disabled={isDefault}
            onClick={() => {
              resetPhases();
              toast('Every page is back to its standard phase', { tone: 'success' });
            }}
          >
            Reset
          </Button>
        </>
      }
    >
      <BoStatRow>
        <BoStatTile label="Phase 1 pages" value={BO_PAGES.length - later} tone="ocean" />
        <BoStatTile label="Phase 2 pages" value={later} />
      </BoStatRow>

      <BoSection title="Menu shows" sub="The same switch is at the bottom of the side menu.">
        <BoRow label="Pages in the side menu" hint={view === 'p1' ? 'Phase 2 pages are hidden. Search still finds them.' : 'Every page, with Phase 2 pages tagged.'}>
          <Tabs
            variant="segmented"
            size="sm"
            aria-label="Pages in the side menu"
            value={view}
            onChange={(v) => setPhaseView(v)}
            options={[
              { id: 'all', label: 'All pages' },
              { id: 'p1', label: 'Phase 1 only' },
            ]}
          />
        </BoRow>
      </BoSection>

      {BO_SECTIONS.map((sec) => (
        <BoSection key={sec.id} title={sec.label}>
          {sec.pages.map((p) => (
            <BoRow key={p.id} label={p.label} hint={p.blurb}>
              <Tabs
                variant="segmented"
                size="sm"
                className={s.phase}
                aria-label={`${p.label} release phase`}
                value={String(phaseOf(p.id, plan)) as '1' | '2'}
                onChange={(v) => setPhase(p.id, Number(v) as Phase)}
                options={[
                  { id: '1', label: 'Phase 1' },
                  { id: '2', label: 'Phase 2' },
                ]}
              />
            </BoRow>
          ))}
        </BoSection>
      ))}

      <BoCallout tone="info">
        The phases are saved in this browser. To share the split, use Copy as a list and send it on, or have it built into the app so every
        device starts with it.
      </BoCallout>
    </BoPage>
  );
}
