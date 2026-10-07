# What changed: original mockup → edited mockup → app

This page is for the team that knows the original KiscoConnect Dining mockup.
It lists what is different in this repository and where to find it.

There are three versions:

| | Version | Where it is |
| --- | --- | --- |
| **A** | IT's original mockup (one compiled HTML file) | [`reference/KiscoConnect Dining · Original.html`](../reference/) |
| **B** | The edited mockup, which is A with the culinary team's changes | [`reference/KiscoConnect_Proposed.html`](../reference/KiscoConnect_Proposed.html) |
| **C** | This app: B rebuilt as source code, with the fixes and features below | `src/` |

There are two sets of changes:
- **A → B** is a design change. The culinary team edited screens, wording and flows in the mockup.
- **B → C** is a rebuild. The same product is now real code, with the bugs fixed and new features added.

To check a change, open A or B in a browser next to the app (`npm run dev`).

---

## At a glance

| Area | A → B (edited mockup) | B → C (this app) |
| --- | --- | --- |
| Platform | No change; still one compiled file | Vite + React + TypeScript source, tests, a single-file build |
| Surfaces | The same 12 modes | The same 12 modes, each loaded on demand |
| Back Office nav | The same 7 sections and 34 pages; two pages renamed | 9 sections: **Productions and Checklists** and **HO Settings** are new, and **Meal Credits** is a new page |
| Dashboard and P-Mix | Rebuilt with sentiment, steps of service and revenue; P-Mix gets charts | Kept, built on SVG charts |
| Recipe Book | Favourites, scores, much richer recipe form | Kept; now the source for associate meals and production |
| Menu Cycle | Quarter menus, à la carte, locking, approval | Kept; one source for venue menu schedules |
| Production | One day at a time | **Plan a week at a time** |
| Associate meals | Free-form menu | **Standard menu: a chef special per meal plus recipe-backed standing choices** |
| Meal credits | Only a guest-credit toggle | **Configurable rules in HO Settings, used at checkout** |
| Manager | Triage reasons, steps of service metrics, shift sign-off | Kept |
| Expo | Simpler prompts ("On its way?", "Picked up?") | Kept; chef's "Don't forget" reminders now show on tickets |
| Data | Stored in the page; lost on reload | Stored in the browser, synced across tabs, resettable |

---

## A → B: the edits made in the mockup

Both files have the same 12 modes and the same 34 Back Office pages. In the
compiled code, 164 functions were added and 44 changed; none were removed. By area:

### Back Office

**Navigation**
- Recipes was renamed **Recipe Book**.
- Menus & Cycles was renamed **Menu Cycle & À la Carte**.

**Culinary Dashboard**
- New cards: resident meal sentiment, steps of service, and revenue and comps.
- New callouts: **Top Action** and **Start here**.
- Details for a date range, day and week modals, and the drivers behind each number.

**P-Mix**
- Pie charts of specials against à la carte, and a top 10.
- Previous and next day, the full detail, and **Open the recipe** from a dish.

**Recipe Book**
- Favourites and score filters: *Loved (4+)*, *Needs attention (under 3)*, *Not on any menu*.
- *Search the recipe master*.
- The recipe form gained:
  - a menu descriptor and a KDS name;
  - scale to servings;
  - plating and presentation;
  - nutrition facts;
  - variations and chef's notes;
  - KDS & Recipe Book settings;
  - AI Autofill;
  - "Linked to a Kisco recipe · Home Office manages it".

**Menu Cycle & À la Carte**
- Quarter menus (VT Summer/Winter 2026/2027), à la carte menus and every-day items.
- *Serving now*.
- Lock and unlock, request and approval status, archive.
- A week selector and a plan picker.

**Modifiers**
- Retire a group.
- Copy from another community.
- Pin a recipe.

**Service Flow**
- "Off, all courses fire together".
- "Show usual picks".
- "Comp meals for residents on hospice".

**Billing and comps**
- Comp items and their approvers.

### Manager tablet
- **Triage** gives a reason for each item:
  - Get the drinks out
  - Greet the table
  - Check in
  - Check with the kitchen
  - Help take the order
  - Help close the check

  Triage can be viewed by table or by associate.
- **Metrics**:
  - On goal / Off goal and Due soon.
  - Steps of service gaps: seated to order, order to main course, and order to close.
- **Shift review**: sign off, with *Going well* and *To look at*.
- **Floor**: the "past threshold" and "tables with 2+ checks" text was removed.

### Expo
- The associate panel is simpler. The old notes such as "orders locked, cook to count" are gone.
- The prompts are now **"On its way?"** and **"Picked up?"**. They replace *On its way*, *Fire now* and *Bump course*.
- "No mobile" and "Not texted" were removed.

### Server tablet
- Sick waiver: "Another waiver needs a manager PIN".
- Menu reference: dish photos.

