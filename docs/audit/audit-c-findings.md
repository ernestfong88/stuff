# Audit C: Back Office, Today / Menus & Recipes / Productions and Checklists / Venues

How I tested: Playwright Chromium, a fresh context for each script (fresh demo data), dev server at http://localhost:5199. Main pass at 1280x800, checks at 1920x1080, and a quick pass at 1024x768. Screenshots are in `/tmp/claude-0/-home-user-stuff/9c0a84f7-91ae-5489-902d-20a7ff813b2e/scratchpad/shots/`; the paths below are relative to that folder. The scripts are the `audit-c-*.mjs` files in the scratchpad.

**Console:** no console errors, page errors or native dialogs on any page in scope, at any viewport, during any of the flows.
**Layout:** no page-level horizontal scroll at 1024, 1280 or 1920. The few small inner overflows are listed under Cosmetic.

**Counts:** Blocker 0, Major 12, Minor 29, Cosmetic 14

---

## Blocker

None found. Every page in scope loads and its main flows complete.

---

## Major

### M1. Floor plan editor: unsaved changes are thrown away without warning
- **Page:** Venue Settings > Sequoia Dining Room > Floor plan
- **Steps:** Click Add table (or drag a table). The banner shows "You have changes that are not saved yet." Click the Details tab, then Floor plan again. Or go to another page and come back.
- **What happened:** The changes are gone and the banner says "This is the original layout." No prompt appears. The table count went 18 → 19 → 18. Switching to Evergreen (which shares the room) kept the changes, so the behaviour is inconsistent.
- **Expected:** A "Discard unsaved layout changes?" prompt, or keep the draft.
- **Shot:** `floor-dup-1280.png` (dirty state)

### M2. Menu builder: making the cycle shorter does nothing, with no explanation
- **Page:** Menu Cycle > VT Winter 2027 (unlocked)
- **Steps:** Set Cycle length to "4 weeks".
- **What happened:** The dropdown reads "4 weeks" but all five week tabs stay (Week 5 12/27 to 1/2), and Week 5's dishes are still there. The code uses max(cycleLen, last filled day). Nothing tells the chef why, and Venue/Production go on using 5 weeks.
- **Expected:** Ask "Week 5 has dishes: remove them?" or block the change with a message.
- **Shot:** `cb-4wk.png`

### M3. Venue menu settings change the live floor at once, with no confirm or undo, and let an unapproved menu go live
- **Page:** Venue Settings > Sequoia Dining Room > Menu
- **Steps:**
  1. Type 10/07/2026 (a Wednesday) in "Week 1 started". It silently snaps to 10/04 and today goes from "Week 3 of 5" to "Week 1 of 5". Today's specials change with no toast and no undo.
  2. Pick Menu cycle "VT Winter 2027 · Q1 2027". The toast says "Sequoia Dining Room serves VT Winter 2027", with no Undo. That menu is "Scheduled · Waiting for the dietitian" and its quarter is Jan to Mar.
  3. Pick "No cycle menu". All specials are dropped, and the "Needs attention" list does not flag it.
- **Expected:** Confirm before changing what is served today. Warn or block menus that are not approved or are outside their quarter. Offer Undo.
- **Shots:** `ven-nonsunday.png`, `ven-winter.png`

### M4. A new recipe whose name contains "cake" or "pie" is filed as a dessert
- **Page:** Recipe Book > Add recipe > "Add … as new" > Start blank
- **Steps:** Create "Lemon Ricotta Pancakes", "Maryland Crab Cakes" or "Apple Pie Oatmeal".
- **What happened:** All three become **DESSERTS · CAKE / PIE**. The regex `/cake|\bpie\b|.../` is in `menus/model/categories.ts:172`. Category drives course, routing and printers, so crab cakes would fire as dessert.
- **Expected:** Pancakes go under Entrées/Breakfast and crab cakes under Entrées or Starters. Or ask the chef to pick the category.
- **Shot:** `rec-blank.png`

### M5. Routing can only be set for this week's dishes
- **Pages:** Venue Settings > Kitchen routing ("Whole menu" plus search), and Printers > What each printer prints ("Add a category or recipe")
- **Steps:** Search "Minestrone", "Tiramisu" or "Steak Salad". All three are on the active VT Fall 2026 cycle: Minestrone and Tiramisu sold yesterday, and Steak Salad is on Sunday.
- **What happened:** "Nothing on the menu matches." / "No category or recipe matches 'Tiramisu'." The "Soup · 14 on the menu" count leaves out Minestrone.
- **Expected:** Every dish in the venue's cycle can be routed, not just the current 7-day window. A chef can't set up next week's dessert or soup ahead of time.
- **Shot:** `route-steak.png`

