import { Check, ChevronDown, LogOut, Maximize, Minimize, RotateCcw } from 'lucide-react';
import { Fragment } from 'react';
import { rooms } from '../data';
import { Avatar, MenuDivider, MenuItem, Popover, toast, Toggle, useConfirm, useViewportWidth } from '../ui';
import { cx } from '../ui/cx';
import { useDemoActions } from './demoTools';
import { enterFullscreen, exitFullscreen, useFullscreen } from './fullscreen';
import { phaseIsOn, setPhaseOn, usePhaseOn, usePhasePlan, type Phase } from '../store/phases';
import { getMode, modeOn, modePhase, orderedModes } from './modes';
import { navigate, useRoute } from './router';
import { signOut, useMe, useVenue, useVenueChoices, venueCode, venueColor } from './session';
import s from './controls.module.css';
import { setZoom, useZoom } from './zoom';

/** A− 100% A+ text size control. compact: just A− and A+, for a header short of room. */
export function TextZoom({ dark, tall, compact }: { dark?: boolean; tall?: boolean; compact?: boolean }) {
  const z = useZoom();
  return (
    <span className={cx(s.zoom, dark && s.dark, tall && s.tall)} role="group" aria-label="Text size">
      <button onClick={() => setZoom(z - 0.05)} title="Smaller text" aria-label="Smaller text" className={s.zSmall}>
        A−
      </button>
      {!compact && (
        <button onClick={() => setZoom(1)} title="Reset text size" className={s.zPct}>
          {Math.round(z * 100)}%
        </button>
      )}
      <button onClick={() => setZoom(z + 0.05)} title="Larger text" aria-label="Larger text" className={s.zBig}>
        A+
      </button>
    </span>
  );
}

/** Which surface this device shows. */
export function ModeChip({ dark, tall }: { dark?: boolean; tall?: boolean }) {
  const { mode } = useRoute();
  const m = getMode(mode);
  const plan = usePhasePlan();
  const on = usePhaseOn();
  // Later phases sit below a divider, in their own colour; a phase switched off hides its screens (except this one).
  const modes = orderedModes(plan).filter((x) => x.id === mode || modeOn(x.id, plan, on));
  // A heading wherever the phase steps up (Phase 2, Phase 3).
  const startsPhase = (i: number) => i > 0 && modePhase(modes[i].id, plan) !== modePhase(modes[i - 1].id, plan);
  const demo = useDemoActions();
  const [ask, dialog] = useConfirm();
  return (
    <>
      <Popover
        minWidth={250}
        trigger={({ open, toggle }) => (
          <button
            className={cx(s.modeChip, dark && s.dark, tall && s.tall, open && s.open)}
            onClick={toggle}
            title={`Mode: ${m.label}. Tap to switch.`}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            {m.label}
            <ChevronDown size={tall ? 14 : 12} strokeWidth={2.5} className={s.chev} />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <div className={s.demo}>
              <div className={s.demoHead}>Demo</div>
              {/* Release phases, for the whole system: the same switches as in Back Office. */}
              <div className={s.phaseRow} role="group" aria-label="Release phases switched on">
                {([2, 3] as Phase[]).map((ph) => (
                  <span key={ph} className={cx(s.phaseSwitch, ph === 3 && s.phase3)}>
                    <span className={cx(s.phaseLabel, ph === 2 ? s.phase2 : s.phase3)}>Phase {ph}</span>
                    <Toggle
                      checked={phaseIsOn(ph, on)}
                      onChange={(v) => {
                        setPhaseOn(ph, v);
                        toast(v ? `Phase ${ph} is on everywhere` : `Phase ${ph} is off everywhere`, { tone: 'success' });
                      }}
                      label={<span className="sr-only">Phase {ph}</span>}
                    />
                  </span>
                ))}
              </div>
              {demo.map((a) => (
                <button
                  key={a.id}
                  role="menuitem"
                  className={s.demoBtn}
                  onClick={async () => {
                    close();
                    if (await ask({ title: a.label, message: a.confirm, confirmLabel: a.label, tone: 'danger' })) a.run();
                  }}
                >
                  <RotateCcw size={15} strokeWidth={2.5} />
                  {a.label}
                </button>
              ))}
            </div>
            {modes.map((x, i) => (
              <Fragment key={x.id}>
                {startsPhase(i) && (
                  <>
                    <MenuDivider />
                    <div className={cx(s.phaseHead, modePhase(x.id, plan) === 3 && s.phase3)}>Phase {modePhase(x.id, plan)}</div>
                  </>
                )}
                <MenuItem
                  active={x.id === mode}
                  icon={<span className={s.modeNum}>{i + 1}</span>}
                  end={x.id === mode ? <Check size={15} strokeWidth={2.5} /> : undefined}
                  onClick={() => {
                    close();
                    navigate(x.id);
                  }}
                >
                  <span className={cx(modePhase(x.id, plan) === 2 && s.phase2, modePhase(x.id, plan) === 3 && s.phase3)}>{x.label}</span>
                </MenuItem>
              </Fragment>
            ))}
          </>
        )}
      </Popover>
      {dialog}
    </>
  );
}

