/**
 * Release Phases (HO Settings): mark each screen in the mode menu and each
 * back office page Phase 1, 2 or 3. Later phases take their own colour (purple
 * for 2, brown for 3) and move below the earlier ones (a section with no
 * earlier page moves down the side menu too). Phase 2 and 3 can be switched
 * off for the whole system.
 */
import { Copy } from 'lucide-react';
import { Button, Tabs, toast } from '../../../ui';
import { BoCallout, BoPage, BoRow, BoSection, BoStatRow, BoStatTile } from '../kit';
import { MODES, modePhase, modePhaseKey } from '../../../shell/modes';
import { BO_SECTIONS } from '../nav';
import {
  PHASES,
  pagesInPhase,
  phaseIsOn,
  phaseListText,
  phaseOf,
  resetPhases,
  setPhase,
  setPhaseOn,
  usePhaseOn,
  usePhasePlan,
  type Phase,
} from '../phases';
import { Toggle } from '../../../ui';
import { ConfirmReset } from './ConfirmReset';
import s from './phases/phases.module.css';

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function Page() {
  const plan = usePhasePlan();
  const on = usePhaseOn();

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
      columns
      title="Release Phases"
      actions={
        <>
          <Button icon={<Copy size={15} />} onClick={copy}>
            Copy as a list
          </Button>
          <ConfirmReset
            label="Reset"
            disabled={isDefault}
            title="Put every screen and page back in its standard phase?"
            message="Every screen and Back Office page goes back to the phase it ships in. Whether Phase 2 and 3 are switched on stays as it is."
            done="Every screen and page is back in its standard phase"
            onReset={resetPhases}
          />
        </>
      }
    >
      <BoStatRow>
        {PHASES.map((ph) => (
          <BoStatTile
            key={ph}
            label={`Phase ${ph}: screens · pages`}
            value={`${screensIn(ph)} · ${pagesIn(ph)}`}
            tone={ph === 1 ? 'ocean' : undefined}
          />
        ))}
      </BoStatRow>

      <BoSection
        title="Phases switched on"
        sub="For the whole system. A phase that is off hides its screens from the screen menu, its pages from this menu and search, and turns off what it brings. Switching it back on brings everything back as it was."
      >
        {([2, 3] as Phase[]).map((ph) => (
          <BoRow
            key={ph}
            label={`Phase ${ph}`}
            hint={
              phaseIsOn(ph, on)
                ? `On: ${count(screensIn(ph), 'screen')} and ${count(pagesIn(ph), 'page')} in use.`
                : `Off: ${count(screensIn(ph), 'screen')} and ${count(pagesIn(ph), 'page')} hidden.${ph === 2 ? ' Kitchens run on printers while the kitchen screens are off.' : ''}`
            }
          >
            <Toggle
              checked={phaseIsOn(ph, on)}
              onChange={(v) => {
                setPhaseOn(ph, v);
                toast(v ? `Phase ${ph} is on everywhere` : `Phase ${ph} is off everywhere`, { tone: 'success' });
              }}
              label={<span className="sr-only">Phase {ph}</span>}
            />
          </BoRow>
        ))}
        <p className={s.note}>Turning Phase 2 off also turns Phase 3 off; turning Phase 3 on also turns Phase 2 on.</p>
      </BoSection>

      <BoSection title="Screens" sub="The devices in the top-right screen menu: tablets, kitchen screens, the kiosk and the rest.">
        {MODES.map((m) => (
          <BoRow key={m.id} label={m.label} hint={m.id === 'backoffice' ? `${m.blurb}. Always Phase 1: phases are switched here.` : m.blurb}>
            {m.id === 'backoffice' ? (
              <span className={s.locked}>Phase 1</span>
            ) : (
              phasePick(m.label, modePhase(m.id, plan), (p) => setPhase(modePhaseKey(m.id), p))
            )}
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
        The phases are saved in this browser. To share the split, use Copy as a list and send it on, or have it built into the app so every device
        starts with it.
      </BoCallout>
    </BoPage>
  );
}
