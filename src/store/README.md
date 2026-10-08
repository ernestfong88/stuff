# Stores

Shared state for every surface (server tablet, host, kitchen, expo, bar, PU & Delivery, manager, Back Office).
Everything here syncs across tabs (each tab stands for a device) and persists to localStorage, except `session`.
All times come from the demo clock (`src/lib/clock.ts`).

| Module | What it holds | Read with |
| --- | --- | --- |
| `dining.tsx` | Open checks, closed checks, associate meals, every check action | `useDiningActions()`, `useDiningSelector()` / `useDiningOrders()`, `useDiningDevice()` (or the all-in-one `useDining()`) under `<DiningProvider>` |
| `config.ts` | Community settings: coursing, routing, fees, waivers, flags | `useConfig()` / `getConfig()` |
| `notices.ts` | Office notices and who acknowledged them | `useNotices()` + selectors |
| `eightySix.ts` | Items run out of today | `use86()` / `useIs86(id)` |
| `notes.ts` | Notes servers add about residents | `useNotes()` / `useResidentNotes(kind, rid)` |
| `residentPrefs.ts` | Dining preference text per resident | `useResidentPrefs()` |
| `session.ts` | Who is using this tab, in which mode (not synced) | `useSession()` |

The logic behind the dining store is pure and lives in `src/domain/` (see the end of this file).

## Dining store — `useDining()`

Wrap the app once in `<DiningProvider>`. State is loaded from `kisco.dining.v1` (falls back to the seed when
missing, corrupt or from another demo day), synced at once over the `kisco-dining-orders` BroadcastChannel (tab
id + sequence number, own echoes ignored) and saved a moment later (the last of a run of changes, flushed when the
page is hidden or left; `src/lib/writeBehind.ts`).

`useDining()` re-renders on every change anywhere. Prefer the narrow hooks: `useDiningActions()` (every action plus
`getState()`, `getTableOrder()` ...; the object never changes), `useDiningSelector(s => …)` and its shorthands
`useDiningOrders()`, `useDiningHistory()`, `useAssocOrders()`, `useDiningOrder(id)` (re-render only when the slice
changes), and `useDiningDevice()` for this device's own state (recent bumps, kitchen mode, pending takeover). A 5 second pacing timer fires held courses that
are due; only the tab holding the `kisco-dining-leader` lease runs it.

