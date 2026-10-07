# Audit B: PU & Delivery, Cook, Expo, Prep, Associate Phone, Kiosk, Specials Display

Run date: 2026-10-07. Dev server http://localhost:5199, every URL loaded with `?clock=17:45`. Each run used a fresh Playwright Chromium context (fresh demo data), with all phases on.
Sizes tested: PUD/Cook/Expo/Prep at 1024x768 and 1280x800, Associate Phone at 390x844 (plus 360x740), Kiosk and Display at 1920x1080 and 1280x800. Text size was also tested at max A+ (120%).
Scripts: `audit-b-*.mjs` in this scratchpad. Screenshots: `shots/` (paths below are relative to the scratchpad).

**Console / page errors:** none. Every run captured `pageerror`, `console.error` and `console.warning`, and all lists came back empty.
**Horizontal page scroll / page overflow:** none on any screen at any tested size.

Counts: **Blocker 0 · Major 5 · Minor 14 · Cosmetic 10**

---

## Blocker

None. Every screen loads, and every main flow can be completed end to end.

---

## Major

### M1. Expo "Order ready?" on a pick up or delivery leaves PUD at "In the kitchen"
- **Screen:** Expo with PU & Delivery
- **Repro:** Fresh context. Open `#/expo` and `#/pud` in the same context. On Expo, Harold's PU card, tap **Order ready?**. The Expo card turns **Ready** and offers "Text Harold? / Picked up?". Switch to PUD (reloading makes no difference).
- **Actual:** PUD still lists Harold under **In the kitchen · Nothing to do yet**, with status "In the kitchen". The stored order shows the reason: Expo marked only the soup and the entrée ready, while the sides stay `cooking` (`d_mashed/cooking`, `d_greenbeans/cooking`). `pickupStage()` needs every sent line ready or cleared.
- **Expected:** PUD moves the order to "Hand off now" (or "Take out for delivery" for a delivery), with status Ready, as soon as Expo calls it ready.
- **Shots:** `shots/b14-harold-ready.png`, `shots/b15-pud-after-expo.png`, `shots/b15-pud-after-expo-reload.png`

### M2. PUD "On my way" doesn't clear the delivery from Expo, which keeps asking "On its way?"
- **Screen:** PU & Delivery with Expo
- **Repro:** Fresh context with `#/pud` and `#/expo` open. On PUD, tap **On my way** for Lillian. Check Expo.
- **Actual:** Expo still shows Lillian as **Ready** with "On its way? · Texted 5:45 PM". The seeded order Samuel Ortiz already shows the same mismatch on first load: PUD has him in "On the way", while Expo shows a red **Late** card asking "On its way?". The ticket only leaves Expo once PUD marks the order Delivered. In the other direction it works: Expo "On its way?" moves PUD to On the way.
- **Expected:** Once the runner has left, Expo drops the card, or at least shows it as out with no action.
- **Shots:** `shots/b33-expo-Lillian.png`, `shots/b01-expo-1024.png` (Samuel)

### M3. Expo "Picked up?" doesn't record a pickup, so the label is misleading
- **Screen:** Expo with PU & Delivery
- **Repro:** Fresh context. On Expo, Helen's PU card ("Texted 5:36 PM"), tap **Picked up?**. Look at PUD.
- **Actual:** The card leaves Expo. PUD still shows Helen as **Waiting at the counter · 15m past** with a **Picked up** button, and Completed today doesn't change. With `pud.track` on, `handOff()` only clears the pass.
- **Expected:** Either the Expo button records the pickup, or it is worded as what it actually does ("Set out?" / "Off the pass?"). Right now the two screens disagree about whether the resident has the food.
- **Shots:** `shots/b15-pud-after-expo.png`

