# Audit E: do SERVICE settings actually take effect?

Scope: Back Office POS Settings (Pacing & Coursing, Pick Up & Delivery, Messages), HO Settings (Alerts & Timing, Release Phases), KDS Settings, Kiosk Settings, and Venue Settings kitchen routing. For each one: where it is stored, which code reads it, and a runtime check (Playwright, one shared browser context, dev server at :5199, `?clock=17:45`). Scripts are in this folder as `audit-e-t*.mjs`.

Storage:
- Dining config: `kisco.dining.config.v1` (`src/store/config.ts`, type in `src/domain/config.ts`). Holds flow flags, course, route, kitchenMode, sick, hospice, pickupPackMinutes.
- Service settings: `kisco_service_cfg_v1` (`src/store/serviceConfig.ts`, seed in `src/data/seed/serviceConfig.json`). Holds t.*, gap.*, ciMin, greet, win.*, texts, mobile, pud.track, kioskFeat.
- Venue settings: `kisco_venue_settings_v1` (`src/store/venueSettings.ts`). Holds printers, kds, expo.
- Phases: `kisco_backoffice_phases` and `kisco_phases_on` (`src/store/phases.ts`).

All of these stores sync across tabs. Changes reached open floor tabs live, with no reload, in every test.

Totals: **1 blocker, 6 major, 14 minor**. 27 settings or setting groups were verified working.

---

## BLOCKER

### B1. Release Phases: Phase 2 off (the Bar screen is hidden), but Bistro alcohol is still sent "to the bar" and gets stuck
- **Where edited:** HO Settings → Release Phases (Phase 2 switch), or the Bar screen moved to a phase that is off.
- **Expected:** With the Bar screen off, alcohol goes to the server (pour), the way it does in venues without a bar. Otherwise nobody can make the drink.
- **Actual:** `drinkRoute` / `defaultDrinkRoute` route alcohol to `bar` for every venue in the hardcoded `COCKTAIL_ROOMS = ['bistro']`. They never check whether the Bar screen's phase is on. The send bar reads "Send drinks · 1 to the bar". The line is saved as `kitchenState: "bar"`. The My Tables card shows a non-clickable "At the bar 1" chip. `#/bar` shows "Bar is part of Phase 2 … switched off". In printer mode this Bistro wine also prints nowhere: Bistro is linked only to Hot Line, which prints Entrées and Sides. So in the Phase-1 configuration, a Bistro alcohol order reaches no person and no printer.
- **Repro:** `audit-e-t18.mjs`. Set `kisco_phases_on = {2:false,3:false}`, sign the server in to the Bistro, open a new check at B 6, choose Drinks → Alcoholic → Cabernet, and Send. Result: `{"item":"cv_cab","ks":"bar"}` and the card shows "At the bar 1".
- **Code:** `src/domain/routing.ts:36,66-79`; `src/domain/diningActions.ts:346` (`drinkStartState`); `src/surfaces/server/board/TableCard.tsx:224-226`; the phase gate is only in `src/App.tsx:25`.
- **Severity:** blocker for a Phase-1 (printers, no Bar screen) rollout at a venue with a bar.

---

## MAJOR

### M1. Alerts & Timing → "Check timeline" amber/red gaps are saved but never read
- **Where edited:** HO Settings → Alerts & Timing. There are 7 inputs: Waiting to order, Cooking and Plates up each have amber and red, and Eating has amber only. They are stored at `gap.send|ready|run|checkin`.
- **Expected:** The check timeline colours its gaps amber and red after these minutes.
- **Actual:** No code in `src` reads `gap.*`. No surface renders a coloured check timeline. Back Office Order History shows only "Latest activity", with no colouring. Changing these values does nothing.
- **Code:** written at `src/surfaces/backoffice/pages/svcAlerts.tsx:57-72,138-152`. A grep for `gap` finds no reader outside that page.

