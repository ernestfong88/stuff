# Audit D: Back Office "every page works" (POS Settings, KDS, Kiosk, Residents, Billing, Associates & PINs, HO Settings)

Read-only audit. App: http://localhost:5199. Playwright Chromium, a fresh context (fresh demo data) for each script.
Screenshots are in `audit-d-shots/` under the scratchpad dir: /tmp/claude-0/-home-user-stuff/9c0a84f7-91ae-5489-902d-20a7ff813b2e/scratchpad/audit-d-shots/
Scripts: `audit-d-*.mjs` in the same scratchpad dir.

## Coverage and global results

- **Pages covered:** svcFlow (all 3 tabs), svcWin (Pick up times: order types, ranges offered with fine-tune, how many per range, timing; Delivery fees & sick waivers), svcTexts (Wording, Residents without a mobile, Sent, Broadcasts), kds, svcKiosk, resProfiles (Profiles, Allergies & diets, Trivia), residents (Dining Plans & Notes and resident detail incl. hospice), svcRes, chargeReview, orders, plans (Plan types, Meal counts, Corkage), access, svcAlerts, svcMetrics, credits, phases. I also checked the side-nav Phase 2/3 switches, the Demo box in the top-right screen menu, and the "switched off" notices for pages and screens.
- **Viewports:** 1280x800 and 1920x1080 in full, plus a 1024x768 pass. At 1024 the side nav becomes a hamburger drawer; its Phase switches work and Esc closes it.
- **Console errors and page errors:** none on any page, at any size, in any script.
- **Horizontal page scroll:** none at 1024, 1280 or 1920. One case at 130% text size, noted below.
- **What works:** all Reset to defaults dialogs I tested open, cancel and confirm correctly (Pacing, Pick up times, Text wording, Alerts, Shift Metrics, Phases dialog-less reset). Undo toasts work for ranges, retire fee, check corrections and charge approval. Settings persist across a reload: number boxes, selects, toggles, KDS screens, kiosk order and rotation, capacity, cutoff, NOC time, packing time, PIN reset, hospice, kitchen notes and plan. Switching Phase 2 off turns Phase 3 off; switching Phase 3 on turns Phase 2 on. When a phase is off:
  - its pages leave the nav and Ctrl K search, and its screens leave the screen menu;
  - #/backoffice/kds and #/backoffice/svcKiosk show the "Phase N is switched off" notice with a "Switch Phase N on" button;
  - #/cook shows the "Cook is part of Phase 2" notice;
  - the KDS card on Pacing & Coursing locks and the kitchen falls back to Printers. Switching the phase back on restores KDS.

---

## Blocker (0)

None found.

---

## Major (6)

