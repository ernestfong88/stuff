/**
 * Resident Kiosk: a self-serve tablet in the lobby. One question a screen,
 * very large type, no keyboard. The order goes through the same store
 * actions as a staff pick up or delivery, so it lands on PU & Delivery, the
 * kitchen screens and Expo unchanged, and the times offered pass the same
 * capacity check as staff booking.
 *
 * Built for a portrait screen (1080 x 1920). A tablet mounted in landscape
 * either uses the landscape layout or turns the portrait kiosk a quarter
 * turn (Back Office > Featured on Kiosk, or #/kiosk?rotate=90 / -90 / 0 on
 * one device).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft } from 'lucide-react';
import { COMMUNITY_NAME } from '../../data';
import { dinerBilling } from '../../domain/billing';
import { isoDate } from '../../domain/pickup';
import { hospiceOnOrder, sickWaiversUsed } from '../../domain/waivers';
import type { MealName } from '../../domain/types';
import { now } from '../../lib/clock';
import { uid } from '../../lib/id';
import { useRoute } from '../../shell/router';
import { useConfig } from '../../store/config';
import { useDining } from '../../store/dining';
import { is86, use86 } from '../../store/eightySix';
import { useNow } from '../../ui';
import { StaffCorner } from '../../shell/StaffCorner';
import { sendText } from '../../store/textOutbox';
import { mobileNumber } from '../../domain/pickupService/phones';
import { kioskRotation, mobileOverrides, textSettings, useServiceSettings, windowSettings } from '../../domain/pickupService/settings';
import { textOn } from '../../domain/pickupService/texts';
import { windowRoom } from '../../domain/pickupService/windows';
import { countedSteps } from './model/flow';
import { kioskMenu, drinkName } from '../../domain/kioskMenu';
import { buildKioskOrder, kioskTextBody } from './model/order';
import { saveKioskPref } from './model/prefs';
import { KIOSK_ROOM, kioskMeals, timeChoices } from './model/times';
import { ChangesStep } from './steps/ChangesStep';
import { DessertStep } from './steps/DessertStep';
import { DoneStep } from './steps/DoneStep';
import { DrinkStep } from './steps/DrinkStep';
import { EntreeStep } from './steps/EntreeStep';
import { MealStep } from './steps/MealStep';
import { ReviewStep } from './steps/ReviewStep';
import { SideStep } from './steps/SideStep';
import { canFind, findMe, SignInStep } from './steps/SignInStep';
import { SoupStep } from './steps/SoupStep';
import { TimeStep } from './steps/TimeStep';
import { TypeStep } from './steps/TypeStep';
import { UtensilsStep } from './steps/UtensilsStep';
import { VersionStep } from './steps/VersionStep';
import { WelcomeStep } from './steps/WelcomeStep';
import { WhoStep } from './steps/WhoStep';
import { IdleOverlay } from './ui/IdleOverlay';
import { KButton } from './ui/KButton';
import { KioskHeader } from './ui/KioskHeader';
import { ScrollBody } from './ui/ScrollBody';
import { KioskUnit, useMeasuredUnit } from './ui/unit';
import { useKioskFlow } from './useKioskFlow';
import s from './Kiosk.module.css';

/** Quiet this long on a question and the kiosk asks "Are you still there?" */
const IDLE_MS = 90_000;
/** No answer to that for this long and it starts over. */
const IDLE_GRACE_MS = 20_000;
/** The thank-you screen starts over after this long (longer while the text is shown). */
const DONE_MS = 20_000;
const DONE_TEXT_MS = 60_000;

function parseRotation(v: string | null): 0 | 90 | -90 | null {
  if (v == null) return null;
  const q = v.toLowerCase();
  if (/^(90|cw|right)$/.test(q)) return 90;
  if (/^(-90|270|ccw|left)$/.test(q)) return -90;
  if (/^(0|off|none)$/.test(q)) return 0;
  return null;
}

const minuteOfDay = (ts: number) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
};