---

## B → C: the rebuild and what came after

### Platform

| Before (A and B) | Now (C) |
| --- | --- |
| One minified HTML file of about 100k lines | Source in `src/`, organised by surface, with a shared UI kit, domain logic and stores ([architecture](ARCHITECTURE.md)) |
| State lived in memory and was lost on reload | Shared stores persist to localStorage and sync live between tabs, so you can open Server and Cook side by side |
| Real wall clock | A demo clock pinned to 5:45 PM today so the service always looks live (`?clock=18:30`, `?clock=real`) |
| No tests | 369 unit tests (vitest) and 15 end-to-end flows across surfaces (Playwright) |
| — | `npm run build` produces a static site; `npm run build:single` produces one HTML file to share |
| — | Demo tools: *Reset demo data* and *Clear all tickets*, which work across tabs |

### Back Office navigation

Pages from the original sections were regrouped. Page ids are unchanged, so
old deep links such as `#/backoffice/production` still work.

| Section in A/B | Page | Section in C |
| --- | --- | --- |
| Menus & Recipes | Production, Prep Checklist | **Productions and Checklists** (new) |
| Dining Service | Side Work Tasks, Assign Side Work | **Productions and Checklists** (new) |
| Dining Service | Alerts & Timing, Shift Metrics | **HO Settings** (new) |
| — | Meal Credits | **HO Settings** (new page) |
| — | Release Phases | **HO Settings** (new page) |
| Billing → Meal Plans | "Residents can use their meal credits for guests" | Moved to **HO Settings → Meal Credits**; Meal Plans links to it |

The final order is:
1. Today
2. Menus & Recipes
3. Productions and Checklists
4. Venues
5. Dining Service
6. Residents
7. Billing
8. Associates & PINs
9. HO Settings

### New features

**Weekly production planning** (Back Office → Production)
- Week tabs for this week and next, a day strip, and a *week at a glance* table.
- *Confirm all this week*, and print one day or the whole week with scaled recipe sheets.
- Counts come from the venue's menu cycle and schedule for the next 14 days.

**Standard associate menu** (Back Office → Associate Meals, Associate Phone, Manager)
- Every community gets the same menu:
  - **one chef special per meal period** (lunch and dinner);
  - the **standing choices**.
- The special:
  - is taken from that day's menu cycle;
  - by default is the cycle's first entrée;
  - can be changed by the chef, who can pick another entrée special or none and set how many are available.
- Overnight (NOC) meals get the dinner special.
- Standing choices: entrée salad, sandwich of the month, soup of the week, and the soup & salad combo.
  - The list is fixed.
  - The chef chooses which Recipe Book recipe sits behind each choice.
- Each menu item links to its recipes and shows their allergens on the phone.
- The Associate Phone, the Manager tablet and Back Office read one shared menu, so the three always agree. Before, Manager had its own copy.

**Meal Credits** (HO Settings → Meal Credits)
- How many starters, entrées, sides and desserts one meal credit covers.
- Whether extra sides are charged à la carte.
- What happens to items over the limit: use another credit, or charge à la carte.
- Whether residents may spend credits on guests. This is on by default only at The Fountains.
- The server's check and the Close & Charge screen use these rules, and the diner card describes them in words.

**Release Phases** (HO Settings → Release Phases)
- Mark any Back Office page as **Phase 1** or **Phase 2**. Every page starts in Phase 1.
- In the side menu, Phase 2 pages carry a *Phase 2* tag, and each one opens with a banner saying it is planned for a later release. Search results show the tag too.
- A switch at the bottom of the side menu shows *All pages* or *Phase 1 only*. Phase 1 only hides the Phase 2 pages, but search still finds them.
- *Copy as a list* copies the split, section by section, to paste into an email or a ticket.
- The split is saved in the browser and kept through *Reset demo data*. To make one split the default on every device, set `phase: 2` on those pages in `src/surfaces/backoffice/nav.ts`.

**Venue Settings, easier to use** (Venues → Venue Settings)
- Before, this was one long page of about 2,500px: a serving-now table, the payment terminals, then a stacked card per venue with its printers and every kitchen screen.
- Now there is a list of venues on the left and the chosen venue on the right, with four tabs: **Menu**, **Printers & terminals**, **Kitchen screens** and **Name & kitchen**.
- A **needs attention** list at the top collects every problem across venues: no menu, no start date, a printer that can't be reached, an offline card terminal. Each has a **Fix** link that opens the right venue on the right tab. The list and the tabs show a count of the problems in each venue.
- **Menu** tab: what the venue serves today and its week in the cycle, *Change menu*, and *Up next*, where you schedule the next menu (by default the coming Monday) or cancel one.
- **New venue** asks for a name and a kitchen, then opens the new venue's Menu tab.
- **Name & kitchen**:
  - The venue's name is now a labelled field. Before, it was an unlabelled heading you could edit by accident.
  - You can now choose which kitchen a venue cooks in. Before, you couldn't, so a new venue never had a kitchen.
  - Retiring a venue now asks you to confirm first. Retired venues are listed under *Retired venues*, with **Bring back**.