### M6. The X on Venue > Printers & terminals removes a printer at once, with no confirm or undo
- **Page:** Venue Settings > Sequoia Dining Room > Printers & terminals
- **Steps:** Click X on "Hot Line".
- **What happened:** It is gone at once ("Hot Line removed from Sequoia Dining Room"), with no Undo. The Sequoia kitchen then has no hot-line printer. The Printers page asks "Remove Cold / Pantry?" for the same kind of action, so the two pages behave differently.
- **Expected:** Confirm or Undo.
- **Shot:** `dev-remove2.png`

### M7. "Pair a terminal" is a dead end
- **Page:** Venue Settings > Printers & terminals
- **Steps:** Click "Pair a terminal".
- **What happened:** Only a toast appears: "Pairing code shown on the terminal: enter it here to link the device". There is no field, dialog or other place to enter it.
- **Expected:** A pairing dialog with a code field.
- **Shot:** `dev-pair2.png`

### M8. Printer IP is not checked
- **Pages:** Venue > Printers & terminals > Add printer; Printers > Printers tab
- **Steps:** Enter IP "999.1.1", "abc.def", leave it blank, or enter "10.1.20.12" (already used by Cold / Pantry).
- **What happened:** "Create & add" stays enabled and the printer is saved ("Dessert Station · Kitchen · 999.1.1"). Editing the IP inline to "abc.def" is also accepted.
- **Expected:** Check the format and warn about duplicates.
- **Shots:** `dev-add-badip.png`, `pr-badip.png`

### M9. "New menu cycle" makes a nameless copy with the same name as the live menu
- **Page:** Menu Cycle & À la Carte (Q4 2026 selected)
- **Steps:** Click "New menu cycle".
- **What happened:** With no prompt, an empty Draft named **"VT Fall 2026"** (4 weeks) is created. The list now shows two "VT Fall 2026" rows. "Copy menu cycle from…" lists "VT Fall 2026 · Q4 2026" twice, and so does the venue's menu dropdown, so a chef can put the empty one live.
- **Expected:** Ask for a name first, or give the copy a unique name such as "Untitled cycle".
- **Shot:** `menus-new2.png`

### M10. Production "Confirm all this week" confirms 163 counts in one click
- **Page:** Production (Sequoia)
- **Steps:** Click "Confirm all this week".
- **What happened:** The toast says "163 counts confirmed for this week at Sequoia". There is no confirm and no Undo, so every future day's count is locked in before anyone has checked it.
- **Expected:** A confirm step or an Undo.
- **Shot:** `prod-confirmall.png`

### M11. Venue name can be blank or a duplicate
- **Page:** Venue Settings > Details
- **Steps:** Clear "Venue name", or set it to "Evergreen Dining Room" on Sequoia.
- **What happened:** A blank name saves, leaving the venue list entry and heading empty. A duplicate name saves silently, giving two "Evergreen Dining Room" venues. The Printers page, by contrast, refuses a blank printer name.
- **Expected:** Require a name that is not already used.
- **Shot:** `det-blank.png`

### M12. Menu Export: the item count and the Bistro printout are wrong
- **Page:** Menu Export
- **Steps:** Daily view for Sequoia, then the venue "The Bistro".
- **What happened:** For Sequoia, "PREVIEW · 79 ITEMS" shows while the page prints about 16 dishes (Weekly 77, À la carte 65, Order form 50). For The Bistro, "PREVIEW · 4 ITEMS" shows but the printout lists only Classic Terrace Burger and Build Your Own Deli Sandwich, leaving out French Fries, Vanilla Ice Cream Cup and Iced Tea. It also prints "Served from the à la carte menu every day" and "The à la carte menu is also available at every meal" together, which is redundant.
- **Expected:** The count matches what prints, and every Bistro item prints.
- **Shots:** `tall-export-1280.png`, `exp-venue-bistro.png`

---

## Minor