### MJ-1. Dining Plans & Notes and "Add a charge" list only 7 of the 25 residents
- **Page:** Residents > Meal plans & kitchen notes (#/backoffice/residents); Billing > Charge Approval > Add a charge.
- **Steps:**
  1. Open #/backoffice/resProfiles. It shows 25 resident cards.
  2. Click "Meal plans & kitchen notes".
- **Happened:** the list shows only Marty, Cathie, Eleanor, Tom, Rose, Frank and Joan. Beatrice Sanderson (ON HOSPICE on Profiles), Harold Yeung, Mildred Vanholder, Walter Okonkwo and 14 others are missing. You can't set their meal plan, start day, dining preferences or kitchen notes here. The "Add a charge" Resident select has the same 7, so a manual charge can't be added for the other 18.
- **Expected:** the same resident roster everywhere.
- **Screenshots:** audit-d-shots/tall-1280-residents.png, audit-d-shots/tall-1280-resProfiles.png, audit-d-shots/charge-add.png

### MJ-2. A severe peanut allergy lives only in a free-text kitchen note, so the allergy views don't show it
- **Page:** Residents > Joan Petrovic (#/backoffice/residents/r6); Residents > Allergies & diets.
- **Steps:**
  1. Open Joan Petrovic's Dining Plans detail. Kitchen notes reads "NO peanut products — severe". Diet and allergies (read only) shows only "No Dairy, Avoid Soy (Sensitivity)".
  2. Open Allergies & diets and search "peanut".
- **Happened:** "No resident matches these filters". The "4 with an allergy" count leaves Joan out, and her profile card chip shows only "No dairy/soy". Her recent orders also include "Vanilla Ice Cream Cup" despite No Dairy.
- **Expected:** a severe allergy is listed as an allergy, gets a ticket tag, and is found by search. Failing that, the page should warn when a kitchen note mentions an allergen that isn't on file.
- **Why it matters:** a chef relying on the Allergies & diets page would miss it. This is a food-safety risk, although it comes from the seed data.
- **Screenshots:** audit-d-shots/res-detail-joan.png, audit-d-shots/tall-1280-resProfiles_diets.png

### MJ-3. Pacing & Coursing "Reset to defaults" doesn't reset "How orders reach the kitchen"
- **Page:** POS Settings > Pacing & Coursing.
- **Steps:**
  1. On Courses and timing, click the Printers card. Coursing is replaced by "Off with printers…".
  2. Click Reset to defaults. The dialog says "Coursing, greet times, pick up tracking and every switch on all three tabs go back to the standard."
  3. Confirm.
- **Happened:** Printers stays On (the default is Kitchen screens) and coursing stays hidden. The cause is that `onReset` only clears `flow` and `course`, not `kitchenMode`.
- **Expected:** either the kitchen goes back to KDS, or the dialog says the kitchen choice is kept.
- **Screenshots:** audit-d-shots/flow-reset-dialog.png, audit-d-shots/flow-after-reset.png

### MJ-4. Three different delivery fees across the Back Office
- **Pages:** Pick Up & Delivery > Delivery fees & sick waivers; Billing > Charge Approval; Billing > Order History.
- **Happened:**
  - The fee list has "$7.00 Delivery Fee".
  - The banner says checkout charges the "standard delivery fee (Sequoia / Evergreen $3, Orange Blossom Bistro $3)".
  - Charge Approval shows delivery charges of **$5** ("Delivery — Room Service, Dinner").
  - Order History detail shows "Delivery: Room delivery · $3", and "Room delivery" isn't in the fee list.
  - The fee list also contains "Dine In" and "To-Go", which aren't delivery fees.
- **Expected:** one consistent delivery fee, and a fee list that holds only delivery fees.
- **Screenshots:** audit-d-shots/tall-1280-svcWin_fees.png, audit-d-shots/tall-1280-chargeReview.png, audit-d-shots/orders-open-check.png

### MJ-5. Resident care level (IL/AL) disagrees between Billing and Residents
- **Pages:** Charge Approval vs Residents > Profiles and Allergies & diets.
- **Happened:**

  | Resident | Charge Approval | Residents pages |
  |---|---|---|
  | Rose Delgado | IL | AL |
  | Frank Dellacroce | IL | AL |
  | Joan Petrovic | AL | IL |

  Dining Plans also lists Tom Beaumont as AL on "IL Resident Meal Plan" and Frank as AL on "IL Spenddown".
- **Expected:** one level per resident on every page, which matters when approving charges.
- **Screenshots:** audit-d-shots/tall-1280-chargeReview.png, audit-d-shots/tall-1280-resProfiles_diets.png

### MJ-6. Changing a resident's meal plan saves instantly, with no confirm and no Undo
- **Page:** Residents > Dining Plans & Notes > any resident.
- **Steps:**
  1. Open Joan Petrovic.
  2. Change Plan from "IL Resident Meal Plan" to "IL Spenddown".
- **Happened:** it saves at once with the toast "Plan changed to IL Spenddown. The change is recorded for billing." There's no confirm and no Undo, although the card says "Plan changes drive billing". Afterwards her Profiles card still says "18 meals left" even though the plan is now dollar-based.
- **Expected:** confirm or Undo on a billing-impacting change, and the profile summary updates.
- **Screenshot:** audit-d-shots/res-detail-joan.png

---

## Minor (24)

1. **Shift Metrics accepts impossible targets.** Type 9 in "A shift is great when [ ] of 7 measures". It is kept and the sentence reads "9 of 7 measures". Turning every "Counts" off gives "9 of 0 measures". There's no clamp and no warning, so a shift can never be great. Screenshot: audit-d-shots/metrics-own-goal.png.
2. **Shift Metrics offers goals for measures that aren't scored.** "Use my own goal" appears on rows marked "Shown as a count" (Covers, Tables turned, Slow greetings, Remakes, Cancels), which suggests the goal has an effect. Screenshot: audit-d-shots/tall-1280-svcMetrics.png.
3. **Alerts & Timing accepts amber later than red.** Cooking > Check timeline: setting Amber after 25 with red after 18 is saved with no warning. Typing 0 in a red box silently turns it into "Off". Screenshot: audit-d-shots/alerts-amber-gt-red.png.
4. **Pacing > Time to greet accepts the thresholds the wrong way round.** "Don't count under" 10 with "Slow over" 3 is saved with no warning. Screenshot: audit-d-shots/flow-under-gt-over.png.
5. **Number boxes have no upper bound.**
   - Check-in nudge accepts 999 min.
   - Pick up Timing "Orders close before the range starts" accepts 600 min. The NOC hint then says "orders close 600 min before" and the toast says "orders close at 8:00 AM".
   - Meal Credits passes `max={9}` to NumberBox, but 99 entrées per credit is accepted and persists, so max isn't enforced.
6. **Meal Credits edge cases.**
   - With every count set to 0, the "Servers see" line becomes the broken text "per credit · a 1st side and added proteins are à la carte…" and there's no warning that a credit covers nothing.
   - "Reset to standard" resets at once with no confirm, unlike every other settings page.
   - Screenshot: audit-d-shots/credits-all-zero.png.
7. **Capacity silently rounds and forgets the venue.** "Max orders per 15 minute window" changes 2.7 to 2 without saying so. The venue picked with the Sequoia/Orange Blossom tabs resets to Sequoia after a reload, and the value just entered for Orange Blossom isn't visible until you re-select it.
8. **Ranges offered "until" moves the start without saying so.** With Breakfast from 8:00, picking "until 7:45 AM" silently changes from to 7:30. Undo works.
9. **Message wording can be saved empty.** Clearing "Pick up is ready wording" is saved and the preview shows "(empty)", so a blank SMS would go out. There's no warning. Screenshot: audit-d-shots/texts-empty.png.
10. **Reservation texts use a misleading chip.** On Reservation reminder and Reservation changed, the {time} chip is labelled "Ready time", but it is the reservation time.
11. **Broadcasts: Publish is greyed out with no reason.** With Show until earlier than Show from, "Publish broadcast" is disabled and nothing says why. Screenshot: audit-d-shots/bc-until-before-from.png.
12. **Delivery fees: a negative fee becomes "No charge" silently.** Add a fee with -4 and Save: the row shows "No charge" with no validation message.
13. **KDS Settings in Printers mode give no hint the screens are off.** The full screens editor stays active with no note like "These apply once you switch to kitchen screens" (Ranges offered has a similar note). A screen name can also be saved blank. Screenshot: audit-d-shots/kds-printers.png.
14. **Pacing in Printers mode keeps wording that no longer applies.** "Light up the Check in button after… Minutes after a course is run" and the greet settings stay, although printer mode has "No cooking, ready or served statuses". A chef may not know whether these still apply.
15. **Coursing key doesn't match the dropdown.**
    - The key lists "Auto-fire +5 / +8" and "Backup 15 min after a drop", but the dropdown has separate "Auto-fire +5" and "Auto-fire +8" and no "Backup" option.
    - Backup is a rule that applies to every mode, yet it reads like a sixth choice.
16. **Allergies & diets rows are a dead end.** Clicking a resident row does nothing; you can't open the resident from here.
17. **Order History corrections leave the check inconsistent.**
    - After "Comp the check", the diner still shows "Paid with Apartment Charge $3.00", while the row shows "Comped —".
    - A reopened check stays "Comped".
    - The Associate filter lists "Marisol", while rows show the initials "MG".
    - Screenshot: audit-d-shots/orders-open-check.png.
18. **Meal Plans default radio and retire.**
    - With two defaults flagged ("Two plans are marked default…"), ticking the one already ticked does nothing. You have to tick another plan and then tick back.
    - Retiring "IL Resident Meal Plan", the default used by most residents, has no warning, and it is still offered in each resident's Plan dropdown.
    - Save stays enabled with an empty plan name.
19. **Charge amounts are formatted inconsistently.** A manual charge of 12.5 shows as "$12.5" in Charge Approval, and Order History shows "$3" vs "$3.00".
20. **Release Phases lets the Back Office screen be moved to a phase that has no effect.** Move "Back Office" (Screens) to Phase 2 and switch Phase 2 off: Back Office stays fully usable and stays in the screen menu with no explanation. That is sensible, since it avoids a lockout, but it contradicts "A phase that is off hides its screens". Screenshot: audit-d-shots/bo-screen-phase2-off.png.
21. **Release Phases "Reset" has no confirm and leaves phases off.** It resets the whole phase plan immediately, unlike other pages, and doesn't switch Phase 2/3 back on.
22. **Pick up times "Reset to defaults" is orphaned.** It sits alone, left-aligned, between the hub tabs and Order types, and doesn't say it only covers Pick up times rather than Delivery fees. Screenshot: audit-d-shots/tall-1280-svcWin.png.
23. **Meal Credits guest-meal list is hard to scan.** About 35 community switches with no search, and the community being viewed (Valencia Terrace) is near the bottom.
24. **Associates table hides Reset PIN at 130% text.** At 1280x800 with A+ at 130%, the table scrolls sideways and "Added from ADP" and "Reset PIN" are off-screen with no scroll cue. Screenshot: audit-d-shots/zoom-access.png.

---

## Cosmetic (16)

1. "1 meals left" (Rose Delgado on Profiles).
2. "IL Couple Spendown" next to "IL Spenddown" (spelling).
3. "À la carte (no plan) (Monthly)" with "0 meals" reads oddly.
4. Meal counts list has duplicates "A la Carte" and "Ala Carte".
5. Dining Plans list shows the raw allergy text "MUSSELS, OR CLAMS" as a chip, while Profiles shows "Shellfish".
6. Breadcrumb reads "Residents > Residents > Dining Plans & Notes".
7. The Profiles tab has a sub-button "Allergies & diets" that duplicates the tab of the same name next to it.
8. "Jamal Brooks's PIN" (aria label). The PIN search placeholder is clipped: "Search name, title, ADP number or logi".
9. Recent waivers mix ID formats: "order O2" vs "#D1042".
10. A posted broadcast reads "launches portfolio-wide Sept 1." but shows Oct 4 to 21 (stale demo copy).
11. KDS "Not ticked anywhere, so they go to Hot: Bread, Shareable": "Bread" exists as both a Starter and a Side, so it's ambiguous.
12. Release Phases stat cards "4 · 20 / Phase 1: screens · pages" are cryptic.
13. Shift Metrics "of tables past C2": "C2" is jargon.
14. Order History / resident Recent orders show odd times, e.g. a Breakfast check closed 8:46 PM and Lunch delivery at 7:14 PM (demo clock).
15. Kiosk "Turn the screen" uses role=tab buttons for a setting, and Pick up Order types toggles all have the same accessible name "Use ranges" (accessibility).
16. Dining preferences save on every keystroke on the Dining Plans detail, but the same field on the profile ("Likes and dislikes") needs a "Save preference" click. The fields do stay in sync.

---

## Counts

| Severity | Count |
|---|---|
| Blocker | 0 |
| Major | 6 |
| Minor | 24 |
| Cosmetic | 16 |
