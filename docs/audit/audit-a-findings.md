# Audit A: Server / Manager / Host / Bar tablets

Scope: #/server, #/manager, #/host, #/bar at 1024x768 and 1280x800, driven with Playwright (fresh context = fresh demo data, `?clock=17:45`).
Screenshots: `/tmp/claude-0/-home-user-stuff/9c0a84f7-91ae-5489-902d-20a7ff813b2e/scratchpad/audit-a-shots/` (short name `shots/` below). Scripts: `audit-a-*.mjs` in the scratchpad.

Totals: blocker 0 · major 6 · minor 14 · cosmetic 7.

Global results:
- Console errors and page errors: none across all runs (about 40 scripted sessions).
- Horizontal page scroll: none on any of the 14 main routes at either viewport, including text at 115% (the maximum A+ setting).
- Flows that worked end to end: My tables / P/U & delivery / Table map switch; new check from New check and from Table map; add resident, named guest (with relation) and associate diners; modifiers and note; drinks; alcohol (guest gets guest pricing); hold, release and send; Mark C1 served (with Undo); Check in; Fire C3; trivia; Quick close (with Undo); Close & charge to the plan, to the apartment and by card (terminal simulation, then "Close · $29.00 paid by card"); pick up (time slot), delivery and associate meal checks; P/U board Picked up / On my way / Delivered; Residents list, profile and game picker; Notices "Got it" / "Got all"; side work sheet; voice table picker; taking over another server's check (prompt shown); Shift Review sign-off with signature. Manager: Triage (by table and by associate), Tables, Metrics, Closing report and Associates all render and open checks. 86 list: marking Peach Chicken 86 greys it out live on an already-open server tablet ("86 today", disabled, Mod hidden, removed from usuals), and "Put back on" is offered. Host: seat a walk-in, seat a reservation ("Seat now" marks it Seated, 15 min late), new reservation (past times struck out, table hold shows on the floor). Bar (Orange Blossom Bistro): alcohol from a bistro check goes to the bar → Ready for pickup → server sees "Up at the bar" / "Pick up Drinks". Sign-in PIN pad: wrong PIN shakes and clears; Maria 1122 signs in.

---

## Blocker

None found.

---

## Major

### M1. Holding an entrée still fires its sides to the kitchen, without the entrée
- Screen: Server › check (order screen)
- Steps: New check › EG 11 › Walter Okonkwo › Entrees › Peach Chicken (or COD Salmon), which adds 2 default sides › tap **Hold** on the entrée only › Send. The button reads "Send · drinks now, C2 fires now (1 held)".
- What happens: the sides go to the kitchen and the entrée stays held. #/cook shows an EG 11 C2 ticket with only "Baked Potato, Broccoli" and no protein. Reopening the check shows the sides with the kitchen icon and the entrée as "held 0m".
- Expected: holding a plate holds its sides, or at least the button warns that the sides will fire alone. "C2 fires now" is misleading when the course's only entrée is held.
- Screenshots: shots/s8-held.png, shots/s8-reopen.png, shots/s39cook.png

