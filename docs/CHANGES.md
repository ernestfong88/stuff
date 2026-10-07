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