### M4. "Completed today" lateness is measured from the start of the window, so on-time deliveries are labelled late and the on-time % is wrong
- **Screen:** PU & Delivery, Completed today
- **Repro:** Fresh context, `#/pud`, then **Completed today**.
- **Actual:** Charles Whitman: "Booked 4:30 to 4:45 PM · delivered 4:36 PM" is headlined **"Delivered 7m late"** even though it arrived inside the window. The summary reads "5 handed off today · **40% on time**". The minute arithmetic is also off by one: Walter was booked 1:15 and delivered 1:40, which shows as "26m late", and Dorothy's "collected 41m after" should be 40m. `pickupLateMinutes()` compares against `readyAt` (the window start) and rounds seconds.
- **Expected:** A delivery inside its booked window counts as on time. Lateness for a delivery is measured from the window end. Minutes match the times shown on screen.
- **Shots:** `shots/b02-filter-All.png`, `shots/b02-filter-Completedtoday.png`

### M5. Expo Associates shows stale lunch meals as late, holding, with "Fire order?" at dinner
- **Screen:** Expo, Associates filter
- **Repro:** Fresh context, `#/expo`, then the **Associates (9)** filter.
- **Actual:** Lunch meals booked for 11:00–11:15 AM (Maria) and 1:30–1:45 PM (Devon, Grace), plus Priya's 4:30 dinner meal, show as red **Late** cards ("6h 45m over", "4h 15m over") that are still **Holding** with a big orange **Fire order?**. Nothing ages them out or marks them as no-shows. At 1280 wide, the names in these cards are cut to 4–5 letters ("Maria…", "Devo…", "Grac…", "Priya…") and the "Associate" chip reads "Ass…", so the expo can't tell who a meal is for.
- **Expected:** Past meal periods drop off, or show as missed or no-show. Names are readable.
- **Shots:** `shots/b09-expo-f-Associates.png`

---

## Minor

### m1. Reopen in Completed today acts immediately, with no confirm or undo, and the order comes back "Late 1h 15m"
- **Screen:** PUD, Completed today
- **Repro:** Completed today, then **Reopen** on Charles Whitman (delivered 4:36), then Back.
- **Actual:** The order is un-delivered straight away. The All count goes 12 → 13 and Completed 5 → 4, and Charles now sits in **On the way · Late · 1h 15m**. There was no confirmation and no Undo toast. Someone who only wanted to look at the order has now changed the metrics.
- **Expected:** Ask for confirmation or offer Undo. Better still, let the order be viewed without reopening it.
- **Shots:** `shots/b06-reopen.png`

### m2. Stacked toasts cover the list, and an older toast's Undo silently does nothing
- **Screen:** PUD
- **Repro:** At 1024x768, tap **Picked up** (Helen), **On my way** (Lillian), then **Delivered** (Lillian).
- **Actual:** Three toasts stack over the lower list, covering Ruth's "Finish order" row and the **Later** toggle for about 6 s. Tapping **Undo** on the older "Lillian's delivery is on the way." toast removes the toast but changes nothing: Lillian stays delivered. The wording "Lillian's delivery is delivered." also reads oddly.
- **Expected:** One toast, or a compact stack that doesn't cover the actions. An Undo that has gone stale should not be offered (or should say why it can't apply).
- **Shots:** `shots/b04-delivered.png`, `shots/b05-stale-undo.png`

### m3. Expo and PUD disagree on what counts as late
- **Screen:** Expo with PUD
- **Repro:** Fresh context at 5:45 PM.
- **Actual:** Helen (window 5:30–5:45): Expo shows a red **Late** badge, PUD shows "15m past" with no late styling. Samuel (window 5:45–6:00): Expo shows **Late**, PUD shows "due now".
- **Expected:** One definition of late across both screens.
- **Shots:** `shots/b01-expo-1024.png`, `shots/b01-pud-1024.png`

### m4. Course pacing: for about a second Expo offers "Fire course 2?" for a course the cook already has
- **Screen:** Expo with Cook and the Server tablet
- **Repro:** Server `#/server/new`: EG 6, Walter, Cheeseburger Soup + Peach Chicken + Trifle, then **Send to kitchen**. On Expo, EG 6 card, tap **Run course 1?**. Read Expo within about 1 s.
- **Actual:** Expo shows COURSE 2 as **Fire next** with a **Fire course 2?** button, while Cook already has the EG 6 C2 ticket (Peach Chicken). After about 2–3 s Expo catches up to "Fired / Course 2 ready?". A quick tap in that window risks a double fire.
- **Expected:** Expo shows Fired at the same moment the ticket reaches Cook.
- **Shots:** `shots/b10-expo-after-run1.png`, `shots/b10-cook-after-run1.png`, `shots/b11-expo-eg6-after-run1.png`

