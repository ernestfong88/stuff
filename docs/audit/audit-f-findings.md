# Audit F: do MENU, VENUE, BILLING and PEOPLE settings take effect?

Scope: settings edited in the Back Office (#/backoffice/...), checked on the floor, kitchen, prep, kiosk, display and associate screens.
Method: I traced each setting in the code (grep), then changed it in the Back Office UI with Playwright. Tabs shared one browser context, and I checked the other surfaces after each change.
Two Menu Cycle checks called the Back Office's own `menuActions` functions in the page: remove/add placement, and swap meals after `updateMenu(m1,{locked:false})`. I did this because the live menu m1 is locked (signed by the RD), so these runs skip the lock. The functions are the same ones the builder calls.
Scripts are `audit-f-*.mjs` in this scratchpad, with the shared helpers in `audit-f-lib.mjs`. Screenshots are `audit-f-*.png`.
Dev server: http://localhost:5199, clock pinned with `?clock=17:45`. The date was Wed 2026-10-07, so the cycle day is 18. No repo files were changed.

Counts: **5 blockers · 14 major · 6 minor**. A "what works" list is at the end.

---

## BLOCKERS

### B1. Resident allergies don't trigger allergy warnings unless the text exactly matches a menu allergen tag
- **Setting:** Residents → allergies and diets (read-only in Back Office, from the care assessment), and Recipe Book allergens.
- **Expected:** The Recipe Book hint says *"Servers see these on the tablet and the kitchen ticket warns when a resident's allergy matches."* A shellfish or gluten allergy should flag Krab Cakes or bread dishes.
- **Actual:** The tile flag, the Modify-screen alert and the line conflict all compare strings exactly (`person.allergies.includes(a)`). Resident allergies are free text, so most of them never match. `audit-f-t5.mjs` results:
  - Rose Delgado: allergy `"MUSSELS, OR CLAMS"`. Zero allergy flags on every tab, including Krab Cakes, which is tagged Shellfish.
  - Mildred Vanholder: allergy `"Gluten allergy"`. Zero flags.
  - Walter Okonkwo: `"No fruits with seeds — strawberries…"`. Never matchable.
  - Beatrice Sanderson: allergy `"Gluten"`. 17 flags. This is the only resident in the seed whose allergy is flagged.
  - Diets such as Gluten-free, Gluten-Friendly and Mechanical Altered never drive any warning.
- **Code:** `src/surfaces/server/order/menu/MenuPanel.tsx:137,162`; `src/surfaces/server/order/menu/ModifierEditor.tsx:87`; `src/domain/orders.ts:123-126`; seed `src/data/seed/residents.json` (r4, r5, r8).

### B2. "Week 1 started" (and builder date moves) don't change the dining room menu, but Production, Associate Meals and printed menus do follow it
- **Setting:** Venue Settings → Menus → *Week 1 started* (`venue.menuStartDt`). Also Menu Cycle builder `setDayDate` (`menu.startDt`).
- **Expected:** The cycle day, and with it today's specials, follows the venue's week 1. That is the hint ("Week N today"), and `refreshLiveMenu`'s comment says *"the cycle day, and so the specials, follow the venue's schedule"*.
- **Actual:** The tablet's cycle day is a module constant: `shiftDay(SEED_TODAY=15, weekday, 35)`. `computeLive` never reads `menuStartDt`. Repro (`audit-f-t1.mjs`, `audit-f-t24.mjs`): I set Sequoia week 1 to 2026-09-27.
  - Back Office now shows "week 2 of 5".
  - Server tablet: unchanged. Peach Chicken, Stuffed Shells, Cheeseburger Soup, Trifle.
  - Back Office Production (cycle day 11): make **Almond Crusted Trout, Chicken Pot Pie, Tomato Basil Bisque…**
  - Associate menu (Dinner): chef's special **Almond Crusted Trout**, soup of the day **Tomato Basil Bisque**.
  - Printed menus (`menuPrint` uses `cycleDayOn(v.menuStartDt)`) follow the new date too.
  - The kitchen produces, and associates are promised, food the dining room isn't serving.
- **Code:** `src/surfaces/server/order/menu/menuCatalog.ts:15,25`; `src/data/index.ts:88-104`; `src/surfaces/backoffice/menus/model/liveOverlay.ts:51-62` (no start date used); readers that *do* use the start date: `src/store/production.ts:639-647`, `src/store/assocMenu.ts:86-89,124-126`, `src/surfaces/backoffice/menus/model/menuPrint.ts:83-92`, `src/domain/menuCycle.ts:136-150`.

### B3. Renaming a venue empties Production and removes the associate chef's special and soup
- **Setting:** Venue Settings → Details → *Venue name* (hint: "What servers, residents and the menus call it.").
- **Expected:** A cosmetic rename.
- **Actual:** Production finds the venue's schedule by display name (`v.name === venue.fullName`, with the names hard-coded). Repro (`audit-f-t16.mjs`): I renamed "Sequoia Dining Room" to "Sequoia Room".
  - Production cycle day goes 18 → 0, and the special rows go from 7 to 0.
  - Associate Dinner menu goes from 5 items to just "Southwest Summer Salad, Turkey Club". The chef's special, soup of the day and soup combo disappear.
  - The rename never reaches the floor either (see M10).
  - The same name lookup means a venue added in Venue Settings can't appear in Production or Prep at all.
- **Code:** `src/store/production.ts:277-281` (hard-coded `PRODUCTION_VENUES` with `fullName`), `:640`; `src/surfaces/backoffice/pages/venues/VenueDetails.tsx` (name field).

### B4. Floor plan editor: added or renamed tables don't reach the server tablet, cook or expo, and a party seated at a new table is invisible to its server
- **Setting:** Venue Settings → Floor plan → rename table / Add table / Save layout.
- **Expected:** The table map changes everywhere. The task covers host, manager and server maps; the editor's status line only promises "host and manager floors".
- **Actual (`audit-f-t12.mjs`, `audit-f-t13.mjs`):** I renamed EG 7 to "EG 7X" and added "SQ 17".
  - Host and manager: show EG 7X and SQ 17.
  - Server new-check floor picker, server My tables, Cook and Expo: still say **EG 7**, and SQ 17 doesn't exist.
  - The host seated a party at SQ 17 for Adriana. The order was created (`tableId t_tgtvvekvu`, server AA). The manager's Tables view shows it, but **Adriana's My tables never shows it**, because `inVenue` only knows the seed tables. Kitchen tickets for it would read "Table".
- **Code:** `src/domain/venue.ts:16-24` (`inVenue`/`tableRoom` use seed `rooms`); `src/surfaces/server/newcheck/FloorPicker.tsx:12-14`; `src/domain/orders.ts:162-166` (`tableName` via seed `getTable`), used by cook, expo and server cards; only `src/store/floorLayout.ts` `useRoomPlan`/`useTableName` read the saved layout (host, manager, bar).

### B5. Order History corrections don't reach Charge Approval: a comped check still bills the resident
- **Setting:** Billing → Order History → *Comp the check* / *Paid with* / *Reopen check*.
- **Expected:** The apartment charge waiting in Charge Approval is voided or changed.
- **Actual (`audit-f-t20.mjs`):** Walter's check closed to his account for $20, and Charge Approval shows "Meal Dinner · EG 8 $20 Waiting for review". I then comped it in Order History. History saved `comp: Back office correction (E. Fong)`, but **Charge Approval still shows $20 waiting for review**.
  - `syncFloorCharges` only *adds* charges with ids it hasn't seen before. It never updates or voids them.
  - Changing the payment to card leaves the apartment charge in place.
  - A reopened and re-closed check keeps the same id (`floor:<order>:<diner>`), so its new amount is ignored.
- **Code:** `src/surfaces/backoffice/kit/billing.ts:44-84`; `src/surfaces/backoffice/pages/orders/OrderDetail.tsx:30-37,73-82,125-152`.

---

## MAJOR

### M1. Only Sequoia (v1) drives the floor menu and prices. Evergreen, Bistro and Catering menu and price settings do nothing
- **Where:** Venue Settings → Menus and Prices for any venue other than Sequoia.
- **Expected:** Each venue serves its chosen menu at its own prices. The Bistro serves "Bistro All-Day" (m2).
- **Actual:**
  - `DINING_VENUE_ID = 'v1'` is hard-coded. Every room, Bistro tables included, gets Sequoia's cycle and Sequoia's prices.
  - `barMenu.json` (the Bistro/bar menu) is loaded but never used.
  - Repro (`audit-f-t22.mjs`): Bistro à la carte price for Classic Terrace Burger set to $77 is saved, but no live patch is made and the tablet price stays $14.
  - Sequoia's Krab Cakes à la carte price set to $99 is charged at **Bistro table B 3** (Harold Yeung, $104 total).
  - Bistro's Prices tab shows no notice. The "tablets ring up Sequoia prices" callout only appears when a venue has the same cycle as Sequoia.
- **Code:** `src/surfaces/backoffice/menus/model/liveOverlay.ts:23,60-61,69-70`; `src/surfaces/backoffice/menus/pricing/PricingPage.tsx:106-110`; `src/data/index.ts:108` (unused `barMenu`); `src/surfaces/server/order/menu/menuCatalog.ts:22-23` (one `menu` for all rooms).

### M2. The à la carte menu choice is ignored, even for Sequoia
- **Where:** Venue Settings → Menus → *À la carte menu*.
- **Actual (`audit-f-t2.mjs`):** Sequoia set to "Bistro All-Day" and then to "No à la carte menu": the server Entrées tab is identical both times (all every-day items still offered). `computeLive` never reads `alcMenuId`; every-day items always come from the cycle menu's day 0.
  - The À la carte builder's toast says "· servers see it now" for any menu Sequoia lists as its à la carte (`live` checks `alcMenuId === own`), including m2. Servers don't see m2.
- **Code:** `liveOverlay.ts:60-61,83-100`; `src/surfaces/backoffice/menus/cycles/AlaCarteBuilder.tsx:58-59,92,102`.

### M3. "No cycle menu" still serves the old cycle, and a different cycle is served on the wrong day
- **Where:** Venue Settings → Menus → *Menu cycle*.
- **Actual (`audit-f-t26.mjs`):**
  - With **No cycle menu**, the floor still serves m1's specials. `computeLive` falls back with `venue?.menuId ?? 'm1'`.
  - Switching to **VT Winter 2027 (m5)**: Back Office says "week 1 of 5" (day 4 = Gazpacho, Chicken Marsala, Turkey Shepherd's Pie…). The server serves **m5 day 18** (Minestrone, Herb Roasted Pork Loin, Braised Short Ribs…), because the tablet's day is the fixed constant from B2.
- **Code:** `liveOverlay.ts:61`; `menuCatalog.ts:15`; `src/store/venueSettings.ts:198-209` (`setVenueCycle` sets this Sunday as the start).

### M4. Specials removed in Menu Cycle stay on the kiosk and the dining room TV, and the TV doesn't update live
- **Where:** Menu Cycle builder: remove a special, or swap or copy meals.
- **Actual (`audit-f-t10.mjs`, `audit-f-t23.mjs`):** I removed Peach Chicken from today's dinner and added Shrimp and Grits.
  - Server: correct. Peach Chicken is gone and Shrimp and Grits is shown.
  - Kiosk dinner specials: **Peach Glazed Chicken Breast (day -1)**, Stuffed Shells, Shrimp and Grits. Residents can still order the removed dish.
  - Display: no change until reload. After reload it shows Peach Chicken **and** Shrimp and Grits.
  - After a lunch/dinner swap, the display lists both the old dinner specials and the new ones.
  - The kiosk and display have no cycle-day filter. They use the `special` flag, while removed items only get `day:-1`.
  - The display memoises on `[meal, marks]`. `useMenuVersion()` exists but no surface calls it.
- **Code:** `src/domain/kioskMenu.ts:185-196`; `src/surfaces/display/specials.ts:29-41`; `src/surfaces/display/index.tsx:37`; `src/data/index.ts:299-302` (`useMenuVersion`, unused).

### M5. The Prep tablet's specials ignore the Menu Cycle
- **Where:** Menu Cycle edits → #/prep.
- **Actual (`audit-f-t16.mjs`, `audit-f-t23.mjs`):** After removing Peach Chicken, or swapping lunch and dinner, the Prep tablet and `specialsFor` still list Peach Glazed Chicken Breast, Stuffed Shells, Cheeseburger Soup and Trifle. They read a static prep seed (`seed.menus[venue.menu].specials[dayOffset]`).
  - Back Office Production does follow the grid, so Production and Prep disagree.
- **Code:** `src/store/production.ts:365-367` (vs `cycleRows` `:639-675`).

### M6. Modifier groups pinned in the Back Office don't reach the server's Modify screen, but the kiosk and billing do use them
- **Where:** Modifiers → group → *Pin a recipe* (and Recipe Book → Pinned modifier groups); ordering rule *Required*.
- **Actual (`audit-f-t9.mjs`):** I set Meat Temp to Required and pinned it to Peach Glazed Chicken Breast. The live overlay has `modifierRules.items.d_peach=["g_temp"]`.
  - On the server, tapping Peach Chicken adds it straight to the check. No Modify screen opens and nothing asks for a temperature.
  - The server reads the seed `pinSeq` for pinned and required groups and for whether to open the Modify screen.
  - The kiosk (`kioskMenu.ts:104`) and up-charge billing (`menu.ts:290`) read the Back Office pins, so the kiosk would ask and billing would charge for a group the server never sees.
- **Code:** `src/surfaces/server/order/menu/modifiers.ts:80-82,153-163,200-202`; `src/domain/kioskMenu.ts:104`; `src/domain/menu.ts:289-291`.

### M7. Up-charges on groups without ordering rules are never charged, and the server never sees any up-charge
- **Where:** Modifiers → group → choice *Up-charge*.
- **Actual (`audit-f-t7.mjs`, `audit-f-t8.mjs`):** The Burgers group shows "Bacon +$2, Avocado +$…" under **"On the server tablet"**. On the tablet:
  - The Modify screen lists "Avocado Bacon …" with no prices.
  - `upcharge({l_burger, Burgers:[Bacon]})` = **$0**.
  - Only groups that have a rule *and* are pinned price anything; options carry prices only in `liveModifiers` for ruled groups.
  - Even for ruled groups (pizza toppings), the server's Modify screen shows no option price or running total.
- **Code:** `liveOverlay.ts:170-180`; `src/domain/menu.ts:283-306`; `ModifierEditor.tsx:97-127`; `GroupDetail.tsx:181-191` (preview).

### M8. Associate special daily limit isn't enforced on the server tablet, and server-rung specials don't count toward it
- **Where:** Associate Meals → today's Dinner special and *Associates who can have…* (cap).
- **Actual (`audit-f-t18.mjs`):** Special = Stuffed Shells, cap = 1.
  - The server associate menu shows "Chef's special · Cheese Stuffed Shells".
  - I rang it for Diego Ramos and Priya Nair. The tile was never disabled.
  - Manager → Associates still says **"0 of 1 ordered"**.
  - The phone and the manager form enforce `itemsLeft`, which only counts `assocOrders`.
- **Code:** `src/surfaces/server/order/menu/MenuPanel.tsx:126-140` (no cap); `src/domain/assocMeals/menu.ts:194`; `src/surfaces/manager/associates/AssociatesView.tsx:108-122`.

### M9. Dining Plans & Notes: kitchen notes and plan changes never reach the floor
- **Where:** Residents → Dining Plans & Notes → resident.
- **Actual (`audit-f-t19.mjs`):**
  - Joan Petrovic, plan changed to "AL 3x Meals a Day (Daily)". The toast says "recorded for billing". The server diner card ("18 meals till 11/1") and close screen ("30 meals / month … 17 meals left") are unchanged; they use the seed `residents.plan` and `mealPlans`.
  - *Kitchen notes* ("The cook line sees this on every ticket.") set to "AUDIT no salt at all": the cook ticket doesn't show it. Nothing outside the Back Office reads `kitchenNotes`.
  - The page lists only 7 of the tablets' ~25 residents.
- **Code:** `src/surfaces/backoffice/pages/residents/ResidentDetail.tsx:30-35,121`; `src/surfaces/backoffice/kit/residentRecords.ts`; `src/surfaces/server/order/close/closeMath.ts:9,82-86,145-148`.

### M10. Retiring or renaming a venue doesn't change the floor
- **Where:** Venue Settings → Details → *Retire* ("It leaves the floor and the kitchen screens") and *Venue name*.
- **Actual (`audit-f-t14.mjs`):** I renamed The Bistro to "Bistro RENAMED" and retired it (`active:false`). The server's venue menu still offers "Orange Blossom Bistro", and the new name appears nowhere on the floor. The venue switcher, side work, corkage and floor all list seed `rooms`.
  - The "Kitchen" field's hint ("Orders from this venue go to this kitchen's screens") also has no effect. Orders route by table room. `venue.room` only affects which printers are used.
- **Code:** `src/shell/controls.tsx:154`; `src/shell/session.ts:46-49`; `src/surfaces/backoffice/pages/venues/VenueDetails.tsx` (retire, name, kitchen hints).

### M11. PIN reset only works for the 3 tablet staff. 7 associates with PINs (including server Marisol Garcia) can't sign in
- **Where:** Associates & PINs.
- **Actual (`audit-f-t21.mjs`):** Resetting Adriana works: the old PIN 2468 is rejected and the new one signs in as AA.
  - Marisol Garcia (Dining Server, with open checks on the floor) has PIN 5820, and it is **rejected**.
  - `checkPin` only searches `staff.json` (AA, RJ, MC), so PINs shown or reset for Marisol, Tomas, Grace, Jamal, Sofia, Hannah and Oscar do nothing.
- **Code:** `src/shell/session.ts:40-44`; `src/surfaces/backoffice/pages/access/pins.ts:10-14`.

### M12. Most Recipe Book recipes have no allergens, so dishes added to a menu carry no allergy warning
- 465 of 521 seed recipes have no allergens. On m1, 349 of 405 placed recipes have none; on m5 (next quarter), 272 of 274.
- Unflagged dishes include Shrimp and Grits, Crab Stuffed Sole, Pan Seared Scallops, Manhattan Clam Chowder, Fish and Chips, Lobster Ravioli and Dungeness Crab Louie.
- When added (`audit-f-t10.mjs` added Shrimp and Grits), the tablet item gets `allergens: []`.
- **Code:** `src/surfaces/backoffice/menus/seed/recipes.json`; `src/surfaces/backoffice/menus/model/tablet.ts:111-131`.

### M13. The floor menu is only recomputed when someone edits in the Back Office, so scheduled changeovers and a new day go stale (code reading, not reproduced)
- `live` is computed with `at: now()` inside `updateBo` and persisted. Otherwise it is only refreshed while the Venue Settings page is open (`venueSettingsStore.subscribe(refreshLiveMenu)`).
- Sequoia's scheduled m5 start (`upcoming`) won't take effect on the floor until some Back Office edit happens after that date.
- `TODAY_MENU_DAY` and `menu`'s turned days are computed once at module load, so a tablet left open past midnight keeps yesterday's cycle day.
- **Code:** `src/surfaces/backoffice/menus/data.ts:100-143`; `src/surfaces/backoffice/pages/venues.tsx:58`; `menuCatalog.ts:15`; `src/data/index.ts:96`.

### M14. Printer mode: routing works on the server's Send only, and other paths never print
- **Verified working (`audit-f-t11.mjs`):** Kitchen mode set to Printers, Hot Line +Desserts. Send gives "Printed at Hot Line (3 items) · Cold / Pantry (1 item) · Expo Receipt (whole ticket)" plus the unreachable-printer toast.
- **Gaps:**
  - Kiosk orders (`dining.sendOrder` at `kiosk/index.tsx:143-144`) never go through `printJobs`, so in printer mode (cook and expo screens off) the kitchen gets nothing.
  - Held lines are excluded (`!l.hold`) and printed by nothing later.
  - Printers are picked by `o.room` (kitchen), so every printer of every venue sharing that kitchen prints. `venue.ts` notes that `o.room` is unreliable for some seeded Evergreen checks ("bistro").
- **Code:** `src/surfaces/server/order/OrderScreen.tsx:143-155`; `src/store/venueSettings.ts:226-231`.

---

## MINOR

### m1. The KDS name placeholder doesn't match what the floor shows for 304 recipes
- The Recipe Book placeholder uses `recipe.shortDefault`, but the floor's `shortName()` ignores `shortDefault`. 304 of 390 recipes with a `shortDefault` differ, for example "Albondigas" vs "Albondigas Soup".
- `setRecipeShort` deletes an override that equals `shortDefault`, so typing the suggested short name has no effect on the floor.
- Explicit KDS names do work (verified "PchAUD" on tablet and expo).
- **Code:** `src/surfaces/backoffice/menus/model/shortNames.ts:6-14`; `src/surfaces/backoffice/menus/recipeActions.ts:31-37`; `src/domain/menu.ts:192-209`.

### m2. Modify-screen group lookups are built once at load
- `groupById` and `groupOfOption` are built once at module load. A group renamed or a choice added in the Back Office shows in the list, but `modsFromPicks` and `parsePick` use the old map, so the ticket key uses the old group name until reload.
- **Code:** `src/surfaces/server/order/menu/modifiers.ts:84-90,170-185`.

### m3. Meal Plans plan types and Meal counts are saved but unused
- Both pages say so in callouts ("Checkout doesn't use this list yet").
- Plan amount and type edits don't change close & charge, which uses seed `mealPlans`.
- **Code:** `src/surfaces/backoffice/pages/plans/index.tsx:43-45`; `src/surfaces/backoffice/pages/mealdrops/index.tsx:54-56`.

### m4. Associate weeks start on Monday, menu weeks on Sunday
- The associate "special of the week" uses Monday-based weeks ("Oct 5 to Oct 11"), while menu weeks run Sunday to Saturday.
- **Code:** `src/surfaces/backoffice/pages/assoc.tsx:177-187`; `src/domain/assocMeals/menu.ts` (`mondayOf`).

### m5. Back Office-created recipes get odd à la carte prices
- À la carte price is guest price + $2.
- With no price set, guest and à la carte are both $0, so the dish is free à la carte unless the Prices tab is set.
- **Code:** `src/surfaces/backoffice/menus/model/tablet.ts:110-117`.

### m6. Kiosk orders for tomorrow get today's menu
- The kiosk offers today's and tomorrow's meals, but `kioskMenu(meal)` has no date, so tomorrow's order shows today's specials.
- **Code:** `src/surfaces/kiosk/index.tsx:122-129`; `src/domain/kioskMenu.ts:184`.

---

## What works (verified)
- **Recipe Book → floor and kitchen (`audit-f-t6.mjs`):**
  - Rename and KDS name ("PchAUD") reach the server tile, cook and expo.
  - Adding Wheat gives a Gluten flag for Beatrice and "Contains gluten. Beatrice is allergic".
  - The "Don't forget" reminder shows on Expo.
  - Who makes it = Server: the cook ticket drops the entrée and expo shows it ready.
- **Menu Cycle → server tablet:** add, remove and swap of today's specials all reach the tablet (`audit-f-t10.mjs`, `audit-f-t23.mjs`). Production follows the grid.
- **Prices:** Sequoia à la carte price reaches close & charge.
- **Meal Credits:** changing "Other extras start as: À la carte" turns "2 credits" into "1 credit + $15 à la carte" on close (`audit-f-t19.mjs`).
- **Hospice:** toggling it in the Back Office comps the meal at close (`audit-f-t25.mjs`).
- **Side work:** adding a task and assigning it updates the server chip (0/3 → 0/4) live (`audit-f-t15.mjs`).
- **Printer routing:** reaches the server's Send summary (`audit-f-t11.mjs`).
- **PIN reset:** works for tablet staff (`audit-f-t21.mjs`).
- **Associate special choice:** reaches the server associate menu and the manager screen (`audit-f-t18.mjs`).