/** Coloured venue code (SE, OB ...); tap to switch the dining room this device serves. short: keep the first word even on a wide screen. */
export function VenueChip({ short }: { short?: boolean } = {}) {
  const [venue, setVenue] = useVenue();
  const choices = useVenueChoices();
  const wide = useViewportWidth() >= 1440 && !short;
  const name = rooms[venue]?.name ?? venueCode(venue);
  // The venue's name, not a two-letter code; narrow headers keep its first word ("Bistro" for "The Bistro").
  const label = wide ? name : name.replace(/^the\s+/i, '').split(/[\s/]/)[0];
  return (
    <Popover
      align="left"
      minWidth={240}
      trigger={({ toggle, open }) => (
        <button
          className={s.venue}
          style={{ background: venueColor(venue) }}
          onClick={toggle}
          title={`${rooms[venue]?.name}. Tap to change venue.`}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className={s.venueName}>{label}</span>
          <ChevronDown size={13} strokeWidth={2.5} className={s.venueChev} aria-hidden />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className={s.menuHead}>Venue</div>
          {choices.map((key) => (
            <MenuItem
              key={key}
              active={key === venue}
              icon={
                <span className={s.venueDot} style={{ background: venueColor(key) }}>
                  {venueCode(key)}
                </span>
              }
              onClick={() => {
                setVenue(key);
                close();
              }}
            >
              {rooms[key].name}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

/** Signed-in associate, full screen, demo tools and log out. */
export function AccountMenu({ size = 40, dark }: { size?: number; dark?: boolean }) {
  const me = useMe();
  const fs = useFullscreen();
  return (
    <>
      <Popover
        minWidth={240}
        trigger={({ toggle, open }) => (
          <button className={cx(s.account, dark && s.dark)} onClick={toggle} title="Account" aria-haspopup="menu" aria-expanded={open}>
            <Avatar person={{ name: me.name, photo: me.initials }} size={size} />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <div className={s.who}>
              <Avatar person={{ name: me.name, photo: me.initials }} size={36} />
              <div>
                <div className={s.whoName}>{me.name}</div>
                <div className={s.whoRole}>{me.role}</div>
              </div>
            </div>
            <MenuDivider />
            <MenuItem
              icon={fs ? <Minimize size={16} /> : <Maximize size={16} />}
              onClick={() => {
                close();
                if (fs) void exitFullscreen();
                else void enterFullscreen();
              }}
            >
              {fs ? 'Exit full screen' : 'Full screen'}
            </MenuItem>
            <MenuDivider />
            <MenuItem
              danger
              icon={<LogOut size={16} />}
              onClick={() => {
                close();
                signOut();
              }}
            >
              Log out
            </MenuItem>
          </>
        )}
      </Popover>
    </>
  );
}

/**
 * Text size + mode switch pinned top right, for surfaces without their own
 * header (kiosk, display, kitchen screens draw these inline instead).
 */
export function CornerControls({ dark }: { dark?: boolean }) {
  return (
    <span className={s.corner}>
      <TextZoom dark={dark} />
      <ModeChip dark={dark} />
    </span>
  );
}