1. **Venue name differs between pages.** Side Work Tasks and Assign Side Work tabs say "Orange Blossom Bistro"; everywhere else (Production, Prep Checklist, P-Mix, Export, Venues) says "The Bistro". The kitchen is called "Orange Blossom Bistro kitchen". A chef may not realise they are the same place. Shots: `tall-swLib-1280.png`, `tall-swAssign-1280.png`.
2. **Winter 2027 builder labels.** The AI review banner says "21 suggestions for **VT Winter 2026**". Week dates run 11/29 to 1/2 although the quarter is "Q1 2027 · Jan 1 to Mar 31". Shot: `cb-winter.png`.
3. **"Fill from recipe book" says there is nothing to fill.** It reports "No empty slots to fill. Remove a dish first, or add days to the cycle." while every Breakfast and Snacks slot on the Winter menu is empty. (Menu Cycle > VT Winter 2027)
4. **À la carte list vs venue dropdown.** For Q1 2027 the À la carte tab says "Q1 2027 still needs an à la carte menu", yet the venue dropdown offers "VT Winter 2027 · Every-day items · Q1 2027".
5. **Past quarters say "yet".** Q3 2026 and Q4 2025 show "No menu cycles for Q3 2026 yet" although VT Summer 2026 and VT Fall 2025 exist (they appear under Archive). Archived menus also say "Not on a venue yet".
6. **Bistro All-Day is live without approval.** It is "Active", served at The Bistro, and "Not sent for approval", with no warning.
7. **À la carte builder adds to the wrong meals.** In Bistro All-Day, which is lunch only, adding "Salmon Burger" puts it on "Lunch and Dinner". (Menu Cycle > Bistro All-Day)
8. **Production count fields accept bad values.**
   - 12.5 and 99999 are accepted, and "Confirmed 12.5" portions is shown.
   - A cleared field snaps to 0, so typing 3 gives "03".
   - "Edit" un-confirms the row but does not focus the field.
   - Shot: `prod-weird-count.png`.
9. **Production wording.**
   - "Cycle day 18 · 22 of 29" reads like "day 22 of 29"; the second figure is confirmed counts.
   - The Next week view says "0 of 189 counts confirmed **this week**".
10. **Weeks are counted three ways.** Associate Meals runs Mon to Sun, the menu builder Sun to Sat, and Production Wed to Tue ("This week · Oct 7 to Oct 13").
11. **Associate Meals limit has no upper bound.** The daily limit accepts 9999. Shot: `assoc-limits.png`.
12. **Assign Side Work ignores shifts.**
    - An Opening task (Restock sugar caddies) can be tapped onto Marisol (Closing, 3 to 9:30 PM), and dragged onto Ricardo (Mid), with no warning.
    - The Bistro (lunch only) gets Breakfast and Dinner tasks.
    - Clear shows two toasts at once.
13. **Prep Checklist removals and meal toggles.**
    - Turning off B, L and D leaves an item that never shows, with no warning.
    - "Delete" on a subcategory removes it and its 10 items in one click (Undo toast only).
    - Shot: `prep-nomeals.png`.
14. **Recipe edit.**
    - "Add step" adds a borderless, placeholder-less textarea and leaves focus on the button, so it looks as if nothing happened and typing goes nowhere (`rec-after-retire.png`).
    - Retired state shows only through the Restore button; there is no "Retired" badge.
    - The recipe name input has aria-label "Menu name".
15. **No way to delete a mistaken recipe.** A recipe created by mistake can only be Retired, not deleted.
16. **Floor plan: tiny tables.** The W/E handles shrink a table to "2 × 20" (13 px wide, label unreadable), with no minimum size.
17. **Floor plan: overlapping tables.**
    - Duplicate drops the copy on top of a neighbour (SQ 17 overlapping SQ 15).
    - "Line up top edges" on SQ 8, SQ 9 and SQ 13 stacks SQ 13 exactly on SQ 8.
    - Overlapping layouts save without a warning.
    - Shots: `floor-dup-1280.png`, `floor-align-1280.png`.
18. **Floor plan: unitless size tag.** It shows "11 × 10" for a 71×37 px table; the unit means nothing to a chef.
19. **Prices: step of $0.50.** The fields use step 0.5, so $3.75 is marked invalid by the browser even though it is saved.
20. **By menu item for the Bistro kitchen.** It lists all 174 items, including Sequoia cycle dishes, and flags "75 items don't print anywhere", including every drink. Kitchen routing says drinks go to the server or bar, so the warning is noise. (Printers > By menu item > Orange Blossom Bistro kitchen)
21. **Routing category picker stays open.** After choosing a category, the suggestion list stays open listing every category. (Printers > What each printer prints)
22. **Modifiers.**
    - Enter in "Pin a recipe" does not pick the top match.
    - Ordering rules show "Included 0" while every choice shows a price of "Included", which is confusing.
23. **Ctrl K palette.**
    - It finds pages only, not recipes ("swiss steak" → no match).
    - "pmix" → no match.
    - "à la carte" gives 1 result while "a la carte" gives 4.
24. **Dashboard numbers disagree.** The Steps of Service card says "Ricardo's average 24.2"; Detail says "Ricardo Juarez's tables average 22.7 min".
25. **Catering contradictions.**
    - The Menu tab says "No cycle: only the à la carte menu is served" while it also has no à la carte menu.
    - Details says orders "print only", but Catering has no printers.
    - Only "No menu" is flagged.