- Card terminals are shown with the venue they belong to.
- Each venue and tab has its own address, for example `#/backoffice/venues/v3/devices`.

**Menu builder, clearer and safer** (Menus & Recipes → Menu Cycle & À la Carte)
- **Locking now works.** Before, a locked menu could still be edited in the builder. A locked menu now opens read-only, with a banner and **Unlock to make changes**. If the menu was approved, unlocking warns that changes need approving again. Unlocked menus have a **Lock** button.
- **Menu list**, down from 8 columns to 4: *Menu*, *Dietitian approval*, *Last edited*, and the actions.
  - *Dietitian approval* reads plainly: **Approved** with who signed and when, **Waiting for the dietitian**, or a **Send for approval** link. Before, there was a "Yes/No" shield button and a separate status column.
  - Each row has one main button, **Edit**, or **View** when the menu is locked. Print, Lock and Unlock, *Copy into a quarter* and Archive are in the ⋮ menu.
  - The copy icon that instantly copied a menu into the current quarter, with no confirmation, has been removed.
- **Cycle builder:**
  - **Weeks** are a row of buttons with their dates, and *Now* marks the current week. Before, they were a dropdown with arrows.
  - **Each date has its own menu** with *Copy this day to other days*, *Clear this day*, and *Change the dates shown*. Before, clicking a date quietly moved every date in the cycle.
  - **Copy a day** now has you tick the days on a calendar, with dates and how many dishes are already there. A one-click option picks *Every Thursday in the cycle*. Before, you had to type day numbers such as "7, 8, 9", which the grid never showed.
  - **Add more** under each day replaces "Options". It offers *Another entrée*, *Another soup or starter*, *A side on its own*, *Another dessert*, *A drink*, and *Clear lunch on this day*. "+ All week" is now **+ Same dish all week**.
  - The colour key and a one-line how-to sit above the grid instead of below it.
  - Days with nothing on them are listed by date, not day number. A brand-new menu shows how to start instead of "28 days have nothing on them".
  - The duplicate quarter badge next to the quarter picker is gone.
- **À la carte builder:** the filter is labelled *Show*, with a line explaining that the Breakfast, Lunch and Dinner buttons on each dish set when it is offered. Each section's button says what it adds, for example *Add desserts*. Locking works here too.

### Less text in Back Office; Dining Service is now POS Settings
- **No preamble under page titles.** The explanatory line under each Back Office page title is gone (Venue Settings, Service Flow, Order History and the rest), because the title says what the page is. The resident detail line (apartment, level, spouse) stays, because it's data.
- **Dining Service is now POS Settings** in the Back Office menu.
- **Status icons on the order screen.** Each line shows its state as a small coloured icon instead of a word: a blue dot for new, a send arrow for sent, a red chef's hat for cooking, a green tick for ready and a grey tick for served. Held lines show a pause icon and the minutes held. Drinks show a glass that changes colour, and the ones to fetch are outlined buttons. Each icon still has its name as a tooltip and for screen readers.
- **Alcohol count per resident.** On the check, a resident who has had alcohol this meal shows a small wine chip, such as "2 this dinner". It counts wine, beer, spirits and cocktails on every check that meal, open or closed. NA wines and beers don't count, and neither do a guest's drinks. It starts again at the next meal.
- **Order from the table map.** On the server tablet's *Table map* view, free tables read "+ New check"; tapping one opens a check there and goes straight to the order. Occupied tables still open their check.
- **Pick up & delivery by what to do next.** The queue is grouped as *Hand off now*, *Take out for delivery*, *On the way*, *In the kitchen*, *Not sent yet* and *Later* (collapsed). Late orders go to the top of their group with a red "Late · 3m" tag, replacing the time-window list, the NOW line and the count pills.
- **Snacks is its own row.** In the cycle builder, Snacks shows a single *Snack* row instead of the soup, entrée, sides and dessert rows. Any recipe can be a snack, and a cookie stays under Snack instead of moving to Dessert. *Add more* offers *Another snack*.
- **Alerts & Timing by the moments of a meal.** One card per moment, in service order: Waiting to order, Cooking, Plates up, Eating and Ready to close, with a step strip at the top. Each card has a row per screen the alert shows on: *My Tables & manager floor*, *Cook & Expo screens* and *Check timeline*. Each row reads as a sentence, such as "Turns red after 5 min", and a blank box means off. With printers, the kitchen rows say *Not used with printers*. The settings and Reset are unchanged.
- **Shift Metrics in one sentence.** The rule reads "A shift is great when [3] of 7 measures beat the last 7 shifts by at least [8]% and none falls behind", with the numbers editable in place.
  - **Measures:** a simple list of each one's name, whether higher or lower is better, its last-7 average and a *Counts* switch.
  - **Your own goal:** sits behind *Use my own goal*.
  - **Table time:** its "shorter is better" switch sits in its own row.