### M2. Expo "Text {name}?" button sends no text, and Messages wording never reaches it
- **Where edited:** POS Settings → Messages ("Pick up is ready" and "Delivery is on its way" wording).
- **Expected:** The text goes through the outbox with the community's wording, as it does on PU & Delivery.
- **Actual:** Expo calls `dining.notifyOrder` only. That stamps `notified`, and the ticket then says "Texted 5:45 PM". Nothing is added to `kisco_texts_outbox_v1`, and the custom wording is not used. PU & Delivery does send, with the custom wording: tapping "On my way" produced `"AUDIT-DELIVERY Lillian apt 128"`. Expo also offers "Text Lillian?" on a delivery that has not left yet, while the Messages page says the delivery text goes "when the runner leaves".
- **Repro:** `audit-e-t11.mjs`, `audit-e-t12.mjs`. Set custom wording, then on `#/expo` tap "Text Lillian?". The outbox stays `null`.
- **Code:** `src/surfaces/expo/index.tsx:109`; `src/surfaces/expo/ExpoTicketCard.tsx:366-392`; compare `src/surfaces/pud/queue/usePudActions.ts:28-36`. Expo also uses its own mobile/texts logic in `src/surfaces/kitchen/orderTexts.ts`, which duplicates `src/domain/pickupService/texts.ts`.

### M3. "Waive hospice residents' delivery fees" OFF has no effect while "Comp hospice residents' meals" is ON
- **Where edited:** Pacing & Coursing → Pick up and comps.
- **Expected:** With the fee waiver off, a hospice resident's delivery is charged the delivery fee ($3), even though the meal is comped.
- **Actual:** The close screen lists "Delivery $3.00", but the diner total is "No charge $0.00" and the table total is $0.00. `closeCharge` comps the whole diner, fees included, whenever `isHospiceDiner` is true. The screen also offers "Sick, waive delivery fee $3.00" on a fee that is already $0. The fee toggle only matters when the meal comp is off.
- **Repro:** `audit-e-t9.mjs`. Start a Delivery for Frank Dellacroce (on hospice), add Peach Chicken, open Close, then switch the fee waiver off.
- **Code:** `src/surfaces/server/order/close/closeMath.ts:116-119`; `src/domain/billing.ts:98-115`; `src/domain/waivers.ts:61-63,71-74`.

### M4. Pick Up & Delivery → Order types "Use ranges" OFF removes the order type from the kiosk entirely
- **Where edited:** Pick Up & Delivery → Order types. The hint says "Turn ranges off and staff take the order as soon as it is ready instead."
- **Expected:** With ranges off, the order type stays available and becomes ASAP. The server tablet does this: "As soon as it is ready. This community does not book ranges for delivery."
- **Actual:** The kiosk's `kioskTypes()` filters by `windowTypeOn`. Residents at the kiosk lose Delivery (or Pick up) altogether, including the "Delivery, I'm sick" tile.
- **Code:** `src/surfaces/kiosk/model/times.ts:27-29`; `src/surfaces/kiosk/steps/TypeStep.tsx:56-63`. The server version is `src/surfaces/server/order/queue/PickupTime.tsx:18-40`.

### M5. Printer mode: kiosk orders never print
- **Where edited:** Pacing & Coursing (or KDS Settings) → How orders reach the kitchen = Printers.
- **Expected:** "Orders sent from any device print by station" (Cook/Expo unavailable screen text).
- **Actual:** Printing happens only inside the server tablet's `OrderScreen.send()`. The kiosk calls `dining.sendOrder` directly and never calls `printJobs`. With Cook and Expo off in printer mode, nothing tells the kitchen about a kiosk order.
- **Code:** `src/surfaces/kiosk/index.tsx:143-144`; `src/surfaces/server/order/OrderScreen.tsx:143-155` is the only call site of `printJobs`.
- **Repro (code-level, shown by grep):** `grep -rn "printJobs\|sendOrder(" src/surfaces`.

### M6. Kitchen routing: setting an entrée to "Server makes it" leaves its default sides on the cook line, and Expo shows the course Ready
- **Where edited:** Venue Settings → Kitchen (RoutingEditor), for example Peach Glazed Chicken Breast set to "Server makes it".
- **Expected:** Sides travel with the plate. Either they also skip the cook, or the course is not "Ready" until they are up.
- **Actual:** The entrée goes to `ready` at send, but Mashed Potatoes and Green Beans stay `cooking`. Cook HOT shows an orphan ticket "WALTER OKONKWO Mashed Potatoes Green Beans". Expo shows "EG 6 … Ready … Run course 2?" while the sides are still cooking, because Expo readiness ignores side lines.
- **Repro:** `audit-e-t15.mjs`.
- **Code:** `src/surfaces/cook/cookTickets.ts:57-75`; `src/surfaces/expo/expoTickets.ts:94-99`; `src/domain/routing.ts:81-85`.

---

## MINOR

