# KiscoConnect Dining: architecture

KiscoConnect Dining runs the dining program of a senior living community. The
app has twelve surfaces, and each physical device runs one of them:

| Mode | Device | What it does |
| --- | --- | --- |
| Server | tablet | My tables board, taking orders, checks and payment, menu, residents, shift review |
| Manager | tablet | Triage, floor, metrics, shift review, associate meals, 86 list |
| Host | tablet | Floor and seating, reservations |
| Bar | tablet | Drinks sent to the bar |
| PU & Delivery | tablet | Pick up and delivery queue |
| Cook | kitchen screen | Kitchen display (KDS) with bump bar |
| Expo | kitchen screen | Course pacing at the pass |
| Production Prep | kitchen tablet | Production plan, prep checklists |
| Associate Phone | phone | Associates plan the meals for their shifts |
| Resident Kiosk | kiosk | Residents order pick up or delivery |
| Specials Display | dining room TV | Tonight's specials |
| Back Office | desktop | Culinary back office: dashboard, menus, billing, residents ... |

The mockups (IT's original and the edited one) are kept in `reference/` for
comparison. [CHANGES.md](CHANGES.md) lists what changed between them and this app.

## Stack

Vite, React 19 and TypeScript (strict), plus CSS Modules and `lucide-react` icons.
There is no backend yet. All state lives in the browser and syncs between tabs.

```
npm install
npm run dev        # http://localhost:5173/#/server
npm run build      # typecheck + production build into dist/
npm test           # vitest
```

## Layout

```
src/
  main.tsx, App.tsx      boot, providers, routing to the current surface
  app/Providers.tsx      app-wide providers (dining store, session bridge, demo tools)
  data/                  seed data (from the mockup) + typed lookups; photos;
                         the live menu overlay from back office edits
  domain/                pure business logic: types, courses, routing, billing,
                         table stage, KDS screens, pick up windows and texts
                         (pickupService/), associate meals (assocMeals/), metrics/
  store/                 shared state: the dining store (orders, history,
                         associate meals) and cross-surface stores: dining
                         config, service settings, venue settings, menu edits,
                         associate menu, recipes, 86 list, notices, notes,
                         resident stories and prefs,
                         side work, trivia, production plan, floor layout,
                         text outbox, PINs
  lib/                   clock, storage, sharedStore, format, id
  theme/, styles/        design tokens (TS + CSS variables), global CSS
  ui/                    reusable UI kit (import from '../ui')
  shell/                 modes, hash router, session (staff, venue), tablet
                         shell, controls (text size, mode, venue, account),
                         sign-in, touch lock, staff corner
  surfaces/<mode>/       one folder per surface; index.tsx default-exports it
  surfaces/kitchen/      pieces Cook and Expo share (dark shell, bump bar ...)
  surfaces/backoffice/   shell, kit, nav (page registry), pages/<id>.tsx, menus/
```

Surfaces don't reach into each other's internals. They share through
`domain/` and `store/`, with three deliberate exceptions:
- **`server/order` (`OrderScreen`)** is the one check screen. PU & Delivery,
  Manager and Host open it.
- **`server/features`** is the contract for the server's panels (menu,
  residents, notices ...). Manager reuses it.
- **Feature admin panels** (venue cards, routing editor, floor plan editor,
  side work assignment) live beside the feature they configure. The back
  office page imports them, so one component knows both the floor behaviour
  and its settings.

## Conventions

### Time
Always use `now()` / `today()` from `src/lib/clock`, never `Date.now()` or
`new Date()`. The demo clock is pinned to a believable dinner service
(5:45 PM today, configurable with `?clock=18:30` or `?clock=real`), so the
seed data always looks live. Use `useNow()` from the UI kit inside timer
components so only they re-render each second.

### Data
- Read reference data through `src/data` (`getItem`, `getResident`,
  `catalog`, `rooms` ...), and never import seed JSON directly in a surface.
- Live operational data (orders, history, associate meals) goes through the
  dining store, `useDining()` from `src/store`.
- State shared across surfaces (notices, 86 list, notes ...) lives in
  `src/store/*` and is built with `createSharedStore`, which persists to
  localStorage and syncs over BroadcastChannel.
- State used by only one surface stays inside that surface's folder. If it
  must persist or sync, use `createSharedStore` with a `kisco_<surface>_...`
  key.

### UI
- Build from the UI kit (`Button`, `Chip`, `Card`, `Avatar`, `Modal`,
  `Sheet`, `Popover`, `Tabs`, `SearchField`, `EmptyState`, `toast`,
  `useConfirm` ...). Extend the kit only if a piece is used by two or more
  surfaces.
- Styling: one `*.module.css` per component, using the CSS variables in
  `src/styles/tokens.css`. CSS Modules scope `@keyframes` names, so
  declare keyframes in the module that animates. Use inline `style` only for computed values
  (per-server colours, floor plan positions). Don't hard-code hex values that
  already exist as tokens.
- Type: Geist for UI text, and Fraunces (`.serif` / `var(--font-serif)`) for
  page titles and big numbers.
- Touch: the floor devices are used one-handed. Primary actions are at least
  40px tall, and a tappable row is a `<button>`.
- Every icon-only button has an `aria-label`. Dialogs come from the kit
  (Escape closes them and focus is restored).
- Every list has an empty state. No dead buttons: a button either works or
  isn't shown.
- Layout must hold from 1024×700 up to 1920×1080 on tablet and desktop
  surfaces (phone surfaces from 360px wide), with no horizontal page scroll
  and no element covering another.

### Routing
`#/<mode>/<view>/...`. A surface owns everything after its mode segment:
`useView('mine')` returns `[view, setView, rest]`. Deep links work, so
`#/backoffice/billing` opens straight to billing.

### Chrome
- Tablet surfaces wrap themselves in `TabletShell` (`nav`, `actions` and
  `rail` slots).
- Kitchen, kiosk and display surfaces draw their own header and put
  `TextZoom` + `ModeChip` (from `shell/controls`) in it, or use
  `CornerControls`.
- Floor devices need a PIN sign-in (`shell/session`: `useMe()`).