export default function ResidentKiosk() {
  const { query } = useRoute();
  const svc = useServiceSettings();
  const cfg = useConfig();
  const dining = useDining();
  const marks = use86();
  const frame = useRef<HTMLDivElement>(null);
  const unit = useMeasuredUnit(frame);
  const at = useNow(1000);

  const menuFor = useCallback((meal: MealName) => kioskMenu(meal, (id) => is86(marks, id)), [marks]);
  const flow = useKioskFlow(menuFor);
  const { s: st, menu } = flow;

  // ─── Idle and start over ──────────────────────────────────────────────
  const lastTouch = useRef(now());
  const [idleSince, setIdleSince] = useState<number | null>(null);
  const reset = flow.reset;
  const startOver = useCallback(() => {
    lastTouch.current = now();
    setIdleSince(null);
    reset();
  }, [reset]);
  useEffect(() => {
    if (st.step === 'welcome') return;
    const quiet = Math.max(0, at - lastTouch.current);
    if (st.step === 'done') {
      if (quiet >= (st.showSms ? DONE_TEXT_MS : DONE_MS)) startOver();
      return;
    }
    if (idleSince == null && quiet >= IDLE_MS) setIdleSince(at);
    else if (idleSince != null && at - idleSince >= IDLE_GRACE_MS) startOver();
  }, [at, st.step, st.showSms, idleSince, startOver]);

  // ─── What this order can book ─────────────────────────────────────────
  const win = windowSettings(svc);
  const todayIso = isoDate(0);
  // Re-read each minute, so ranges drop off as they close.
  const minute = Math.floor(at / 60_000) * 60_000;
  const meals = useMemo(
    () => (st.type ? kioskMeals(win, st.type, minuteOfDay(minute), todayIso, isoDate(1)) : []),
    [win, st.type, todayIso, minute],
  );
  const bookings = { orders: dining.orders, history: dining.history, assocOrders: dining.assocOrders };
  const meal = meals.find((m) => m.meal === st.meal && m.date === st.date);
  const isToday = st.date === todayIso;

  const sickUsed = st.resident ? sickWaiversUsed(st.resident.id, [...dining.orders, ...dining.history], undefined, cfg) : 0;
  const preview = buildKioskOrder(st, { id: 'kiosk-preview', now: at, today: todayIso, sickUsed });
  const bill = preview.diners[0] ? dinerBilling(preview.diners[0], preview, cfg) : null;
  const copyTo = st.resident && textOn(textSettings(svc), 'kioskCopy') ? mobileNumber(mobileOverrides(svc), st.resident.id) : '';

  const place = () => {
    if (!st.type || st.win == null || !st.date || !st.resident) return;
    if (windowRoom(win, bookings, st.type, KIOSK_ROOM, st.win, st.date).full) {
      flow.go('time', { edit: true, win: null, filled: true });
      return;
    }
    const order = buildKioskOrder(st, { id: uid('kk'), now: now(), today: todayIso, sickUsed });
    dining.addOrder(order);
    dining.sendOrder(order.id);
    const drink = st.drink ? menu?.drinks.concat(menu.alcohol).find((d) => d.id === st.drink) : undefined;
    saveKioskPref(st.resident.id, { drink: drink ? drinkName(drink) : null, utensils: !!st.utensils });
    const orderBill = dinerBilling(order.diners[0], order, cfg);
    const sms = st.textCopy && copyTo ? { to: copyTo, body: kioskTextBody(st, order, st.resident, orderBill, textSettings(svc), todayIso) } : null;
    if (sms) sendText({ ...sms, kind: 'kioskCopy', ref: order.id, name: st.resident.name });
    lastTouch.current = now();
    flow.finish({ placedId: order.id, sms, showSms: false });
  };

  // ─── The screen ───────────────────────────────────────────────────────
  const counted = countedSteps(st, menu);
  const stepNo = counted.indexOf(st.step as (typeof counted)[number]) + 1;

  const body = (() => {
    switch (st.step) {
      case 'welcome':
        return <WelcomeStep flow={flow} />;
      case 'apt':
        return <SignInStep flow={flow} />;
      case 'who':
        return <WhoStep flow={flow} />;
      case 'type':
        return <TypeStep flow={flow} />;
      case 'meal':
        return <MealStep flow={flow} meals={meals} />;
      case 'time':
        return st.type && meal ? <TimeStep flow={flow} choices={timeChoices(win, bookings, st.type, meal)} /> : <MealStep flow={flow} meals={meals} />;
      case 'entree':
        return menu && <EntreeStep flow={flow} menu={menu} today={isToday} />;
      case 'ver':
        return <VersionStep flow={flow} />;
      case 'side':
        return menu && <SideStep flow={flow} menu={menu} />;
      case 'soup':
        return menu && <SoupStep flow={flow} menu={menu} />;
      case 'drink':
        return menu && <DrinkStep flow={flow} menu={menu} />;
      case 'dessert':
        return menu && <DessertStep flow={flow} menu={menu} today={isToday} />;
      case 'notes':
        return <ChangesStep flow={flow} />;
      case 'utensils':
        return <UtensilsStep flow={flow} />;
      case 'review':
        return bill && <ReviewStep flow={flow} menu={menu} order={preview} bill={bill} hospice={hospiceOnOrder(preview, cfg)} mobile={copyTo} today={todayIso} />;
      case 'done':
        return (
          <DoneStep
            flow={flow}
            today={isToday}
            onShowText={() => {
              lastTouch.current = now();
              flow.put({ showSms: true });
            }}
          />
        );
    }
  })();

  const screenKey = [st.step, st.special, st.others, st.pickSide, st.moreDessert, st.drinkList, st.changeUtensils, st.more].join('|');
  const doneFor = st.showSms ? DONE_TEXT_MS : DONE_MS;
  const doneLeft = Math.min(doneFor / 1000, Math.max(0, Math.ceil((doneFor - (at - lastTouch.current)) / 1000)));

  const footer = st.step !== 'welcome' && (
    <footer className={s.footer}>
      {st.step === 'done' ? (
        <span className={s.note}>
          This screen starts over in {doneLeft} {doneLeft === 1 ? 'second' : 'seconds'}.
        </span>
      ) : (
        <KButton className={s.back} icon={<ChevronLeft size="1.3em" strokeWidth={2.6} aria-hidden />} onClick={flow.back}>
          Back
        </KButton>
      )}
      <span className={s.grow} />
      {st.step === 'apt' && (
        <KButton look={canFind(flow) ? 'primary' : 'off'} className={s.next} onClick={() => findMe(flow)}>
          Find me
        </KButton>
      )}
      {st.step === 'review' && (
        <KButton look="primary" className={s.nextBig} onClick={place}>
          Place my order
        </KButton>
      )}
      {st.step === 'done' && (
        <KButton look="primary" className={s.nextBig} onClick={startOver}>
          Done
        </KButton>
      )}
    </footer>
  );

  const rotation = parseRotation(query.get('rotate')) ?? kioskRotation(svc);
  return (
    <div className={s.stage} aria-label={`${COMMUNITY_NAME} Dining kiosk`}>
      <div ref={frame} className={rotation ? s.rotated : s.frame} style={rotation ? ({ '--turn': `${rotation}deg` } as CSSProperties) : undefined}>
        <KioskUnit.Provider value={unit}>
          <div
            className={s.app}
            onPointerDownCapture={() => {
              lastTouch.current = now();
              if (idleSince != null) setIdleSince(null);
            }}
          >
            <KioskHeader step={stepNo} of={counted.length} />
            <ScrollBody screenKey={screenKey}>{body}</ScrollBody>
            {footer}
            {idleSince != null && (
              <IdleOverlay
                secondsLeft={Math.max(0, Math.ceil((IDLE_GRACE_MS - (at - idleSince)) / 1000))}
                onStay={() => {
                  lastTouch.current = now();
                  setIdleSince(null);
                }}
              />
            )}
          </div>
        </KioskUnit.Provider>
      </div>
      <StaffCorner />
    </div>
  );
}