1. **Time to greet → "Don't count under" does nothing.** `greetInfo` computes `mins` using `under`, but nothing reads `mins`. Shift metrics use fixed week arrays. Also, "Meals timed" does not gate the triage reason "Waiting N min for drinks" (`dm >= gc.over`), which fires for every meal. `src/domain/greet.ts:63-66`; `src/surfaces/manager/floor/triage.ts:64-71`. "Slow over" does work: setting it to 0.5 made "0 min and no drinks yet" appear on triage (`audit-e-t19.mjs`). The "0 min" wording is odd.
2. **Alerts "Waiting to order" (`seatLate`) and "Eating" (`eatLate`) do not affect manager Triage.** Triage hardcodes "Seated 8/12 min, nothing ordered" and the "check still open" 10-minute floor. The My Tables card colour and the manager Tables floor do follow the thresholds. `src/surfaces/manager/floor/triage.ts:85-87`.
3. **Alerts: the Cook & Expo boxes cannot be cleared to turn the alert off**, although the page says "Leave a box blank to turn that alert off". The box has no `off` or `clearRemoves`, so clearing it reverts to the old value (stored stays 1). `src/surfaces/backoffice/pages/svcAlerts.tsx:142,147`; `src/surfaces/backoffice/kit/SettingControls.tsx:51-57`.
4. **Expo "fire late" threshold (`t.fireLate`) has no Back Office control.** It is read by Expo (`src/surfaces/expo/index.tsx:68`, `expoTickets.ts:142-145`) but cannot be edited.
5. **Coursing "Fire all" also fires dessert, and only on the next pacing tick, not at send.** `courseDue` returns true for `off` before the "dessert always waits" rule, which contradicts the doc in `src/domain/config.ts:18-19`. Runtime: the entrée fired after about 5 s and the dessert after about 10 s. The send bar still says "Send to kitchen · C1 fires now" in every mode. `src/domain/courses.ts:51-56`; `src/surfaces/server/order/checkLines.ts:90-99`.
6. **Printer mode send label** still says "Send to kitchen · C2 fires now", although the whole ticket prints. `checkLines.ts:99`.
7. **Printer send confirmation** says "Printed at … Expo Receipt (whole ticket)" while also toasting "Expo Receipt can't be reached". The summary should not claim a print at an unreachable printer. `src/domain/printing.ts:151-157`; `OrderScreen.tsx:151-154`.
8. **Printer mode with a scheduled pick up or delivery** prints the ticket at booking time (send), while the order's lines wait as `scheduled` until the fire lead. The kitchen gets the paper about 45 minutes or more early, with no fire time on it. `OrderScreen.tsx:143-155`; `src/domain/diningActions.ts:328-356`.
9. **"Offer dessert after the check-in" is ignored when "Ask to check in" is off.** The toggle stays visible and editable. `src/domain/tableStage.ts:83-89`; `svcFlow.tsx:241-243`.
10. **KDS Settings → Expo screen = No** works for My Tables: the server gets "Run course 2" (`audit-e-t14.mjs`). But `#/expo` still lists that kitchen's tickets with "Run course" buttons. On the cook side, the no-expo path ("cook clears the ticket") is dead code, because `useDining().expoActive` is a hard-coded `useState(true)` that never reads `kitchenHasExpo`. `src/store/dining.tsx:206`; `src/surfaces/cook/cookTickets.ts:100`; `src/surfaces/cook/index.tsx:104`.
11. **Kitchen screens follow only the Cook screen's phase (`mode:cook`).** Moving Cook to Phase 1 while Expo stays in Phase 2 (off) gives KDS mode with no Expo screen. Servers at a two-screen kitchen are then told "Ready at pass" with nobody to run it. `src/store/phases.ts:321-324`; `src/shell/modes.ts:32-33`.
12. **Pick Up & Delivery → Timing "Orders close before the range starts"** says "disappears from every booking screen", but the Associate Phone uses `am.cut` (Associate Meals page), not `win.cut`. Expo, the BO capacity count and `windowUsage` hardcode `ASSOC_ROOM = 'sequoia'` instead of `am.venue`. `src/domain/assocMeals/settings.ts:35`; `src/surfaces/expo/index.tsx:46`; `src/domain/pickupService/windows.ts:214`.
13. **Messages → "Associate meal changed" wording is never used.** Only its on/off switch is read. No text is sent through the outbox, and the custom body is ignored. `src/surfaces/manager/associates/assocProgram.ts:193-195`; `AssociatesView.tsx:54-58`.
14. **Upkeep and dead settings:**
    - Pick up windows are implemented three times and can drift apart: `src/surfaces/server/order/queue/pickupWindows.ts`, `src/domain/pickupService/windows.ts` and `src/domain/assocMeals/windows.ts`. Each has its own default spans and caps.
    - The seed key `win.pack` is never read; packing time is `pickupPackMinutes` in the dining config.
    - The Delivery fee list (`deliveryOptions`, for example "$7.00 Delivery Fee") is not used on the floor; the floor charges `venueFees` ($3). The page discloses this in a callout.
    - The Pacing & Coursing "Reset to defaults" message says "every switch on all three tabs", but it does not reset `kitchenMode` (`svcFlow.tsx:223-228`).

