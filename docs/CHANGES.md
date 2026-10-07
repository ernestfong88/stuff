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
  - Bumps and "Run course" had no undo.
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
  - Every bump shows "SQ 1 bumped · Undo".
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