- **My Tables without lane hints.** "in the kitchen", "plates are up at the pass", "check in, then dessert" and the other hints under the lane names are gone.
- **Easier floor plan editor** (Venue Settings → Floor plan).
  - **Reshape on the plan:** drag the handles around the selected table or wall. A size tag shows while you drag, and the Width / Height steppers are gone.
  - **Copy:** *Duplicate*, or Ctrl/⌘ D, C and V. A copy lands beside the original with the next free table name.
  - **Several at once:** Shift-click to pick several, then move, copy or remove them together, line them up (left, centre, right, top, middle, bottom) or *Space across / down*.
  - **Turn:** swaps width and height.
  - **Undo and Redo:** buttons plus Ctrl/⌘ Z and Shift Z, covering every change until you save. Delete removes, Esc deselects and Ctrl/⌘ A picks everything.
  - **Bigger plan:** inside Venue Settings the plan uses the full width and the controls sit under it.
- **Copy or swap a meal.** Each day's meal in the cycle builder has a ⋯ next to *Add more* with *Copy this lunch to…*, *Swap with…* and *Clear this lunch*.
  - **Any meal to any meal:** pick the target meal (Breakfast, Lunch or Dinner) and the day or days, so Monday lunch can go onto Wednesday dinner, or swap with Monday dinner.
  - **Copy:** replaces what's there or adds to it, and warns before replacing.
  - **What comes along:** sides stay with their entrée and keep their choices. Both copy and swap have Undo.
  - **Day header:** the whole-day Copy and Swap are gone, leaving *Clear this day* and *Change the dates shown*.
  - **Locked menus:** the active menu is signed by the dietitian, so these only show once it's unlocked.
- **Dashboard card titles stand out.** *Resident meal sentiment*, *Steps of Service*, *Revenue*, *P-Mix* and *Resident feedback* are larger and darker instead of small grey capitals.
- **Simpler pick up ranges.** *Ranges offered* (Pick Up & Delivery) shows one order type at a time, and each meal is one line: on or off, the times in words ("7:30 – 9:30 AM · 8 ranges"), and From / Until. *Fine-tune* opens that meal's quarter hours for gaps, *Back to meal hours* resets an order type, and every change has Undo. The NOC shift sits under Associate pick up.
- **P-Mix wheel.** The dashboard's P-Mix card is a small wheel of today's plates by category (Starters, Entrées, Desserts), with the total in the middle and the Breakfast / Lunch / Dinner filter above. Tap a category to see its top dishes and their share; *All categories* goes back.
- **Real-time clock.** The app runs on the device's real time instead of a demo clock pinned to 5:45 PM. To show a particular service, open the app with `?clock=18:15` (every tab follows it that day); `?clock=real` goes back.
- **Coursing in kitchen terms.** The coursing options are now *Fire all*, *Fire on drop* (the default), *Auto-fire +5*, *Auto-fire +8* and *Manual fire*. A one-line key sits under Coursing on Service Flow, and the check's pacing log uses the same words. How each option works is unchanged.
- **Menu builder without repeated hints.** Instruction paragraphs, lines that restate a title or tab, per-row hints and duplicate tooltips are gone from the menus list, cycle builder, à la carte builder and their dialogs. The same goes for the Recipe Book, Modifiers, Menu Export and Pricing pages. Warnings, empty states and the menu-standard tooltip stay.
- **Calmer dashboard.**
  - *Needs your attention* is one line per item: the action and a link to where it's handled. Tap the header to collapse it.
  - *P-Mix · served today* opens with one line and the share bar.
  - *Resident feedback* opens with just the highlight.
  - Each has *Show details* for the rest, and the dashboard remembers what you opened or collapsed.

### Menu builder: copy or swap days, à la carte item counter; phase switches in the demo box
- **Copy or swap a day** (since replaced by copy or swap a meal, above). Each day's menu in the cycle builder has *Copy this day to…* and *Swap with…*.
  - **Copy:** pick all meals or one meal, then whether to replace what's on the target days or add to it, then one or more days from the week grid.
  - **Warning:** when dishes will be replaced, the dialog says which days and how many dishes.
  - **Swap:** two days trade places across every meal, sides included.
  - **Undo:** both show a toast with Undo.
  - **What's kept:** sides stay linked to their entrée, and side choices come with them. Any Day and locked menus are never touched.
