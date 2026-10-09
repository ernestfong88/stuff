# KiscoConnect Dining: handoff to IT

This note is for the team taking over the app. It covers what the app is, how to run it, what's real and what's simulated, and what's left to build before it can go live.

**Product owner:** Ernest Fong, Culinary Director. _(IT contact: fill in.)_

## What it is

KiscoConnect Dining is a working front-end prototype of the whole dining program for a Kisco community. It has 12 screens sharing one order book: server tablets, manager, host stand, bar, pick up and delivery, cook line, expo, production prep, associate meals, resident kiosk, specials TV, and the culinary Back Office.

The culinary team designed and tested every flow in it against a live-looking dinner service. The ordering, kitchen and menu logic is complete and covered by tests. What it doesn't have yet is a server: everything runs in the browser (see [Real vs simulated](#real-vs-simulated)).

## Start in 5 minutes

You need Node 22 or later.

```bash
npm install
npm run dev
```

1. Open http://localhost:5173. The [README](../README.md) lists each screen's address, for example `#/server`, `#/cook` and `#/backoffice`.
2. Open two screens in two tabs of the same browser, for example `#/server` and `#/cook`, to watch an order go from the tablet to the kitchen.
3. Sign in with a demo PIN: Adriana `2468`, Ricardo `1357` or Maria `1122`.

Two controls are useful while testing:
- **Demo clock:** the app runs on the device's real time, and the demo checks are timed around it. Add `?clock=17:45` before the `#` to pin another time today, or `?clock=real` to go back to the device clock.
- **Reset:** the screen menu at the top right of every screen has *Reset demo data*.

## Real vs simulated

| Area | Status | Notes |
| --- | --- | --- |
| Ordering, seating, coursing, firing, kitchen routing, expo, 86 list, pick up and delivery, kiosk | **Real logic** | This is how the program should behave. It is covered by unit and end-to-end tests. |
| Menus: cycle, à la carte, venues, prices, modifiers, allergens and diets | **Real logic** | The Back Office drives every screen live. |
| Back Office settings, reports and logs: production, cleaning and temperature logs, closing reports | **Real logic** | |
| Storage and sync | **Simulated** | Data is saved in the browser (localStorage) and shared only between tabs of the same browser (BroadcastChannel). Two different tablets don't see each other's data. |
| Sign-in, roles and Home Office access | **Demo only** | PINs and the role switch are for show. There is no authentication or authorization. |
| Printers, card terminals (Square), text messages, ADP and billing exports | **Simulated** | The screens and settings exist, but nothing is sent to a real device or service. |
| Residents, staff, menus, recipes and order history | **Fictional seed data** | It lives in `src/data/seed/` and `src/surfaces/backoffice/**/seed/`. |
| Dish and resident photos | **Not included** | Placeholders are shown. See the README for where photos go. |

## How the code is organized

The layers are **domain → store → surfaces**. [docs/ARCHITECTURE.md](ARCHITECTURE.md) covers the stack, the folders and the conventions.

| Folder | What's in it |
| --- | --- |
| `src/domain/` | Pure rules: orders, courses, routing, billing, allergens, pick up windows, meal periods. Most of the tests are here. |
| `src/store/` | State and persistence. Screens read and write only through these modules. |
| `src/surfaces/` | One folder per screen. `src/surfaces/registry.ts` lists them. |
| `src/ui/`, `src/shell/` | The shared component kit, and the tablet shell, router and session. |
| `src/data/` | Seed data and the menu overlay that turns Back Office menus into what each venue serves today. |

**Where a backend plugs in.** Storage is concentrated in a few files:
- `src/store/diningEngine.ts`: the order book.
- `src/lib/sharedStore.ts`: every other shared setting and log.
- `src/lib/writeBehind.ts`: batched saving.

Replace the localStorage and BroadcastChannel calls in those files with API calls and a live channel (for example WebSockets), and swap the seed data in `src/data/` for API data. Components don't touch storage directly, so most screens shouldn't need to change.

## Build and host

| Command | Output |
| --- | --- |
| `npm run build` | A static site in `dist/`. It uses hash routing and relative paths, so it runs on any static web server (IIS, Azure Static Web Apps, S3, nginx) with no server-side code. |
| `npm run build:single` | One self-contained `dist-single/index.html`, useful for demos you open straight from a file. |
| `npm run preview` | Serves the `dist/` build locally on port 4173. |

**Fonts:** fonts load from Google Fonts. For tablets on a closed network, self-host them. The CSS also uses weights 800 and 900, which aren't currently loaded, so the browser imitates them.

## Checks

| Command | What it checks |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npm run lint` | oxlint |
| `npm test` | 809 unit tests (vitest) |
| `npm run e2e` | 15 end-to-end flows across screens (Playwright; it starts its own server) |

All of them pass at handoff.

## What's needed to go live

1. **API and database** for orders, residents, menus, settings and logs, with history and backups.
2. **Real sign-in and roles**, for example SSO or ADP for associates. Back Office roles need enforcing, including Home Office-only settings.
3. **Sync across devices**, so every tablet, kitchen screen and the Back Office share one live order book.
4. **Integrations:** kitchen printers, card terminals (Square), text messages to residents, ADP, and the resident billing export.
5. **Hosting and devices:** the internal URL, tablet setup (home-screen app, kiosk mode), and screen-to-venue assignment.
6. **Audit and privacy:** resident data, allergies and diets are sensitive. Plan access controls and an audit log.
7. **Accessibility and load testing** on the real tablets.

## Known gaps and open decisions

Most of these are listed under "Not fixed" in [docs/AUDIT.md](AUDIT.md):
- **Menus:** the Bistro bar's food menu isn't linked to the Recipe Book yet.
- **Steps of Service:** the "Time to greet → Don't count under" setting has no live data source yet.
- **Pick up and delivery:** orders can be booked for today or tomorrow only. There's no "days ahead" setting yet.
- **Closing Reports** (Back Office) count one meal at a time. The manager tablet's closing report counts the whole day.
- **Recipe approval:** Home Office approves recipes. Dietitian approval of menus was removed for now.
- **Formatting:** about a quarter of the files don't match the Prettier style (`--print-width 150 --single-quote`). There's no Prettier config in the repo yet. A one-off formatting commit would fix it.

## Where the history is

- [docs/CHANGES.md](CHANGES.md) lists every change in plain words, newest first.
- [docs/AUDIT.md](AUDIT.md) is the pre-ship audit and what was fixed.
- [`reference/`](../reference/) holds IT's original mockup and the culinary team's edited version.
- The git history explains each change in its commit message.
