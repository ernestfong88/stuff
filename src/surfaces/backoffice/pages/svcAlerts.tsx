import type { ReactNode } from 'react';
import type { BoPageProps } from '../nav';
import { BoPage, BoRow, BoSection } from '../kit';
import { Row } from '../../../ui';
import { SettingNumber, Swatch } from '../kit/SettingControls';
import { printerMode } from '../../../domain/config';
import { useConfig } from '../../../store/config';
import { ConfirmReset } from './ConfirmReset';
import s from './svcAlerts.module.css';

const FLOOR = 'My Tables & manager floor';
const KITCHEN = 'Cook & Expo screens';
const TIMELINE = 'Check timeline';

/** The moments of a meal, in service order. */
const MOMENTS = [
  { id: 'alerts-order', title: 'Waiting to order' },
  { id: 'alerts-cooking', title: 'Cooking' },
  { id: 'alerts-plates', title: 'Plates up' },
  { id: 'alerts-eating', title: 'Eating' },
  { id: 'alerts-close', title: 'Ready to close' },
] as const;

/** Quiet note beside a control the kitchen does not use right now. */
function PrinterNote({ show }: { show?: boolean }) {
  return show ? <span className={s.printerNote}>Not used with printers</span> : null;
}

/** A screen that turns red after a number of minutes (blank is off where allowed). */
function TurnsRed({
  path,
  screen,
  moment,
  off,
  hint,
  printers,
}: {
  path: string;
  screen: string;
  moment: string;
  off?: boolean;
  hint?: ReactNode;
  printers?: boolean;
}) {
  return (
    <BoRow label={screen} hint={hint}>
      <PrinterNote show={printers} />
      <Row gap={10}>
        <Swatch tone="red">Turns red after</Swatch>
        <SettingNumber path={path} label={`${moment}, ${screen}, red after minutes`} off={off} />
      </Row>
    </BoRow>
  );
}

/** The check timeline gap for this moment: amber, then red (blank skips that colour). */
function Timeline({ k, moment, noRed }: { k: string; moment: string; noRed?: boolean }) {
  return (
    <BoRow label={TIMELINE}>
      <Row gap={10} wrap>
        <Swatch tone="amber">{noRed ? 'Turns amber after' : 'Amber after'}</Swatch>
        <SettingNumber path={`gap.${k}.0`} label={`${moment}, check timeline, amber after minutes`} step={0.5} off width={64} />
        {!noRed && (
          <>
            <Swatch tone="red">red after</Swatch>
            <SettingNumber path={`gap.${k}.1`} label={`${moment}, check timeline, red after minutes`} step={0.5} off width={64} />
          </>
        )}
      </Row>
    </BoRow>
  );
}

/** One moment of the meal, with a row per screen that shows it. */
function Moment({ index, desc, children }: { index: number; desc: string; children: ReactNode }) {
  const m = MOMENTS[index];
  return (
    <div id={m.id} className={s.anchor}>
      <BoSection
        title={
          <span className={s.momentTitle}>
            <span className={s.num}>{index + 1}</span>
            {m.title}
          </span>
        }
        sub={desc}
      >
        {children}
      </BoSection>
    </div>
  );
}

/** Compact strip of the moments, each jumping to its card. */
function Steps() {
  return (
    <nav className={s.steps} aria-label="Moments of the meal">
      {MOMENTS.map((m, i) => (
        <span key={m.id} className={s.stepWrap}>
          {i > 0 && (
            <span className={s.arrow} aria-hidden>
              →
            </span>
          )}
          <button
            type="button"
            className={s.step}
            onClick={() => document.getElementById(m.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <span className={s.num}>{i + 1}</span>
            {m.title}
          </button>
        </span>
      ))}
    </nav>
  );
}

/** Alerts & Timing: how long each moment of a meal can take before the screens flag it. */
export default function Page(_props: BoPageProps) {
  const printers = printerMode(useConfig());
  return (
    <BoPage
      title="Alerts & Timing"
      sub="How long each moment of a meal can take before a screen flags it. Leave a box blank to turn that alert off."
      actions={
        <ConfirmReset
          sections={['t', 'gap']}
          title="Put every alert back to the default?"
          message="Every red and amber time on this page goes back to the standard. The dining screens change straight away."
          done="Alerts are back to the defaults"
        />
      }
    >
      <Steps />
      <Moment index={0} desc="From when the table is seated until the first order is sent.">
        <TurnsRed off path="t.seatLate" screen={FLOOR} moment="Waiting to order" />
        <Timeline k="send" moment="Waiting to order" />
      </Moment>
      <Moment index={1} desc="From when a course is fired until its plates are up at the pass.">
        <TurnsRed off path="t.floorCook" screen={FLOOR} moment="Cooking" printers={printers} />
        <TurnsRed path="t.cookLate" screen={KITCHEN} moment="Cooking" printers={printers} />
        <Timeline k="ready" moment="Cooking" />
      </Moment>
      <Moment index={2} desc="Plates are up at the pass and no one has run them yet.">
        <TurnsRed off path="t.passLate" screen={FLOOR} moment="Plates up" printers={printers} />
        <TurnsRed path="t.expoPass" screen={KITCHEN} moment="Plates up" printers={printers} />
        <Timeline k="run" moment="Plates up" />
      </Moment>
      <Moment index={3} desc="From when a course is run until the check-in or the next course.">
        <TurnsRed off path="t.eatLate" screen={FLOOR} moment="Eating" />
        <Timeline k="checkin" moment="Eating" noRed />
      </Moment>
      <Moment index={4} desc="Everyone is done eating and the check is still open.">
        <TurnsRed off path="t.closeLate" screen={FLOOR} moment="Ready to close" hint="The manager floor also says Time to close." />
      </Moment>
    </BoPage>
  );
}