---

## Verified working (runtime unless noted)

| Setting | Effect seen |
|---|---|
| Kitchen mode = Printers | Cook and Expo show "No … display, routes tickets to printers". Server send shows "Printed at Hot Line (3 items) · Expo Receipt (whole ticket)". My Tables shows no stages, only Quick close / Confirm payment. Coursing section hidden. (t1) |
| Printers → what each prints | Hot Line with Sides unticked gives "Hot Line (1 item)" on the next send. (t2) |
| Coursing per venue/meal | Fire on drop: C2 `scheduled` until C1 run, then `cooking`. Manual: C2 stays `scheduled` after C1 run. Fire all: C2 `cooking` within about 5 s. Saved `{sequoia:{Dinner:…}}`. Timer +5/+8 checked in code only (`courses.ts:58-61`). (t3, t3b) |
| Check-in after entrée | Off removes "Check in · C2" from My Tables and the manager triage reason. (t4) |
| Check-in nudge minutes (ciMin) | Setting 60 turns the button `sleepy` and drops the triage reason; blank restores it. (t4) |
| Dessert after check-in | After check-in the card shows "Dessert / No dessert". Off moves the table to Ready to close (Quick close). (t5) |
| Go to Entrées after a starter | On: the tab jumps to Entrees. Off: it stays on Starters. (t6) |
| Usual picks | The "Usual dinner · tap to add" row shows or hides. (t6) |
| Short names for servers / kitchen | Tiles show "Peach Chicken" or "Peach Glazed Chicken Breast". Cook and Expo show "Terrace Burger + Fries" or "Classic Terrace Burger + French Fries". (t6, t7) |
| Only list changed choices | Check line "Terrace Burger Fries" changes to "… Medium Well · American Fries". (t7) |
| Next diner after entrée/dessert | Code only (`afterPick.ts:50-55`). |
| Comp hospice meals | Frank's close shows "Comped · Hospice · automatic"; with it off, "Covered by meal plan". (t8) |
| Pick up tracking per venue | Code only (`expo/index.tsx:49,98-101`, `usePudActions.ts:52-60`). |
| Pick Up & Delivery cutoff / packing / capacity / ranges off (server) | Cut 15 adds the 6:00 and 6:15 ranges. Pack 20 changes the lead to 30 min. Cap 1 shows Full on most ranges. Ranges off gives "As soon as it is ready". (t10) |
| Sick waivers | On/off on the server delivery screen works. (t20) |
| Messages wording → PU & Delivery | The outbox body uses the custom wording. (t11) |
| Alerts: floor + Cook/Expo thresholds | Setting all to 1: My Tables late cards 0→5, Cook late tickets 1→8, Expo "Late" 4→15. Clearing the floor thresholds turns floor alerts off. (t13) |
| Time to greet "Slow over" | The manager triage reason appears. (t19) |
| KDS screens per kitchen + subcategories | SW Salad goes to Cook COLD and BBQ Wings to HOT. Switching to 1 screen gives "COOK · HOT" showing everything. (t14, t15) |
| KDS Expo screen = No | My Tables shows "Run course 2" to the server. (t14) |
| Kitchen routing → cook vs server | The routed entrée skips Cook and starts `ready` (with the sides problem in M6). (t15) |
| Kiosk featured drinks order | Moving Iced Tea up changes the kiosk list to "Iced Tea Coffee Decaf…". (t16) |
| Release phases | Phase 3 off: Kiosk, Display and Prep show PhaseOff, and the server's Side work chip is gone. Phase 2 off: Cook, Expo, Host, Bar and Assoc Phone show PhaseOff, server sends print, and Pacing & Coursing shows Printers with KDS locked. The saved kitchenMode is untouched. (t17) |