- **À la carte item counter.** À la carte menus show "Menu items N / 20 · Sides N / 8" next to Lock. It turns amber at a limit and red over it, with a warning that doesn't block saving.
  - **What counts:** beverages and upcharges (add-ons) don't count, and sides count toward the 20.
  - **Changing the limits:** they are in `MENU_STANDARDS` (`menus/model/alcStandards.ts`).
- **Phase switches in the demo box.** The Demo box at the top of the screen menu now has the Phase 2 and Phase 3 switches too.

### Printers by category or recipe, drinks split, P-Mix by meal
- **Printers by group, category or recipe.** In *Only some items* mode, each printer can take:
  - whole groups;
  - Recipe Book categories (Soup, Sandwiches, Entrée Salad, Wine and so on);
  - single recipes (the burger to the grill).

  To add a category or recipe, type in *Add a category or recipe* under the printer. The most specific setting wins: a recipe or category picked for one printer prints there instead of at the printer that takes its whole group. Whole-ticket printers still print everything. The demo sends entrée salads to Cold / Pantry.
- **Drinks split into Beverages and Alcohol.** Wine, beer, spirits and cocktails are Alcohol, and every other drink is a Beverage, so the bar printer can take alcohol only. A printer saved with the old Drinks group takes both.
- **P-Mix today by meal.** The dashboard's P-Mix card has an All · Breakfast · Lunch · Dinner filter with a plate count for each meal. A meal with nothing served yet can't be picked.

### Phases switched on or off for the whole system
- **Side work follows its phase.** The side work chip on My tables and the side work reminder at sign-off only show while the phase of *Side Work Tasks* / *Assign Side Work* is switched on.
- **Phase 2 and Phase 3 switches.** They are at the bottom of the Back Office side menu and on *Release Phases* (HO Settings). Phase 1 is always on. Turning Phase 2 off also turns Phase 3 off, and turning Phase 3 on also turns Phase 2 on. The switches are saved and survive a demo reset. They replace the old *All pages / Phase 1 only* view.
- **What a phase that is off does everywhere:**
  - its screens leave the screen menu, and opening one shows "part of Phase N" with a link to Release Phases;
  - its Back Office pages leave the side menu and search, and opening one shows "Phase N is switched off" with a button to switch it on;
  - while the kitchen screens' phase (Cook, Phase 2 by default) is off, every kitchen runs on printers and the *Kitchen screens* choice is locked.

### Printer routing, Kiosk section, simpler pick up & delivery, P-Mix today
- **What each printer prints.** In printer mode, each kitchen printer prints either the whole ticket or only some groups: Drinks, Starters, Entrées, Sides or Desserts. The demo sets the Hot Line to entrées and sides, Cold / Pantry to starters and desserts, and the Expo Receipt to the whole ticket. The setting is under *How orders reach the kitchen*. A warning shows when a kitchen has a group no printer prints.
- **Send names the printers.** After Send, the check says where the tickets printed, for example "Printed at Hot Line (2 items) · Expo Receipt (whole ticket)". It warns when a printer can't be reached.
- **Kiosk** has its own Back Office section (*Kiosk Settings*). It was a page under Dining Service.
- **Billing Setup is now Meal Plans.** Its first tab is *Plan types*.
- **Venue name on tablets.** The coloured venue chip now shows the venue's name ("Sequoia", or "Sequoia / Evergreen" on wide screens) instead of a two-letter code.
- **Pick up & delivery, simplified.** The seven count tiles are replaced by pills for late, ready and out for delivery orders, shown only when the count is above zero. Each row now shows who, pick up or the apartment, the items, one status, one time and one button. The icons, avatars, progress bars and status sub-lines are gone (details show on hover), and Completed today is one summary line.
- **Dashboard P-Mix today.** The specials made and ordered card is replaced by a small P-Mix of what was served today. It shows the top dishes with their count and share, an *Everything else* row and a link to the full P-Mix.

### Printers or kitchen screens, My Tables pick up & delivery, associate menu lock
- **Printers or kitchen screens (KDS).** A new setting, *How orders reach the kitchen*, is at the top of *KDS Settings* and on the *Courses* tab of *Service Flow*. The demo still starts on Kitchen screens.
- **Printer mode** sends the whole ticket when the server taps Send: every course goes at once and nothing is held or fired later. There are no kitchen statuses:
  - order lines just say *Sent*;
  - My Tables shows one *Open checks* lane, oldest first, with no cooking, ready or late colours. The only actions are Trivia and closing the check;
  - the Manager floor reads "Sent X min ago, check still open";
  - Cook and Expo say the venue uses printers.
