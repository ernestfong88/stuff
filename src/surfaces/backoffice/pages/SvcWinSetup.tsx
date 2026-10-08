/**
 * Pick Up & Delivery, step by step: the same settings as the page, one
 * question at a time, for a manager setting it up for the first time. Every
 * change saves as it is made (same settings as the page), so Back, Close and
 * Finish never lose anything.
 */
import { useState, type ReactNode } from 'react';
import { rooms } from '../../../data';
import { pickupLeadMinutes } from '../../../domain/pickup';
import { useServiceSettings, windowSettings } from '../../../domain/pickupService/settings';
import { WINDOW_TYPES, type WindowSettings, type WindowType } from '../../../domain/pickupService/windows';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { setSetting } from '../../../store/serviceConfig';
import { Button, Modal, Toggle, cx, toast } from '../../../ui';
import { BoRow, BoSection, useCommunity } from '../kit';
import { FeePerVenue } from './fees';
import { SickWaiverSettings } from './fees/SickWaiverSettings';
import { FlowToggle } from './svcFlow';
import { SETUP_STEPS, everywhereSummary, setupIssues, venueOffers, venueSummary, type SetupInput, type SetupStep } from './svcWinSteps';
import s from './SvcWinSetup.module.css';

interface SectionProps {
  win: WindowSettings;
  venue: string;
  setVenue: (v: string) => void;
}

/** The Pick Up Windows sections the page passes in (title-less), so the setup reuses them as they are. */
export type SetupSections = Record<'types' | 'ranges' | 'capacity' | 'timing', (p: SectionProps) => ReactNode>;

const SHORT: Record<WindowType, string> = { pickup: 'Pick up', assoc: 'Associate', delivery: 'Delivery' };

/** Which venues offer each order type. Off clears that venue's ranges; on brings back the usual meal hours. */
function VenueOffers({ win }: { win: WindowSettings }) {
  const put = (venue: string, type: WindowType, on: boolean) => {
    const keys: Array<WindowType | 'noc'> = type === 'assoc' ? ['assoc', 'noc'] : [type];
    const before = keys.map((k) => win.grid?.[venue]?.[k]);
    keys.forEach((k) => setSetting(`win.grid.${venue}.${k}`, on ? undefined : []));
    const label = WINDOW_TYPES.find((t) => t.id === type)?.label ?? '';
    toast(on ? `${rooms[venue]?.name}: ${label.toLowerCase()} back on, usual meal hours` : `${rooms[venue]?.name}: no ${label.toLowerCase()}`, {
      action: { label: 'Undo', onClick: () => keys.forEach((k, i) => setSetting(`win.grid.${venue}.${k}`, before[i])) },
    });
  };
  return (
    <BoSection title="Offered at">
      {Object.entries(rooms).map(([id, room]) => {
        const o = venueOffers(win, id);
        return (
          <BoRow key={id} label={room.name}>
            <span className={s.offers}>
              {WINDOW_TYPES.map((t) => (
                <Toggle key={t.id} checked={o[t.id]} label={SHORT[t.id]} onChange={(v) => put(id, t.id, v)} />
              ))}
            </span>
          </BoRow>
        );
      })}
    </BoSection>
  );
}

function FeesStep() {
  return (
    <>
      <FeePerVenue plain />
      <SickWaiverSettings plain />
      <BoSection title="Hospice">
        <FlowToggle k="freeDeliveryComp" label="Waive hospice residents' delivery fees" hint="No manager PIN needed." />
      </BoSection>
    </>
  );
}

