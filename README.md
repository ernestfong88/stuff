# KiscoConnect Dining

The dining app for Kisco senior living communities. One order book runs every
device in the dining program: the servers' tablets, the kitchen line, expo,
the host stand, pick up and delivery, the resident kiosk, the specials TV and
the culinary back office.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Each device opens straight to its own surface:

| URL | Surface |
| --- | --- |
| `#/server` | Server tablet (default) |
| `#/manager` | Manager tablet |
| `#/host` | Host stand |
| `#/bar` | Bar |
| `#/pud` | Pick up & delivery |
| `#/cook` | Cook line kitchen display |
| `#/expo` | Expo |
| `#/prep` | Production prep |
| `#/assocphone` | Associate meals (phone) |
| `#/kiosk` | Resident kiosk |
| `#/display` | Specials display |
| `#/backoffice` | Culinary back office |

You can also switch surfaces from the mode menu in the top-right corner.
Open two surfaces in separate tabs, for example `#/server` and `#/cook`, to
watch an order travel from the tablet to the kitchen. Tabs stay in sync.

Demo sign-in PINs: Adriana `2468`, Ricardo `1357`, Maria `1122`.

### Demo clock

The demo data is a dinner service in progress. The app runs on a clock pinned
to 5:45 PM today that then ticks in real time, so the service always looks
live. Add `?clock=18:30` to start at a different time, or `?clock=real` to
use the device clock.

To reset the demo, open the account menu (top right), then Demo, then Reset
demo data.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck and build a static site into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (vitest) |
| `npm run e2e` | End-to-end flows across surfaces (Playwright; starts its own dev server) |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | oxlint |

The build is a static site with hash routing, so `dist/` can be hosted
anywhere: a CDN, S3, or a tablet's local web server.

## Photos

Resident portraits go in `src/assets/residents/` and dish photos in
`src/assets/dishes/`. See the README in each folder. Without them, residents
show initials on their colour and dishes show a plate illustration.

## Project layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the structure, the
conventions, and how state flows between surfaces.

The original single-file mockup is kept in
[`reference/`](reference/KiscoConnect_Proposed.html) for comparison.

## Production notes

There is no backend yet. Orders, settings and notes are stored in the
browser (localStorage) and synced between tabs with BroadcastChannel. That's
enough to demo and pilot on a single device or browser, but not across
devices. For production, replace the dining store's persistence layer
(`src/store`) and the seed data (`src/data`) with the KiscoConnect API.
Components only read through those modules, so the change stays in one place.