### m5. Expo "Not fired" shows big elapsed timers on orders booked for later
- **Screen:** Expo, Not fired
- **Actual:** Pick ups and deliveries booked for 7:30–8:00 PM show headline timers of **3:23:08** and **3:31:08** (time since the order was placed). In the pass's visual language that reads as 3 hours late. Seen at 5:45 PM.
- **Expected:** Show time until the order is due or fires (for example "fires 7:15"), not elapsed time.
- **Shots:** `shots/b09-expo-f-Notfired.png`

### m6. Associate Phone: "near break" is attached to the wrong times, and the times run past the end of the shift
- **Screen:** Associate Phone (390x844)
- **Repro:** Sun Oct 11 (shift 10:30 AM–7:00 PM, **break 2:30 PM**), **Plan a meal for this shift**.
- **Actual:** Lunch tags **1:15 to 1:30 PM · near break** and Dinner tags **4:30 to 4:45 PM · near break**, both over an hour from the break. Dinner also offers **7:00 to 7:15 PM** under "Pickup time · during your shift", which starts after the shift ends at 7:00.
- **Shots:** `shots/b22-plan-full.png`, `shots/b23-dinner.png`

### m7. Associate Phone: the "Plan any day, any time" toggle doesn't do what it says
- **Repro:** Turn on the toggle.
- **Actual:** The heading changes to "Plan a meal · any day", but the list is still only the associate's shift days (Oct 7, 8, 9, 10, 11, 13, 20). Cards still say "Plan … for this shift" and "Ordering for this shift has closed". The toggle (`role=switch`) has no accessible name. It also appears for a Med Tech even though the label says it is for "salaried and managers only".
- **Shots:** `shots/b24-anyday.png`

### m8. Associate Phone: future days are labelled "Today's soup"
- **Actual:** Planning Sun Oct 11 shows "SOUP OF THE DAY · Split Pea with Ham · *Today's soup*". Planning the Fri Oct 9 NOC shift shows "French Onion Soup · *Today's soup*".
- **Shots:** `shots/b22-plan-full.png`, `shots/b23-noc.png`

### m9. Associate Phone: changing a planned meal forces a new side choice
- **Repro:** Tomorrow's card, **Change**.
- **Actual:** The seeded planned Turkey Club (`am7`) has no side, but the menu requires one, so the confirm button reads **Pick a side** and nothing is preselected. Changing only the pickup time still means choosing a side. The kitchen also never learned which side the original plan had.
- **Shots:** `shots/b23-change.png`

### m10. Pick-up location is worded differently across screens
- **Actual:** PUD says "Ready for the resident at the **counter**" and "Waiting at the counter". The Kiosk tells residents "Collect it from the **Sequoia Dining basket**" and repeats that on the review and thank-you screens.
- **Shots:** `shots/b01-pud-1024.png`, `shots/b26-1280-review.png`

### m11. The PUD order screen uses dine-in wording for pick ups and deliveries
- **Repro:** PUD, open Helen's pick up order.
- **Actual:** "Close Helen · on plan · **seat stays open**", "Seat 1. Change seat", "Add diner to this check". There is no seat for a pick up.
- **Shots:** `shots/b02-open-helen.png`

### m12. Cook pick up and delivery tickets don't show when the order is due
- **Actual:** The Cook header shows only "Pick Up · Ricardo · ALL 6:20" and the timer. Expo shows the window ("6:00 to 6:15 PM") for the same order. Diego's order is labelled "**Associate Meal**" on Cook but "PU" on Expo and "Pick up" on PUD.
- **Shots:** `shots/b01-cook-1024.png`

### m13. At 120% text size, PUD cuts off order item lists
- **Actual:** At 1024 with A+ (120%), item summaries are cut with an ellipsis ("…Peas & C…", "…Green Bea…"), so the full order isn't readable without opening it. "New delivery" also wraps onto its own row.
- **Shots:** `shots/b31-pud-A+.png`

