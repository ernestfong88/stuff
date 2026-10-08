# Pre-ship audit: what was fixed

The audit checked two things: does every screen work, and does every setting take effect. Six auditors wrote up findings (`docs/audit/audit-a…f-findings.md`):

- 6 blockers
- 49 majors
- 101 minor issues
- 47 cosmetic issues

This page lists, for each blocker and major, whether it is fixed. It also lists the gaps that were left.

Checks after the fixes:
- `tsc -b` clean
- `oxlint` clean
- 589 unit tests pass
- 15/15 end-to-end tests pass

Fixers also checked each fix by hand in the app.

## Blockers: 6 of 6 fixed

| Finding | Status | What changed |
| --- | --- | --- |
| Allergy warnings only fired on an exact text match (f B1) | Fixed | `domain/allergens.ts` reads free-text allergies and diets ("MUSSELS, OR CLAMS" → Shellfish, vegan → milk, egg, meat…). Warnings show on menu tiles, Modify, check lines and usual-dinner suggestions. |
| Week 1 started / builder dates didn't change the dining room menu (f B2) | Fixed | One calculation of each venue's cycle day (`store/venueMenu.ts`) drives the server, 86 list, kiosk, display, Prep, Production, associate menu and printouts. |
| Renaming a venue emptied Production and the associate special (f B3) | Fixed | Production looks venues up by id, not name. |
| New or renamed tables didn't reach the server, Cook or Expo (f B4) | Fixed | The saved floor plan (`store/layoutStore.ts`) is used everywhere a table is named or placed, and open screens update live. |
| A comped check still billed the resident (f B5) | Fixed | The charge sync voids a waiting charge when its check is comped, paid another way or reopened ("voided: check comped"), and brings it back if that is undone. |
| Bar screen phase off, but alcohol still went "to the bar" and got stuck (e B1) | Fixed | With the Bar screen's phase off, drinks go to the server. Drinks already stuck show as the server's to pour. |

## Majors

### Order flow, kitchen, printing (a M1–M6, b M1–M5, e M2, M4–M6, f M6–M8, M14)
| Finding | Status |
| --- | --- |
| Holding an entrée still fired its sides | Fixed: sides are held and released with their plate |
| Resident could be seated at two tables | Fixed: shows "At SQ 1 with Adriana" and asks to move them or cancel (server and host) |
| Close & charge with unsent items | Fixed: asks *Send them / Remove them / Close anyway*, and warns when plates are still cooking |
| Empty check from a mis-tap blocked sign-off | Fixed: removed on Back; *Void empty check* on the check, the map and Shift Review |
| "Add to order" hidden behind the send bar | Fixed: the footer is pinned |
| "Ready to run" timers showed 0:00 | Fixed: same ready time as the manager map; survives a reload |
| Expo and PU & Delivery hand-offs disagreed (three findings) | Fixed: both use one set of hand-off actions (`store/queueHandOff.ts`) |
| Lateness measured from the start of the window | Fixed: measured from the end of the 15-minute range |
| Stale lunch associate meals on Expo at dinner | Fixed: dropped after an hour, listed as "Missed earlier today" |
| Expo "Text {name}?" sent nothing | Fixed: goes through the outbox with the Messages wording |
| Ranges off removed the order type from the kiosk | Fixed: the kiosk offers "As soon as it is ready" |
| Kiosk orders never printed; only server Send printed | Fixed: every path that reaches the kitchen prints (`store/kitchenPrint.ts`); Cook and Expo list the last tickets printed |
| "Server makes it" entrée left its sides on the Cook line | Fixed: sides follow their entrée's route |
| Modifier pins didn't reach the server; up-charges never charged | Fixed: Modify uses the pins and shows "+$2.00" with an add-on total |
| Associate special daily limit not enforced on the server | Fixed: counts server-rung meals; "N left" and "Sold out" |

### Menus, venues, production (c M2–M5, M9, M12; f M1–M5, M10, M13)
| Finding | Status |
| --- | --- |
| Only Sequoia drove the floor menu and prices | Fixed: each room orders from its own venue's menu and prices (Bistro prices reach checks). **The bar menu is not wired; see below.** |
| À la carte choice ignored | Fixed |
| "No cycle menu" still served the old cycle | Fixed: no specials, no fallback |
| Removed specials stayed on the kiosk and TV; the Prep tablet ignored Menu Cycle | Fixed |
| Floor menu went stale without Back Office open | Fixed: recomputed on venue changes, on reset and at midnight |
| Retiring or renaming a venue didn't change the floor | Fixed |
| A shorter cycle did nothing | Fixed: asks before removing filled weeks, with Undo |
| Venue menu changes went live at once, including unapproved menus | Fixed: asks first, with a stronger warning for unapproved menus, and Undo |
| "Cake" / "pie" filed as dessert (pancakes, pot pie…) | Fixed |
| Routing only for this week's dishes | Fixed: covers the whole cycle |
| New menu cycle copied the live name | Fixed: e.g. "VT Fall 2026 (draft)" |
| Menu Export count and Bistro printout wrong | Fixed |

