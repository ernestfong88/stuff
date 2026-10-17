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

The demo data is a service in progress. The app runs on the device's real
time, and the demo checks are timed relative to it, so the service always looks
live. Add `?clock=18:30` to pin the clock to another time today (it then ticks
from there), or `?clock=real` to go back to the device clock.

To reset the demo, open the screen menu (top right, on every screen) and tap
Reset demo data at the top.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck and build a static site into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run build:single` | One self-contained `dist-single/index.html` to email or open straight from a tablet's files |
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

The mockups are kept in [`reference/`](reference/) for comparison: IT's
original and the culinary team's edited version. [docs/CHANGES.md](docs/CHANGES.md)
lists what changed from the original mockup to the edited one, and from there
to this app.

## Production notes

There is no backend yet. Orders, settings and notes are stored in the
browser (localStorage) and synced between tabs with BroadcastChannel. That's
enough to demo and pilot on a single device or browser, but not across
devices. For production, replace the dining store's persistence layer
(`src/store`) and the seed data (`src/data`) with the KiscoConnect API.
Components only read through those modules, so the change stays in one place.

Taking the app over? Start with [docs/HANDOFF.md](docs/HANDOFF.md): what's real and what's
simulated, and what's left to build before it can go live.