- **My tables button swaps views.** The *My tables* button shows one of three views and opens a small menu to swap between them: *My tables* (your table board), *P/U & delivery* (the same queue as the PU & Delivery screen, with New pick up and New delivery) and *Table map* (every table in its status colour with a timer, as the Manager sees it). The tablet remembers the view, even after a reload or a demo reset. Tapping the button from another screen goes back to the view it was left on.
- **Associate meals locked to the associate menu.** When an associate meal is ordered on the tablet, only today's chef's special and the standing choices from *Associate Menu* can be picked. There is no search, no tabs and no price. Recipes on the associate menu that are not on the tablet menu (such as *Turkey Club*) are added so they can be ordered and reach the kitchen.

### Steps of Service: average table time first

- **Back Office dashboard, Steps of Service card:**
  - Average table time (order to entrée) is now the big number, green under the goal and red over it.
  - A small chip beside it shows the trend, for example *▼ 1.2 min faster vs the 7 days before*.
  - Before, the card led with a large "Faster" or "Slower" heading.
- **Manager tablet, Metrics:**
  - A new top panel shows this meal's average table time large, with a small trend chip against the last seven of the same meal.
  - The missed-step, order → appetizer and appetizer → entrée cards follow below it.

### Phase 3, typing recipes into the menu builder, and removable rows

- **Phase 3.** Release Phases now offers Phase 1, 2 or 3 for every screen and Back Office page.
  - Phase 3 items are brown and listed after Phase 2 (purple), in the screen menu and the side menu.
  - A section takes its earliest page's phase, so an all-Phase 3 section drops to the very bottom under a *Phase 3* heading.
  - Phase 3 pages get a brown banner. *Phase 1 only* hides Phase 2 and Phase 3. *Copy as a list* lists all three.
- **Type a recipe straight into the menu builder.** Clicking a **+** slot turns it into a search box in place, instead of opening a pop-up. Matching recipes from the Recipe Book appear as you type.
  - Arrow keys and Enter, or a click, place the dish. Escape puts the slot back.
  - A dish that isn't in the Recipe Book yet can be drafted with *Create "…" with AI Assist*.
  - The same box is used for **+ Same dish all week**, each day's **Add more**, and each section's **Add** button in the à la carte builder. In the à la carte builder, the box stays open for the next dish.
- **Remove a default row from a meal.** Soup or starter, Entrée and Dessert always showed an empty row on every meal. An empty one now has an **×** by its name that takes it off that meal for this menu, for example no soup at breakfast. A **+ Soup or starter row** button next to the meal name brings it back. A row with dishes in it can't be removed.

### New check: pick up, delivery or an associate meal from the table map

- When a server starts a new check, the table map now has **Not at a table?** buttons above it: **Pick up**, **Delivery** and **Associate meal**. Each opens a new order on the server's own name, straight on the order screen.
- **Associate meal** opens the Add diner panel on the associate list. The first associate added names the order, and it shows as *Associate Meal* on the pick up screen and the kitchen screens.
- Leaving one of these with nothing ordered removes the empty order, the same as on the PU & Delivery screen.

### Kitchen screens: no undo pop-ups, a clock, and time in

- **Cook and Expo no longer show an Undo message after a bump.** A cleared ticket stays cleared. If one goes by mistake, bring it back with **RECALL** (or the M key on the bump bar).
- **Cook** has the same clock in its header as Expo.
- **Table tickets show when the order first went in**, for example *5:30 PM*, on its own line under the table number on Cook and Expo. Pick up and delivery tickets keep their pick up window instead.
- **Reset demo data** and **Clear all tickets** moved from the tablets' account menu to the top of the screen menu (top right), so they are on every screen, including the kitchen screens, kiosk and Back Office. Each one still asks first.

### Phasing: printers first, KDS later

- **KDS has its own section.** The kitchen screens and the expo screen setting moved out of Venue Settings into **KDS → KDS Settings**, with one tab per kitchen. Venue Settings keeps what a printers-only kitchen needs. Its *Kitchen routing* tab still decides what goes to the kitchen at all, whether that ends up on a printer or a screen.
- **The screens can be phased too.** HO Settings → Release Phases now lists every screen in the top-right screen menu as well as every Back Office page. **Cook** and **Expo** (the kitchen displays) and **KDS Settings** start in Phase 2; everything else starts in Phase 1.
- **Phase 2 looks different and comes last:**
  - Phase 2 items are purple and always listed after the Phase 1 items.
  - In the screen menu, Phase 2 screens sit under a *Phase 2* divider.
  - In the Back Office side menu, Phase 2 pages come after the Phase 1 pages of their section. A section that is all Phase 2 moves below every Phase 1 section, under a *Phase 2* divider.
  - A Phase 2 page has a purple banner at the top.
- **Phase 1 only** (the switch at the bottom of the side menu) now also hides Phase 2 screens from the screen menu. *Copy as a list* includes the screens.

### Back Office: fewer pages, from Venues down