### m14. Seed data inconsistencies visible in the flows
- Joan Petrovic's likes say "No meat", but her "Usual dinner" is Spaghetti Bolognese (×2) (`shots/b07-joan.png`).
- Dorothy's completed order reads "Terrace Burger, Fries, Fries".
- Associate Phone allergen tags: only the salad shows "Contains: Milk". The cream-cheese wrap, the sourdough Turkey Club and other items show nothing.

---

## Cosmetic

- **c1. Display crossfade:** mid-transition, two slides' headings and text are drawn over each other ("Cheese Stuffed / Pineapple Trifle" overlap), which is illegible for about 1 s. `shots/b29-after86.png`
- **c2. No dish photos:** every Display slide and every Cook Menu tile shows the same placeholder plate icon, because `src/assets/dishes/` holds only a README. `shots/b01-display-1280.png`, `shots/b12-cook-MENU.png`
- **c3. Kiosk copy:** "Your meal comes with mashed potatoes and garlic green beans. Would you like to keep **it**?" should be "them". On the changes step, "✓ No changes" keeps its checkmark after a change chip is picked. `shots/b26-1280-16.png`
- **c4. Toast grammar:** "Lillian's delivery is delivered." (PUD).
- **c5. Printer-mode screen (Cook and Expo):** works as intended ("No Cook Line display at this community" / "No Expo display…"). The copy "exactly like today" is vague, the screen has no link to the setting, and a fresh demo shows "Expo Receipt" in red (not reachable). `shots/b17-cook-printers-1024.png`
- **c6. Recipe scaling:** units aren't normalised ("10 tbsp olive oil", "10 tsp kosher salt", "5 tbsp thyme"). `shots/b19-recipe.png`
- **c7. Bump Keys page:** "Previous ticket: ← on the bar | ArrowUp" sits beside "↑ on the bar = previous item", which is confusing. `shots/b12-cook-BUMPKEYS.png`
- **c8. Expo truncation:** "Margaret, Apt 2…" in the Not fired card header. `shots/b09-expo-f-Notfired.png`
- **c9. Date formats:** "21 meals till 11/1" sits next to "Sick fee waivers: 0 of 3 used until 10/31" (PUD order screen).
- **c10. Expo filter counts don't add up:** All active 16, but Not fired 6 + In progress 7 + Ready 8 = 21 (one card can count in several groups). Not explained on screen.

---

## Flows verified working (no issue)
- **PUD:** All / Pick up / Delivery filters and counts; Later Show/Hide; New pick up (search, resident, usual-dinner chips, specials, slot picker with Full / "2 left", "Schedule for … · kitchen fires at …"); New delivery (hospice prompt, sick fee waiver); Finish order; Picked up / On my way / Delivered; NOC "Set out" with Undo; Manager comp dialog; Completed today list.
- **Cook:** Hot / Cold / Bistro screens; tap item to mark ready; BUMP TICKET; RECALL menu returns the ticket to Cook and Expo; keyboard bump bar (0–9, Enter, M); ALL DAY; MENU; BUMP KEYS page; timers tick.
- **Expo:** filters; Run course 1 fires course 2 to Cook; Cook bump shows Ready with "Run course 2?"; Fire course 3; Text resident; kebab menu (Print for runner / Refire).
- **Printer mode:** Back Office → POS Settings → Pacing & Coursing → Printers switches Cook and Expo to their printer screens live, and back to KDS.
- **Prep:** venues, today and tomorrow meal tabs, Mark prepped (header count updates), checklist Stocked / Made a backup / Undo, Recipe scaled sheet, typed note saves, voice note gives a clear "Didn't hear anything" fallback.
- **Associate Phone:** plan (lunch, dinner, NOC), change, cancel with Undo, history.
- **Kiosk:** apartment lookup (with a clear error for an unknown apartment), identity check, pick up / delivery / sick delivery, times plus "Other times", specials, sides, soup, drink, dessert, changes, utensils, review, place order; the order appears in PUD "Later" as a Kiosk order; the done screen counts down from 20 s and resets.
- **Display:** 8 s rotation through 4 slides; 86 from the Manager removes the dish within one rotation; all specials 86'd shows "Please ask about today's menu"; triple-tap in the top-left corner previews Breakfast.