Most actions are **logged**: they append `{at, k, by, what, c}` to `order.log` (the check timeline), with `by`
taken from the session mode (Kitchen, Expo, Bar, Manager, Host, or the server's first name). When a signed-in
server or manager changes **another server's** open dine-in check, the change is held in `pendingTakeover` until
`confirmTakeover()` (the check then becomes theirs) or `cancelTakeover()`. Kitchen, bar and PU & Delivery steps
never ask. Actions that return an id return `undefined` while a takeover is pending.

### State

| Field | Description |
| --- | --- |
| `orders` | Open checks and queued pick up / delivery orders (`Order[]`). |
| `history` | Closed checks today, newest first. |
| `assocOrders` | Associate meal program orders (`AssocMeal[]`). |
| `recentBumps` | Last 5 checks expo bumped on this device: `{orderId, at, level: 'ready' \| 'cleared'}`. |
| `expoActive`, `kitchenMode` | Device kitchen setup (`true`, `'kds_expo'` by default). |
| `resPrefs` | Saved resident preferences (same as `useResidentPrefs()`). |
| `pendingTakeover` | `{orderId, from}` while a change waits for takeover confirmation, else `null`. |

### Selectors

| Function | Description |
| --- | --- |
| `getTableOrder(tableId)` | The first open check at a table. |
| `getOrderById(orderId)` | An open order by id. |
| `learnedFavorites(residentId, meal?)` | The resident's 4 most ordered item + modifier combos from history. |
| `usageFor(itemId)` | Modifier group pick counts (seed + this device) for ranking choices. |
| `runUndoFor(orderId)` | The undo for a "Mark served" tapped in the last 8 s, or `null`. |

### Opening checks

| Action | Description |
| --- | --- |
| `openOrder(tableId, room, meal?, server?) → id` | The table's open check (for that server), or a new one. Logged on create. |
| `newCheck(tableId, room, meal?, server?) → id` | Always a new check; a second party at a table gets a lettered check (A, B…). |
| `openQueueOrder(type, room?, meal?) → id` | New empty pick up / delivery order. |
| `addOrder(order)` | Add a complete order (kiosk). Not logged. |
| `setOrderMeal(orderId, meal)` | Switch the check's meal. |
| `setDelivery(orderId, feeId)` | Pick the delivery fee option. |
| `patchOrder(orderId, patch)` | Merge fields into an order (sick tray, hospice off…). Not logged. |
| `setCorkage(orderId, bottles)` | Bottles brought in (charged on seat 1). |
| `setAskedFor(orderId, at?)` | The table asked for its server (timestamp), or clear it. Not logged. |

### Diners

| Action | Description |
| --- | --- |
| `addDiner(orderId, kind, refId, isGuest?, extra?) → id` | Seat a resident/associate (or their guest; `extra.guestName`). |
| `removeDiner(orderId, dinerId)` | Unseat. |
| `editSeat(orderId, dinerId, seat)` | Move to another seat number. |
| `setFeedback(orderId, dinerId, feedback)` | Store the diner's feedback. |

### Lines

| Action | Description |
| --- | --- |
| `addItem(orderId, dinerId, itemId, mods, note?, parentId?) → id` | Ring in an item; its default sides come as `autoSide` lines. |
| `removeItem(orderId, dinerId, lineId)` | Remove a line. |
| `updateItem(orderId, dinerId, lineId, mods, note)` | Change modifiers and note. |
| `toggleHold(orderId, dinerId, lineId)` | Hold an unsent line back from sends, or release it. |
| `setLineCourse(orderId, dinerId, lineId, course)` | Move a line to another course. |
| `setToGo(orderId, dinerId, lineId)` | Toggle to-go. |
| `cancelLine(orderId, dinerId, lineId)` | Cancel: marked if the kitchen has it, removed otherwise. |
| `remakeLine(orderId, dinerId, lineId)` | Comp the line and rush a REMAKE copy to the kitchen/bar. |
| `dismissReminder(orderId, lineId, reminder)` | Dismiss a server reminder on a line. Not logged. |

### Sending and pacing

| Action | Description |
| --- | --- |
| `sendOrder(orderId)` | Send everything not held. Dine-in: drinks to server/bar; the lowest course fires, later ones are `scheduled`. Pick up/delivery: course 1, scheduled until promised time minus the lead. |
| `sendCourse(orderId, categories)` | Send/fire only lines in these menu categories. |
| `fireCourseNow(orderId, course)` | Fire a held course now (a takeout order fires everything held). |
| `setOrderPacing(orderId, mode, timerMin?)` | Record the check's pacing choice. |

### Kitchen, expo and the table

| Action | Description |
| --- | --- |
| `setItemKitchenState(orderId, lineId, state)` | Set one line's kitchen state. |
| `markCourseReady(orderId, course, lineIds?)` | A course (or some of its lines) is up at the pass; bumps. |
| `markOrderReady(orderId)` | Every fired plate is up; bumps. |
| `clearCourse(orderId, course)` | Expo ran the course (ready plates and its sides go to the table). |
| `clearOrder(orderId)` | Expo ran everything fired; bumps. |
| `runCourse(orderId, course)` | The server ran a course ("Mark served"). |
| `markServed(orderId, course)` | `runCourse` plus an 8 s undo (see `runUndoFor`). |
| `undoRunCourse(orderId, course, undo)` | Put a run course back at the pass and re-hold what pacing fired since. |
| `recallToCooking(orderId)` | Plates at the pass go back to cooking. |
| `recallCleared(orderId)` | Everything on the table comes back to the pass. |
| `serveDrinks(orderId, lineIds?)` | Drinks reached the table (given ones, or all poured / up). |
| `markBarUp(orderId)` | The bar finished the check's drinks. |
| `checkIn(orderId, course)` | The server checked in after a course. |
| `noDessert(orderId)` | The table declined dessert. |

### Pick up and delivery

| Action | Description |
| --- | --- |
| `setOrderSchedule(orderId, readyAt)` | Promised time, `"4:15 PM"`. |
| `notifyOrder(orderId)` | The resident was texted. |
| `sendPickupReminder(orderId)` | Reminder text sent. |
| `setOrderComp(orderId, comp \| null)` | Comp the whole order (`{reason, at?}`) or remove it. |
| `markPickedUp(orderId)` | Left with the runner. |
| `markDelivered(orderId)` | Handed over: closes into history, charged to the apartment unless set. |

### Closing

| Action | Description |
| --- | --- |
| `closeOrder(orderId, drops?)` | Close into history; `drops` maps diner id → payment (`plan`, `apt`, `card`, `comp`…). |
| `closeDiner(orderId, dinerId, drop?)` | Close one diner's part (separate checks); the check closes with the last. |
| `reopenOrder(orderId)` | Bring a closed check back. |

### Device, preferences, demo

| Action | Description |
| --- | --- |
| `recordModUsage(itemId, groupId)` | Count a modifier pick on this device. |
| `updateResidentPref(residentId, text)` | Save a resident's dining preference. |
| `setExpoActive(on)`, `setKitchenMode(mode)` | Device kitchen setup. |
| `confirmTakeover()`, `cancelTakeover()` | Answer `pendingTakeover`. |
| `setOrders`, `setHistory`, `setAssocOrders` | Raw setters (value or updater). Bypass logging. |
| `clearAll()` | Empty the floor and history. |
| `resetDemo()` | Restore every seed: dining state, notices, 86 list, notes, preferences, settings. |

Exports beside the hook: `DiningProvider` (optional `engine` prop for tests), `PACING_INTERVAL_MS`, types
`DiningApi`, `RecentBump`, `PendingTakeover`. `diningEngine.ts` exports `createDiningEngine`,
`claimPacingLeadership`, `releasePacingLeadership` and the storage/channel key constants.

## Other stores

**`config.ts`** — `configStore`; `useConfig()`, `getConfig()` (defaults filled in); `updateConfig(patch | fn)`;
`setItemRoute(room, itemId, route | null)` (venue routing override); `setHospice(rid, patch, by)` (switch hospice,
logged). Shape: `DiningConfig` in `src/domain/config.ts`.

**`notices.ts`** — `useNotices()` returns `{list, acks}`. Selectors: `allNotices(s)`, `liveNotices(s, at?)`,
`unseenNotices(s, who)`, `pastNotices(s, who)`, `ackedAt(s, id, who)`. Actions: `ackNotice(id, who)` (Got it),
`setNoticeList(list)` (Back Office hands over its list; the seed stands until then).

**`eightySix.ts`** — `use86()` returns item id → day marked; `useIs86(itemId)`. Selectors: `is86(marks, id)`,
`itemsOut(marks)`. Action: `set86(itemId, on)`. Marks expire at midnight.

**`notes.ts`** — `useNotes()` (all, newest first), `useResidentNotes(kind, rid)`. Selectors: `notesFor(notes, kind,
rid)`, `notesBy(notes, initials)`. Actions: `addNote(kind, rid, text, meta?) → id`, `dropNote(id)`,
`editNote(id, text)`. Kinds: `know` (good to know), `obs` (care team), `pref`, `fb` (culinary feedback).

**`residentPrefs.ts`** — `useResidentPrefs()`; `updateResidentPref(rid, text)`; `residentPref(prefs, rid)` (saved
text, else the resident's `fav`).

**`session.ts`** — `useSession()` returns `{mode, me}`; `setSessionMode(mode)`, `setSignedIn(initials | null)`.
Modes: `server`, `manager`, `host`, `bar`, `cook`, `expo`, `prep`, `pud`, `assocphone`, `kiosk`, `display`,
`backoffice`.

## Domain helpers (`src/domain/`)

Pure functions; most take an optional `DiningConfig` (pass `useConfig()` in components). Prototype names in brackets.

- **`orders.ts`** — `dinerPerson` [vt], `dinerName` [Ue], `tableStatus` [sl], `TABLE_STATUS_COLORS` [Hr],
  `holdInfo` [vh], `lineCount`, `hasUnsent`, `heldCount`, `stampReady` [Ot], `allergenConflicts` [tm],
  `availableCount` [nm], `addCheck`, `tableName`, `namesOf`, `leadDiner`, `findLine`, `lineCourse`, `plateLines`,
  `sendText`, `lineLabel`, `learnedFavorites`, `QUEUE_TYPE_LABELS`.
- **`courses.ts`** — `courseMode`, `courseDue`, `COURSE_BACKUP_MIN`, `courseWork`, `courseNumber`, `lastRun`,
  `checkedIn`, `closeIsNext`, `courseSummaries` [__kCourses], `lineReadyAt`, `firstSend`, `normalizeOrder` [__kNorm],
  `runsLine`, `serverItems` [__kSrvItems], `serverOnlyCourse`, `runUndoSnapshot` / `activeRunUndo`, `hash`.
- **`routing.ts`** — `foodRoute` [$r], `defaultFoodRoute`, `drinkRoute`, `defaultDrinkRoute`, `firedState` [ms],
  `queueFiredState` [__kQms], `drinkStartState`, `isDrinkLine` [__kDr], `ROUTE_EXPO_PATTERNS`, `ROUTE_KDS_PATTERNS`.
- **`menu.ts`** — `itemCourse` [un], `isSide` [Sr], `isDrink`, `isAlcohol`, `defaultSides`, `shortName`,
  `kitchenItemName`, `serverItemName`, `itemLabel`, `flattenMods` [Cl], `modNames`, `chosenMods`, `modsText`,
  `upcharge` / `upchargeLines` [__kUp].
- **`billing.ts`** — `linePrice` [ad], `alaCarteTotal` [Ec], `dinerItemsTotal` [Sh], `dinerBilling` [dd],
  `queueFee` [mh], `corkageSettings`, `corkageAmount`.
- **`waivers.ts`** — hospice: `hospiceStatus`, `isOnHospice`, `hospiceWaivesFee`, `hospiceOnOrder`, `isHospiceDiner`,
  `automaticComp`, `nextHospiceStatus`, `seedHospice`; sick trays: `sickConfig`, `sickWaiversThisMonth`,
  `sickWaiversUsed`, `orderResidentId`, `monthStart`, `sickPeriodEnd`, `seedSickWaivers`.
- **`pickup.ts`** — `parseClockTime` [gh], `clockLabel`, `quarterHourSlot`, `isoDate`, `dayOffset`,
  `pickupLeadMinutes`, `ticketAverage`, `pickupFireAt` [hi], `pickupDue`, `pickupStage`, `PICKUP_STAGE_STEP`,
  `pickupWho`, `pickupApt`, `pickupItems`, `pickupLateMinutes`, `minutesAgo`, `spanLabel`.
- **`servers.ts`** — `serverName`, `serverColor`, `serversOnFloor`, `suggestServer`.
- **`residents.ts`** — `residentPills`, `dinerPills`, `abbreviate`, `ALLERGY_ABBREVIATIONS`, `DIET_ABBREVIATIONS`.
- **`activityLog.ts`** — `LOGGED_ACTIONS`, `appendLogEvent`, `logEvent`, `logAuthor`, `needsTakeover`,
  `takeOverOrder` and the wording helpers.
- **`diningActions.ts`** — every state transition as `(state, …args) => state`, plus `pacingTick(orders, cfg)`.