function Review({ input, go }: { input: SetupInput; go: (step: SetupStep) => void }) {
  const card = (key: string, name: string, lines: Array<{ step: SetupStep; text: string }>) => (
    <section key={key} className={s.card}>
      <h3 className={s.cardTitle}>{name}</h3>
      <ul className={s.lines}>
        {lines.map((l, i) => (
          <li key={i} className={s.line}>
            <span>{l.text}</span>
            <button className={s.edit} onClick={() => go(l.step)} aria-label={`Edit ${SETUP_STEPS.find((x) => x.id === l.step)?.title}`}>
              Edit
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <div className={s.review}>
      {Object.keys(rooms).map((v) => {
        const sum = venueSummary(input, v);
        return card(v, sum.name, sum.lines);
      })}
      {card('all', 'Every venue', everywhereSummary(input))}
    </div>
  );
}

/** The step-by-step setup, in a large dialog over the page. */
export function SvcWinSetup({ open, onClose, sections }: { open: boolean; onClose: () => void; sections: SetupSections }) {
  const win = windowSettings(useServiceSettings());
  const cfg = useConfig();
  const community = useCommunity();
  const { orders, history } = useDining();
  const [at, setAt] = useState(0);
  const [venue, setVenue] = useState(Object.keys(rooms)[0]);
  const input: SetupInput = { win, cfg, community, lead: pickupLeadMinutes([...orders, ...history], cfg) };
  const issues = setupIssues(input);
  const step = SETUP_STEPS[at];
  const last = at === SETUP_STEPS.length - 1;
  const close = () => {
    onClose();
    setAt(0);
  };
  const finish = () => {
    toast(
      issues.length
        ? `Pick up and delivery saved. ${issues.length} thing${issues.length === 1 ? ' still needs' : 's still need'} a look.`
        : 'Pick up and delivery is set up',
    );
    close();
  };
  const go = (id: SetupStep) => setAt(SETUP_STEPS.findIndex((x) => x.id === id));
  const p = { win, venue, setVenue };
  const own = issues.filter((x) => x.step === step.id);
  return (
    <Modal
      open={open}
      onClose={close}
      tall
      width={980}
      title="Set up Pick Up & Delivery"
      subtitle={`Step ${at + 1} of ${SETUP_STEPS.length} · ${step.title}`}
      footer={
        <>
          <Button onClick={() => setAt(at - 1)} disabled={at === 0}>
            Back
          </Button>
          {last ? (
            <Button variant="primary" onClick={finish}>
              Finish
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setAt(at + 1)}>
              Next: {SETUP_STEPS[at + 1].title}
            </Button>
          )}
        </>
      }
    >
      <ol className={s.progress} aria-label="Steps">
        {SETUP_STEPS.map((x, i) => {
          const warn = issues.filter((y) => y.step === x.id);
          return (
            <li key={x.id}>
              <button
                className={cx(s.pill, i === at && s.pillOn, i < at && s.pillDone)}
                aria-current={i === at ? 'step' : undefined}
                title={warn.map((y) => y.text).join('\n') || undefined}
                onClick={() => setAt(i)}
              >
                <span className={s.num}>{i + 1}</span>
                {x.title}
                {warn.length > 0 && <span className={s.dot} aria-label="Needs a look" />}
              </button>
            </li>
          );
        })}
      </ol>
      <p className={s.what}>{step.line}</p>
      {own.length > 0 && (
        <ul className={s.issues}>
          {own.map((x) => (
            <li key={x.text}>{x.text}</li>
          ))}
        </ul>
      )}
      {step.id === 'review' && issues.length > 0 && (
        <ul className={s.issues}>
          {issues.map((x) => (
            <li key={x.text}>
              {x.text}{' '}
              <button className={s.edit} onClick={() => go(x.step)}>
                Fix
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={s.body}>
        {step.id === 'types' && (
          <>
            <VenueOffers win={win} />
            {sections.types(p)}
          </>
        )}
        {step.id === 'ranges' && sections.ranges(p)}
        {step.id === 'capacity' && sections.capacity(p)}
        {step.id === 'timing' && sections.timing(p)}
        {step.id === 'fees' && <FeesStep />}
        {step.id === 'review' && <Review input={input} go={go} />}
      </div>
    </Modal>
  );
}