26. **"Offline since" time moves.** "Bistro terminal is offline since 10:38 PM" changes with the clock (10:41, 10:44…).
27. **Plain-text pointer.** Venue > Printers & terminals says "set what each prints, on Venues › Printers" as plain text, not a link.
28. **P-Mix reversed range.** A Range with the From date after the To date (9/20 to 9/10) silently shows one day with no message.
29. **Turkey Club allergens.** The Associate Meals card shows no Wheat allergen although it is "on toasted sourdough".

---

## Cosmetic

1. Builder slot placeholder reads "Type **a** entrée".
2. Catering Floor plan tab reads "so there is no **a** floor plan to set."
3. The AI "Swap in" toast reads "Swap in · Swap in Short Rib Tamales from Emerald Court".
4. "Menu cycle · 1 weeks" (Archive, VT Fall 2025).
5. Recipe Book shows "Entrees" in the list rows, the recipe kicker and the category select, but "Entrées" in the filters.
6. Production "Week at a glance": counts touch the dish names ("Cheeseburger✓34", "Snickerdoodles25"). Shot: `prod-glance-zoom.png`.
7. With details hidden, the AI menu review summary is squeezed into a narrow 8-line column at 1280. Shot: `cb-4wk.png`.
8. Floor plan: SQ 1 and SQ 2 overlap the "SEQUOIA" zone label, and SQ 5, SQ 7 and SQ 16 touch the zone's right edge, at 1280 and 1920.
9. At 1024 the "…" button in the builder's Saturday column is clipped at the right edge, and the grid frame scrolls 3 px sideways. Shot: `grid-1024.png`.
10. The Menu Export Daily/Weekly/À la carte/Order form segmented control overflows by 5 px (inner scroll) at 1024 and 1280.
11. P-Mix dish names are cut with an ellipsis at 1280 ("Potato Gnocchi with Pesto Cr…", "Pumpkin Bread with Cream C…").
12. The dashboard sentiment "Holding steady" icon is a ▶ play button, which reads like a media control.
13. The Add recipe "Add 'X' as new" button label lags the typed text: it showed "Lemon Ricotta Pancakes" after "… Deluxe" was typed.
14. Kitchen routing: the "Plates SUGGESTED" chips on Cold Cereal and Yogurt Parfait are unclear, and "The coloured button on an entree sets its group" is hard to follow.

---

## Checked and working

- **Dashboard:** 7/14/28-day ranges, the Detail dialogs (open and Esc), the Top Action buttons, and the attention links (go to svcWin/fees, chargeReview and venues/v4/menu).
- **P-Mix:** every When, Meal, Show, Protein and Venue filter, Day and Range pickers, "Show all 27", and "Show full detail".
- **Recipe Book:**
  - Search and the no-results state.
  - Cards view and the Global Library.
  - The Add recipe flow: duplicate search, Global add and Start blank.
  - Inline edits persist across navigation and reload.
  - Retire with Undo.
- **Menu builder:**
  - Add a dish by typing (with an AI create option when nothing matches).
  - Remove with Undo.
  - Copy a meal to another day (dialog, "Replace them", Undo toast).
  - Swap two meals, and "Clear this lunch/dinner" with Undo.
  - "Clear this week" (two taps).
  - "Same dish all week".
  - Snacks row.
  - Take a row off and add it back.
  - Day menu and Add more.
  - AI Swap in, and Lock.
  - Unlock confirm on the locked Fall menu, which does not allow edits until unlocked.
- **À la carte builder:** counter updates (4/20 → 5/20), meal toggles, remove and Undo.
- **Modifiers:** add choice, remove with Undo, pin a recipe, new group, retire with Undo, Copy from another community dialog.
- **Associate Meals:** special of the week, next week (Draft), and the link to Pick Up & Delivery.
- **Production:** venue tabs, next week, day cards, per-row Confirm, Confirm all for dinner, prep tasks add and check, and print (iframe).
- **Prep Checklist:** add item and subcategory, delete with Undo.
- **Assign Side Work:** tap-assign, drag, auto-assign, Clear with Undo.
- **Venue Settings:**
  - Attention "Fix" links and the New venue dialog.
  - Retire confirm and Prices edits.
  - Floor plan: drag, SE resize, duplicate, multi-select with Line up and Space, Undo/Redo (buttons and Ctrl+Z), Delete key, copy and paste, name validation (blank and duplicate block Save), Throw away confirm, Save with toast that persists after reload.
  - Kitchen routing toggle with Undo, and Printer Test.
- **Printers page:** blank-name check, add/remove venue chips, Remove confirm, Add printer dialog, group toggles, Whole ticket, the By menu item "Send to" picker (reflected on the routing tab), and filters.
- **Ctrl K:** opens from inside text fields, Enter goes to the result, Esc closes.