From Venues down, the Back Office menu had 22 pages. Related settings sat far apart: delivery fees were under Billing while pick up times were under Dining Service, and a venue's prices, floor plan and kitchen routing were three separate pages. Pages that belong together are now tabs of one page. The menu from Venues down is 14 pages, 10 of them outside HO Settings:

| Menu | Page | Its tabs | Was |
| --- | --- | --- | --- |
| Venues | **Venue Settings** | per venue: Menu · Prices · Floor plan · Kitchen (screens and what skips the cook line) · Printers & terminals · Details | Venue Settings, Pricing, Floor Plans, Kitchen Routing |
| Dining Service | Service Flow | (unchanged) | |
| | **Pick Up & Delivery** | Pick up times · Delivery fees & sick waivers | Pick Up Windows, most of Delivery Options |
| | **Messages** | Texts to residents · Broadcasts to staff | Text Messages, Broadcasts |
| | **Kiosk** | (unchanged) | Featured on Kiosk |
| Residents | **Residents** | Profiles · Allergies & diets · Trivia scoreboard | Resident Profiles, Allergies & Diets, Trivia Scoreboard |
| Billing | Charge Approval, Order History | (unchanged) | |
| | **Meal Plans** (was Billing Setup) | Meal plans · Meal counts · Corkage | Meal Plans, Meal Counts, corkage from Delivery Options |
| Associates & PINs, HO Settings | | (unchanged) | |

- **Old links still work.** Bookmarks and links inside the app open the tab the page became; for example `#/backoffice/pricing` opens the first venue's Prices tab. Search still finds the old names: typing "pricing" or "floor plan" goes to the right tab.
- **Each tab has its own address**, for example `#/backoffice/svcWin/fees`.
- **In Venue Settings**, the venue is already chosen, so the old venue and kitchen pickers are gone from Prices, Floor plan and Kitchen. When two venues share a room, the floor plan says so.
- **One title per page.** A tab drops the old page's title and keeps its one-line description and buttons.

### Usability pass on every other screen