### Floor plan (c M1)
| Finding | Status |
| --- | --- |
| Unsaved floor plan edits lost on leaving | Fixed: the draft is kept until it is saved or discarded |

### Residents, food safety, staff (d MJ-1, MJ-2, MJ-5, MJ-6; f M9, M11, M12)
| Finding | Status |
| --- | --- |
| Dining Plans and Add a charge listed 7 of 25 residents | Fixed: all 25 |
| Severe peanut allergy lived only in a kitchen note | Fixed: Joan's allergy is recorded. Dining Plans warns when a note mentions an allergen that isn't on the list. |
| 465 recipes had no allergens | Fixed as **suggested** allergens, read from the name, description and ingredients. Recipe Book has *Confirm suggested*. |
| IL/AL disagreed between Billing and Residents | Fixed: both use the care record |
| Plan change saved with no Undo; plan changes never reached the floor | Fixed: Undo added; Close & charge, billing, kiosk and the plan line use the Back Office plan. **See the decision below.** |
| Kitchen notes never reached the cook | Fixed: shown on Cook and Expo tickets |
| PIN sign-in only worked for 3 staff | Fixed: every associate with a PIN can sign in |

### Billing and settings (d MJ-3, MJ-4; e M1, M3; c M6–M8, M10, M11)
| Finding | Status |
| --- | --- |
| Pacing reset skipped "How orders reach the kitchen" | Fixed |
| Three different delivery fees | Fixed: one fee per venue, used everywhere |
| Check timeline amber/red were saved but never used | Fixed: Order History shows a Timing box coloured by them |
| Hospice delivery-fee waiver OFF had no effect | Fixed |
| Printer removed with no confirm | Fixed: asks first, with Undo |
| "Pair a terminal" was a dead end | Fixed: pairing-code dialog |
| Printer IP not checked | Fixed: must be a valid, unused IPv4 address |
| Production "Confirm all" confirmed 163 counts in one click | Fixed: asks first, with Undo |
| Venue name could be blank or a duplicate | Fixed |

The minor and cosmetic findings were also worked through; most are fixed. Examples:
- "1 meals left"
- Reserved tables are now marked, and asked about before a check starts
- "5 seated at a table for 4"
- Tiles stay inside the room border
- A minimum table size, and overlap warnings
- Toasts no longer stack stale Undo buttons
- Reopen asks first
- Number boxes enforce their limits
- Blank messages are refused
- Associate weeks start on Sunday

## Not fixed (known gaps)

- **Bar menu** (`barMenu.json`): its food items aren't Recipe Book recipes, so the Bistro bar still orders from the Bistro All-Day menu.
- **VT Winter 2027 builder dates** run 11/29 to 1/2, although the quarter is Jan to Mar. Only the name was fixed, because the seed's AI review talks about Christmas week.
- **The kiosk** shows today's menu for tomorrow's orders.
- **Usual-dinner suggestions** at a Bistro check come from the dining room menu.
- **Expo and PU & Delivery** still define "late" differently (b m3).
- **Associate Phone "Contains"** lists recorded allergens only, not suggested ones.
- **The printed runner copy** doesn't carry kitchen notes. They do show on the Cook and Expo screens.
- **Floor plan editor:**
  - "Add table" can drop a table across two room sections.
  - The size tag ("11 × 10") has no unit.
  - SQ 1 and SQ 2 overlap the SEQUOIA label.
- **Time to greet → "Don't count under"** has no live reader yet; Shift Metrics uses demo data. The page says so.
- **Fill from recipe book** fills lunch and dinner only. The page now says so.

## Meal plans: the Back Office plan always applies

Two seed residents had a Back Office plan that disagreed with their dining record: r4 Rose (3 a day vs 2) and r7 Frank (spend-down vs 30 a month).

- Both seed records now match the tablets. Rose is on the new *AL 2x Meals a Day* plan, and Frank is on *IL Resident Meal Plan*.
- The Back Office plan now always decides what Close & charge, billing, the server and the kiosk count. The dining record is only a fallback for a resident with no Back Office plan.
- A test checks that every seed resident has the same plan in both places.
- Copies already saved in a browser are brought up to date: an unchanged plan follows the seed, and the missing plan is added.
