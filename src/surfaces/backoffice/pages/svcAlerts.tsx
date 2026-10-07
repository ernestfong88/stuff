import type { BoPageProps } from '../nav';
import { BoPage, BoRow, BoSection } from '../kit';
import { Row } from '../../../ui';
import { SettingNumber, Swatch } from '../kit/SettingControls';
import { ConfirmReset } from './ConfirmReset';

/** One alert threshold: red after this many minutes (blank is off where allowed). */
function Threshold({ k, label, hint, off }: { k: string; label: string; hint: string; off?: boolean }) {
  return (
    <BoRow label={label} hint={hint}>
      <Row gap={10}>
        <Swatch tone="red">Red after</Swatch>
        <SettingNumber path={`t.${k}`} label={`${label}, red after minutes`} off={off} />
      </Row>
    </BoRow>
  );
}

/** One check timeline gap: amber over, then red over (blank skips that colour). */
function Gap({ k, label, noRed }: { k: string; label: string; noRed?: boolean }) {
  return (
    <BoRow label={label}>
      <Row gap={10} wrap>
        <Swatch tone="amber">Amber over</Swatch>
        <SettingNumber path={`gap.${k}.0`} label={`${label}, amber over minutes`} step={0.5} off width={64} />
        {!noRed && (
          <>
            <Swatch tone="red">Red over</Swatch>
            <SettingNumber path={`gap.${k}.1`} label={`${label}, red over minutes`} step={0.5} off width={64} />
          </>
        )}
      </Row>
    </BoRow>
  );
}

/** Alerts & Timing: when tables, tickets and check timelines turn red. */
export default function Page(_props: BoPageProps) {
  return (
    <BoPage
      title="Alerts & Timing"
      sub="When tables, tickets and check timelines turn red. Changes show on the dining screens right away."
      actions={
        <ConfirmReset
          sections={['t', 'gap']}
          title="Put every alert back to the default?"
          message="Every red and amber time on this page goes back to the standard. The dining screens change straight away."
          done="Alerts are back to the defaults"
        />
      }
    >
      <BoSection title="Tables on the floor" sub="My Tables, the manager floor and Triage turn a table red once it has waited this long. Leave a box blank to never flag that wait.">
        <Threshold off k="passLate" label="Plates up, waiting to be run" hint="Food is ready at the pass and no one has run it yet." />
        <Threshold off k="floorCook" label="Still cooking" hint="The table's course has been on the fire this long." />
        <Threshold off k="closeLate" label="Ready to close, check still open" hint="Everyone is done eating. The manager floor also says Time to close." />
        <Threshold k="seatLate" label="Seated, nothing ordered yet" hint="Counts from when the table was opened, until the first send." off />
        <Threshold k="eatLate" label="Eating, not moved on" hint="Counts from when the last course was run, until the check-in or the next course." off />
      </BoSection>
      <BoSection title="Kitchen" sub="Tickets on the cook line and at expo turn solid red.">
        <Threshold k="cookLate" label="Ticket on the fire" hint="Cook line and expo, from when the course was fired." />
        <Threshold k="expoPass" label="Plates waiting at expo" hint="Up at the pass and not yet run." />
      </BoSection>
      <BoSection
        title="Check timelines"
        sub="On a check's timeline, the gap between two key times turns amber, then red. Leave a box blank to skip that colour."
      >
        <Gap k="send" label="Seated to order sent" />
        <Gap k="ready" label="Kitchen ticket, fired to up" />
        <Gap k="run" label="Up at the pass to run" />
        <Gap k="checkin" label="Course run to check-in" noRed />
      </BoSection>
    </BoPage>
  );
}