Each screen was checked at tablet and desktop sizes, or phone size for the Associate Phone. Bugs (things that didn't work) were fixed first, then confusing controls and layout. The general rules applied everywhere:
- **Mistakes can be undone:** destructive or one-tap actions have a confirm or an **Undo**.
- **Each row has one main action**, with the rest in a ⋮ menu.
- **Status is plain text**, and labels are written in words.

**Bugs fixed**
- **Server tablet:**
  - A guest's dishes were flagged with the host resident's allergies.
  - The ⋯ menu on a diner closed as soon as it opened.
  - Removing a diner deleted items that had already been sent, with no confirm.
  - Quick close had no undo.
  - Card splits (50/50, 60/40, 70/30) could be a cent off.
  - Corkage was silently dropped when seat 1 was empty. It now shows a warning.
- **Cook / Expo:**
  - Recall listed tickets that couldn't be brought back.
  - The M key did nothing on Expo.
  - **Production Prep:** a stray tap unticked a finished prep item and lost who did it.
- **Host:** walk-in visitors couldn't be seated.
- **Manager:** an associate meal could be saved with no meal.
- **Bar:** mis-taps had no undo.
- **PU & Delivery:**
  - Every stage moved in one tap with no undo.
  - Backing out of a new order left an empty order behind.
- **Associate Phone:** a meal could be cancelled after the kitchen had started it.
- **Back Office:**
  - *Charge Approval:* approved charges could never be sent to billing.
  - *Pricing:* clearing a price box snapped back, so "5" became "85".
  - *Floor Plans:* two tables could share a name, or have none.
  - *Text Messages:* the preview filled details the real text can't, such as {apt}.
  - *Resident Profiles:* switching resident dropped unsaved story edits.
  - *Dining Plans:* the list showed out-of-date care levels and allergies.
  - *Modifiers:* "Copy from another community" copied nothing.
  - *Recipe Book:* recipes could be added from the Global Library twice.
  - *Dashboard:* the "Schedule a menu" link went to the wrong page.
  - *Assign Side Work:* Clear had no undo.

**Bigger changes by screen**
- **Server tablet:**
  - A banner when you're looking at another server's tables.
  - A confirm before starting a second check at another server's table.
  - Close & Charge's payment panel no longer pushes the page into a long scroll.
  - Shift review says what is blocking sign-off.
- **Cook:**
  - An **All day** strip of what this screen still has to make.
- **Expo:**
  - One Fire button per ticket.
  - Refire and print are in a labelled ⋮ menu.
  - Ready tickets are grouped.
  - The prompt stays after a text is sent.
  - Associate meals show the person's name.
- **Production Prep:** done items need a separate Undo to untick, and progress counts include the specials.
- **Manager:**
  - The *Shift review* tab is now *Closing report*, so it no longer shares a name with the server's screen.
  - Open tables blocking sign-off can be tapped.
  - The 86 list has Undo.
  - The associate meal form says what is missing.
- **Host:**
  - Reservations keep Seat now and Edit on the row; no-show and cancel are in a ⋮ menu.
  - The held-table colours have a key.
- **PU & Delivery:** New pick up and New delivery buttons, and a "not sent yet" tile.
- **Resident Kiosk:**
  - The review lists one answer per line, and tapping a line edits it.
  - "Is this you?" has a "No, that's not me" button.
  - Text is larger on landscape tablets.
- **Specials Display:** each dish stays 8 seconds, with larger descriptions.
- **Associate Phone:**
  - Planned meals can be changed, not just cancelled.
  - The Plan button stays on screen with a summary.
- **Back Office:**
  - *Charge Approval:* Approve, Bring back and Send to billing, with plain statuses and item names.
  - *Text Messages* and *Service Flow:* split into tabs, and every Reset asks first.
  - *Kitchen Routing:* a *Whole menu* view, and moving an item has Undo.
  - *Floor Plans:* unsaved-changes status and Undo.
  - *Menu Export:* print tomorrow's menu or next week's.
  - *Modifiers:* copying from another community shows what will be added.
  - *Associate Meals:* plain week status, and pick up times shown as spans.
  - *Retired rows* on the billing lists can be brought back.

**Found but not fixed yet** (each needs a change to shared logic, so it was left for a decision)
- **Settings saved but never used:** *Meal Plans*, *Meal Counts*, the *Delivery Options* fee list and *Shift Metrics* are stored but not read by the floor. Each page now carries a warning saying so.
- **Seat 1 charges:** corkage and the delivery fee are tied to seat 1, so they are lost if that resident leaves early or is comped.
- **Floor Plans:** unsaved changes are lost when you move to another Back Office page. Only closing the browser tab is caught.
- **Undo only on the screen you used:** Cook's and Expo's recall lists only see bumps made in their own browser tab.

### Wiring fixed (settings that did nothing in the mockup)
- **Guest meal credit**: the toggle was saved in Back Office, but the floor never read it. The checkout now reads it.
- **Apartment charges**: charges put on an apartment from the floor never reached *Charge Approval*. They now do, and Charge Approval looks up the resident's name.
- **Venue menu schedules**: the menu pages, the dashboard and the live menu each read their own copy of the seed schedules. They now all read Venue Settings, and a menu built in Menu Cycle can be scheduled there.
- **Expo per kitchen**: servers now see whether a kitchen runs Expo, as set in Venue Settings.
- **Chef's "Don't forget" reminders** from the Recipe Book now reach the server's table card and the Expo ticket.
- **PIN resets** made in Associates & PINs now work at sign-in.
- **Reset demo data** now clears every store, not just orders. Device settings such as text size are kept.
- **Associate meals**: menu items were renamed to match their Recipe Book recipes, for example *Reuben Sandwich*, *Turkey Club* and *Cheeseburger Soup*.
- **Back Office residents** now match the residents on the tablets (names and apartments).

### UI fixes
- The kit's animations never played (sheets, toasts, pulses). They now do.
- Text fields showed a double focus ring. Fixed.
- Touch targets are now at least 40px. This includes the host and associate buttons and the table card, which is now a real button.
- Layouts were checked at 1024, 1280 and 1920 wide, with no horizontal scroll and no console errors on any surface or Back Office page.

### End to end, verified
- A check goes from server → cook → expo → close → Back Office *Order History* and *Charge Approval*.
- An 86 from the Manager tablet appears on the Specials Display.
- Reset and clear work across open tabs.

---

## Still simulated

These look real in the demo but need a backend before going live:

- **Storage.** All data is in the browser. It syncs between tabs on one device, not between devices. Replace the persistence in `src/store` and the seed data in `src/data` with the KiscoConnect API.
- **Sign-in.** PINs are checked in the browser against demo associates.
- **Texts and broadcasts** go to an outbox in the app and are never sent.
- **Payments and charges** are recorded, not posted to billing.
- **AI Autofill and AI menu review** return canned results.
- **Sales history, sentiment and P-Mix** come from seed data.
- **Production counts** use a repeatable formula, not real forecasts.

## Where to look in the code

| If you're looking for... | Look in |
| --- | --- |
| A screen for one device | `src/surfaces/<mode>/` |
| A Back Office page | `src/surfaces/backoffice/pages/<id>.tsx`, registered in `backoffice/nav.ts` |
| Business rules (courses, routing, billing, meal credits, associate menu) | `src/domain/` |
| Shared state and settings | `src/store/` (`config.ts` for dining rules, `serviceConfig.ts` for alerts and display) |
| Seed data from the mockup | `src/data/seed/` |
| Tests | `__tests__` folders beside the code; `e2e/` for cross-surface flows |

For the full history, see the git log on this branch. Each commit is one change.
