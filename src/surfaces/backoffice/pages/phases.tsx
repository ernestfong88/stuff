/**
 * Release Phases (HO Settings): mark each screen in the mode menu and each
 * back office page Phase 1, 2 or 3. Later phases take their own colour (purple
 * for 2, brown for 3) and move below the earlier ones (a section with no
 * earlier page moves down the side menu too), and the "Phase 1 only" view
 * hides them.
 */
import { Copy, RotateCcw } from 'lucide-react';
import { Button, Tabs, toast } from '../../../ui';
import { BoCallout, BoPage, BoRow, BoSection, BoStatRow, BoStatTile } from '../kit';
import { MODES, modePhase, modePhaseKey } from '../../../shell/modes';
import { BO_SECTIONS } from '../nav';
import { PHASES, pagesInPhase, phaseListText, phaseOf, resetPhases, setPhase, setPhaseView, usePhasePlan, usePhaseView, type Phase } from '../phases';
import s from './phases/phases.module.css';

export default function Page() {
  const plan = usePhasePlan();
  const view = usePhaseView();

  const isDefault = Object.keys(plan).length === 0;
  const screensIn = (ph: Phase) => MODES.filter((m) => modePhase(m.id, plan) === ph).length;
  const pagesIn = (ph: Phase) => pagesInPhase(plan, ph).length;
  const phasePick = (label: string, value: Phase, onChange: (p: Phase) => void) => (
    <Tabs
      variant="segmented"
      size="sm"
      className={s.phase}
      aria-label={`${label} release phase`}
      value={String(value) as '1' | '2' | '3'}
      onChange={(v) => onChange(Number(v) as Phase)}
      options={[
        { id: '1', label: 'Phase 1' },
        { id: '2', label: 'Phase 2' },
        { id: '3', label: 'Phase 3' },
      ]}
    />
  );

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
      sub="Mark which screens and back office pages ship in Phase 1, Phase 2 or Phase 3. Phase 2 items show in purple and Phase 3 in brown, below the earlier ones, and a later page has a banner at the top."
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
        {PHASES.map((ph) => (
          <BoStatTile key={ph} label={`Phase ${ph}: screens · pages`} value={`${screensIn(ph)} · ${pagesIn(ph)}`} tone={ph === 1 ? 'ocean' : undefined} />
        ))}
      </BoStatRow>

      <BoSection title="Menus show" sub="The same switch is at the bottom of the side menu. It applies to the screens menu too.">
        <BoRow
          label="Screens and pages"
          hint={view === 'p1' ? 'Phase 2 and 3 screens and pages are hidden. Search still finds pages.' : 'Everything, with Phase 2 below in purple and Phase 3 below that in brown.'}
        >
          <Tabs
            variant="segmented"
            size="sm"
            aria-label="Screens and pages in the menus"
            value={view}
            onChange={(v) => setPhaseView(v)}
            options={[
              { id: 'all', label: 'All pages' },
              { id: 'p1', label: 'Phase 1 only' },
            ]}
          />
        </BoRow>
      </BoSection>

      <BoSection title="Screens" sub="The devices in the top-right screen menu: tablets, kitchen screens, the kiosk and the rest.">
        {MODES.map((m) => (
          <BoRow key={m.id} label={m.label} hint={m.blurb}>
            {phasePick(m.label, modePhase(m.id, plan), (p) => setPhase(modePhaseKey(m.id), p))}
          </BoRow>
        ))}
      </BoSection>

      {BO_SECTIONS.map((sec) => (
        <BoSection key={sec.id} title={`Back Office · ${sec.label}`}>
          {sec.pages.map((p) => (
            <BoRow key={p.id} label={p.label} hint={p.blurb}>
              {phasePick(p.label, phaseOf(p.id, plan), (ph) => setPhase(p.id, ph))}
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