### M2. A resident who is already seated at another open table can be added to a new check (server and host)
- Screens: Server › New check › Resident picker; Host › Seat panel; Host › Reservations "Seat now"
- Steps: New check › EG 12 › Resident tab › tap Marty Martin (already at SQ 1, open check "Marty +4"). Also Walter Okonkwo (at Marisol's EG 5) and Eleanor (at SQ 8). On the host, type "Marty" in the seat panel. Reservations › Seat now for Tom Beaumont, who is already on Ricardo's SQ 9 check.
- What happens: no "already seated at SQ 1" badge or warning. The resident is seated twice and can use plan credits or be charged twice.
- Expected: show where the resident is already seated and warn or block.
- Screenshots: shots/s15-marty-dup.png, shots/s19-mg3.png (Walter at EG 5), shots/s30-seatnow.png

### M3. Close & charge lets you close a check whose items were never sent (and checks still cooking) with no warning
- Screen: Server › Close & charge
- Steps (dine-in): New check › EG 6 › Tom Beaumont › Entrees › Terrace Burger (unsent) › Close & charge. The screen shows "Covered by meal plan" and an enabled "Close · nothing to charge" button. Tap it.
- Steps (associate meal): New check › Associate meal › Priya Nair › Turkey Club (unsent) › Close & charge › "Close · nothing to charge".
- What happens: the check closes and the food never reaches the kitchen. No "2 items not sent" warning is shown. Fired-but-unserved tables (SQ 1, SQ 13) also close with no prompt.
- Expected: warn or block when lines are unsent or still in the kitchen.
- Screenshots: shots/s18-dinein-unsent-close.png, shots/s18-closed-unsent.png

### M4. Tapping a table by mistake leaves an empty check that cannot be closed and blocks shift sign-off
- Screen: Server › New check / Table map
- Steps: New check › tap EG 12 (or Table map › SQ 14 "+ New check") › Back without adding anyone.
- What happens: My tables now shows "Just seated · EG 12 · No one yet". The host floor shows EG 12 as "1 open" and the table map shows "SQ 14, Adriana, Open". Opening it: Close & charge is disabled because there are no diners, and there is no void or delete. Shift Review sign-off stays locked ("tables are still open"). Empty pick up and delivery orders, by contrast, are auto-removed with a toast.
- Expected: discard an empty dine-in check on Back, or let the server void it.
- Screenshots: shots/s23-empty-check-left.png, shots/s24-empty-check.png, shots/s22-after-back.png

### M5. "Add to order" in the modifier editor sits below the fold, hidden behind the send bar (both viewports)
- Screen: Server › check › tap "Mod" on any item
- Steps: open any check › Entrees › tap "Mod" on Peach Chicken or Terrace Burger.
- What happens: the editor's Cancel / Add to order footer renders under the fixed send bar: y=707 at 1024x768 (bar starts at about 690) and y=719 at 1280x800. A server must discover that the outer menu panel scrolls. The panel uses two nested scroll containers (editor overflow:auto inside menuScroll overflow:auto). The visible primary button at the bottom is "Close & charge" / "Nothing new to send", which invites the wrong tap.
- Expected: the editor's action footer is always visible.
- Screenshots: shots/s5-modeditor.png, shots/s33-1280-modeditor.png, shots/s7-addtoorder-scrolled.png (after manual scroll)

### M6. Server "Ready to run" timers show 0:00 and are never flagged late, while the manager and the map show the same tables as late
- Screens: Server › My tables vs Server › Table map vs Manager › Triage
- Steps: fresh demo › #/server/mine. EG 7 and SQ 3 show "Ready to run 0:00" in normal (not late) styling. Switch to Table map: the same tables are red "Late 10:03" and "Late 8:03". Manager Triage: "Starters up 10 min, not run". Reloading the page resets the board timer to 0:00 again.
- Cause: `stageSince()` in src/domain/tableStage.ts falls back to the time the board first rendered (`readySeen`, in memory) when `readyStampAt` is missing.
- Expected: one timer, based on when the course came up, consistent across screens and surviving a reload.
- Screenshots: shots/s1-server.png, shots/s2-view-Tablemap.png, shots/s1-manager.png

---

## Minor

### m1. The other servers' chips are cut off at 1280x800
- Server header: "MG 3" shows but "RJ 1" is hidden inside a 60px-wide horizontally scrolling box (scrollWidth 110). At 1024 both chips show. Screenshot: shots/s33-1280-servermine.png

### m2. Manager "Shift Review" button uses a magnifying-glass icon
- At 1024 the label is hidden, so it reads as Search (src/surfaces/manager/ManagerHeader.tsx uses `Search`). The server header uses a checklist icon for the same action. Screenshot: shots/s1-manager.png

### m3. Server can start a check on a table held for a reservation without any hint
- New check and Table map show EG 6 (held 6:00 Lindqvist) and EG 8 (5:30 Beaumont, late) as "Open" / "+ New check". The host shows them held. Screenshots: shots/s4-newcheck.png, shots/s2-view-Tablemap.png vs shots/s1-host.png

### m4. Guest close card contradicts itself
- Close & charge for SQ 2 › Joe (guest): "Guest pays à la carte", then "MEAL PLAN · COUNTED AUTOMATICALLY · 1 credit … all à la carte instead", and every line is priced ($29). Staff can't tell whether a credit is used. Screenshot: shots/s13-card.png

### m5. "Card payment for the table" is pre-selected even when nothing is paid by card
- Close for SQ 2 with everything going to the resident account still shows "Each person pays their own" highlighted under "Card payment". Screenshot: shots/s11-close.png

### m6. Shift Review shows a guest's charge as the guest's own apartment charge
- After closing SQ 2 (Joe's $29 charged to Frank's resident account), the chip reads "Apt $29 · Joe Dellacroce". The same pattern appears for EG 7 guests. Screenshot: shots/s21-after-signoff.png

### m7. Associate meal: wording contradictions
- The diner header says "Associate · pays à la carte", but Close shows "No charge · $0.00". The pick up time help says "The resident gets one text…" on an associate meal. The associate menu shows no prices. Screenshots: shots/fail-auditas18mjs.png (associate menu), shots/s18-assoc-close.png

### m8. Pick-up cutoff disagrees between screens
- At 5:45 the server's pick up and associate slot picker offers "6:30 to 6:45 PM" as available. Manager › Associates lists "Dinner · 6:30 to 6:45 PM · past cutoff" (45-minute rule, boundary case). Screenshots: shots/s17-pickup.png, shots/s25-mgr-Associates.png

### m9. "Sent to kitchen" on a scheduled pick up
- After "Schedule for 7:00 to 7:15 PM · kitchen fires at 6:45 PM", the bar flips to "Sent to kitchen" although nothing fires until 6:45. Screenshot: shots/s17-pu-sentstate.png

### m10. "Sign and clock out" does not sign the server out
- After signing off, the device stays signed in as Adriana and New check is still available. Screenshot: shots/s21-after-signoff.png

### m11. "Your check, 5 of 4 seats taken" for SQ 1 on New check
- The aria label and tile say Full with 5 diners at a 4-top. Wording or capacity is off. Screenshot: shots/s4-newcheck.png

### m12. No role gating
- Maria (Hospitality, PIN 1122) gets the full Manager tablet (triage, closing report, 86) and the role menu offers every surface, including "Reset demo data". This may be intended for the demo; noted for production. Screenshots: shots/s36-maria-mgr.png, shots/s36-rolemenu.png

### m13. Manager › Tables: free tables are not tappable
- The same map on the server starts a check ("+ New check"). On the manager tab, tapping "EG 6 Free" does nothing. This is a dead end for a manager who also takes tables. Screenshot: shots/s25-mgr-Tables.png

### m14. Manager › Associates: "Change" is still offered on pick ups whose time has passed
- The 11:00 AM, 1:30 PM and 4:30 PM slots are marked "Pickup time passed". Screenshot: shots/s25-mgr-Associates.png

---

## Cosmetic

### c1. Floor maps: the right-hand Sequoia tiles overflow the room border at 1024
- SQ 5, SQ 7 and SQ 16 cross the room panel edge on Host, Server › Table map and Manager › Tables. With the host seat panel open, tiles are cut at the screen edge and names truncate ("Beaumo…", "Vanhold…"). Screenshots: shots/s1-host.png, shots/s28-seatpanel.png, shots/s2-view-Tablemap.png

### c2. Marisol appears only as "MG 3" in legends
- Host, Table map and Manager › Tables show her without a name, while Adriana, Ricardo and Maria have names. Screenshot: shots/s1-host.png

### c3. "1 meals left"
- Residents list, Rose Delgado. Screenshot: shots/s19-residents.png

### c4. "Manager comp…" header button truncated
- Seen on pick up, delivery and associate meal checks. Screenshot: shots/s17-pu-item.png

### c5. Label changes from "Fire C3" to "Fire dessert" after Check in
- Same action, different names on the same card. Screenshots: shots/s9-checkin.png, shots/s1-server.png

### c6. Escape does not close dialogs
- Seen on "What to grab" and similar dialogs; only × or "Not yet" works. This only matters with a keyboard.

### c7. Toasts and panels overlap or open below the fold
- A toast covers the New reservation modal's Cancel / Book footer (shots/s30-newres.png).
- The Sign off panel expands below the fold without scrolling into view (shots/s21-signoff.png).
- On Close & charge, the sticky Corkage row overlaps the first diner card while scrolling (shots/s13-card.png).
