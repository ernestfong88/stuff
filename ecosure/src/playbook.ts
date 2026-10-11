/**
 * Readiness playbook: for each standard (by short label), what a kitchen needs in place
 * and a quick way to check it during a walk-through. Plain guidance based on the FDA Food
 * Code; where a number depends on the product (sanitizer ppm, dish machine settings),
 * it points to the label or data plate rather than inventing one.
 */
export interface Play { have: string[]; check: string }

export const PLAYBOOK: Record<string, Play> = {
  // Temperatures and logs
  'Cold holding at 41°F or below': { have: ['Every cooler holding TCS food at 41°F or below, with an ambient reading of 38°F or less', 'Reach-in doors kept closed and units not overfilled during service'], check: 'Probe three TCS items in each reach-in and walk-in, starting with the units opened most.' },
  'Hot holding at 135°F or above': { have: ['Hot wells and holding cabinets preheated before food goes in', 'Hot-holding temperatures checked and logged at least every 2 hours'], check: 'Probe each item on the steam table and in the holding cabinet.' },
  'Proper cooling before cold holding': { have: ['Two-stage cooling: 135°F to 70°F within 2 hours, then to 41°F within 4 more', 'Shallow pans, ice baths or ice wands, and lids vented until cold', 'A cooling log for every batch'], check: 'Find today\'s cooked items in the walk-in, probe them, and match them to the cooling log.' },
  'Salads/sandwich items chilled within 4 hrs': { have: ['Ingredients pre-chilled before mixing salads and sandwiches', 'Prepped items back under refrigeration within 4 hours and probed'], check: 'Probe prepped salads and fruit in reach-ins and ask when they were made.' },
  'Proper thawing': { have: ['Thawing under refrigeration, under cold running water, or as part of cooking', 'Reduced-oxygen packaged fish taken out of its package before thawing'], check: 'Look for anything thawing on counters, in standing water, or ROP fish thawing sealed.' },
  'Temperature monitoring system/logs': { have: ['Logs for receiving, cooler and freezer, hot holding, cooling and reheating', 'Logs filled in every shift and reviewed by the chef or director daily'], check: 'Pull the last 7 days of each log and look for gaps.' },
  'Cooler/freezer thermometers': { have: ['A working thermometer in every cooler and freezer, in the warmest spot', 'Probe thermometers calibrated weekly'], check: 'Open each unit and read the thermometer against a calibrated probe.' },

  // Ice machines and equipment
  'Stored food-contact equipment clean (ice machines, pans)': { have: ['Ice machine cleaned and sanitized on a set schedule (monthly, or per the manufacturer) with a sign-off sheet', 'Clean pans, knives, can openers and slicers inspected before they go back on the shelf'], check: 'Wipe the inside of the ice machine drop plate with a white paper towel and spot-check stored pans.' },
  'Food-contact surfaces in good repair': { have: ['Cutting boards resurfaced or replaced when deeply scored', 'Chipped or cracked utensils, containers and lids thrown out'], check: 'Check cutting boards, spatulas, bins and lids for chips, cracks and deep grooves.' },
  'Dish machine sanitizer concentration': { have: ['Sanitizer level tested every shift and logged', 'A spare chemical container on hand and someone who knows how to change it'], check: 'Run a rack and test the final rinse with the correct test strip.' },
  'Dish machine pressure': { have: ['Final rinse pressure within the range on the machine\'s data plate', 'Regular service by the chemical or equipment vendor'], check: 'Read the pressure gauge during the final rinse and compare it to the data plate.' },
  '3-comp sink sanitizer concentration': { have: ['Sanitizer mixed to the label\'s range and tested every time the sink is set up', 'Contact time posted and followed'], check: 'Test the sanitizer basin with the matching strip.' },
  '3-compartment sink set up/labeled': { have: ['Basins labeled Wash, Rinse, Sanitize', 'Sink set up correctly whenever it is in use'], check: 'Look at the labels and the setup of every 3-compartment sink, including satellite kitchens.' },
  'Sanitizer test strips available': { have: ['In-date test strips for each sanitizer in use (quat and chlorine strips differ)'], check: 'Find the strips at each sink and the dish machine and check the expiry date.' },
  'Wiping cloths/sanitizer buckets': { have: ['Wet cloths kept in sanitizer buckets at the label\'s concentration, changed every 4 hours or when dirty', 'Spray bottles labeled and at the right concentration', 'A dry cloth or non-slip mat under cutting boards'], check: 'Test two buckets and one spray bottle; look under the cutting boards.' },
  'Air-dry before stacking (wet nesting)': { have: ['Drying racks with room for pans to air-dry', 'Staff trained not to stack or towel-dry wet ware'], check: 'Pull a few stacked pans from the clean rack and look for moisture between them.' },
  'Proper utensils; single-use not reused': { have: ['Food-grade containers and utensils only', 'Single-use items thrown away after one use'], check: 'Look for reused takeout containers, deli cups or cans used as scoops.' },

  // Food storage and labeling
  'Food storage hierarchy': { have: ['Ready-to-eat food on top, then seafood, whole beef and pork, ground meat, and poultry on the bottom', 'A storage chart posted in the walk-in'], check: 'Scan every walk-in and reach-in shelf from top to bottom.' },
  'No expired RTE product': { have: ['First in, first out rotation', 'A daily check that pulls anything past its use-by date'], check: 'Check dairy, deli and yogurt in every reach-in, including memory care and satellite kitchens.' },
  'RTE foods date labeled': { have: ['Day-dot or date labels on prepped and opened TCS food kept more than 24 hours (7-day maximum including the day made)'], check: 'Look for unlabeled containers and opened packages in the walk-in.' },
  'Foods labeled with common name': { have: ['Any food not easy to identify labeled with its name', 'Bulk bins labeled'], check: 'Look for unlabeled bins, squeeze bottles and containers.' },
  'Food covered/wrapped in storage': { have: ['Lids or wrap on everything in storage once it has cooled'], check: 'Look for uncovered pans in coolers and open boxes in dry storage.' },
  'Food stored in appropriate locations': { have: ['Everything at least 6 inches off the floor', 'Deliveries put away promptly, not left on the walk-in floor'], check: 'Check walk-in floors and the dry storage room.' },
  'In-use utensils stored properly': { have: ['Scoops stored with the handle up and out of the food', 'Utensils between uses kept on a clean surface, in the food with the handle out, or in 135°F water'], check: 'Check bulk bins and the line for scoops buried in food or sitting in standing water.' },
  'Food-contact items/linens stored properly': { have: ['Cups, lids, straws and to-go containers stored inverted or covered', 'Clean linens stored away from soiled ones'], check: 'Look at the to-go station and the linen shelf.' },
  'Displayed food protected': { have: ['Sneeze guards, lids or wrap on self-service and display food', 'Utensils provided for every self-service item'], check: 'Walk the buffet, salad bar and grab-and-go cooler.' },
  'Cross contamination prevented': { have: ['Separate boards and areas for raw proteins and ready-to-eat food', 'Produce stickers removed, and nothing stored above ice or ready-to-eat food that could drip into it'], check: 'Watch prep for a few minutes and look inside the ice bin.' },
  'Damaged cans/packages segregated': { have: ['A labeled "Do not use" shelf for dented cans and damaged packages'], check: 'Scan canned goods for dents on the seams.' },
  'Produce washed properly': { have: ['Produce washed in a clean prep sink, not in its original box, before prep'], check: 'Ask a cook to show how produce is washed.' },

  // Handwashing and hygiene
  'Handwashing at appropriate times': { have: ['Handwashing when starting work, after breaks, after touching raw food, after dish work, and when changing tasks'], check: 'Watch the dish area and the line for 10 minutes.' },
  'Proper handwashing procedure': { have: ['A 20-second wash with soap, then turning off the faucet with a paper towel'], check: 'Watch two staff wash their hands from start to finish.' },
  'Hand sinks accessible, handwash only': { have: ['Hand sinks clear of equipment, drain plugs and dishes, and used only for handwashing'], check: 'Check every hand sink, including the bar and satellite kitchens.' },
  'Soap and towels at hand sinks': { have: ['Soap and paper towels stocked at every hand sink, restrooms included, checked each shift'], check: 'Press every dispenser.' },
  'Handwash signs at all sinks': { have: ['A handwashing sign posted at every hand sink'], check: 'Count sinks and signs.' },
  'Hand sinks clean': { have: ['Hand sinks on the daily cleaning list'], check: 'Look at the basins and faucets.' },
  'Sink water temperature': { have: ['Hot water reaching at least 100°F at hand sinks'], check: 'Run each hand sink for 30 seconds and probe the water.' },
  'Gloves used properly': { have: ['Gloves changed between tasks and after touching raw food', 'Handwashing before putting gloves on'], check: 'Watch glove changes between raw and ready-to-eat tasks.' },
  'Open wounds covered': { have: ['A bandage and glove, or a finger cot, over any cut on the hands', 'A stocked first aid kit'], check: 'Ask the person in charge how cuts are handled.' },
  'No jewelry on hands/arms': { have: ['No watches, bracelets or rings other than a plain band while preparing food'], check: 'Look at hands and wrists on the line.' },
  'Hair restraints worn': { have: ['Hats, hairnets or beard restraints worn in prep and cook areas'], check: 'Count heads on the line and in dish.' },
  'Proper eating/drinking in kitchen': { have: ['Staff drinks in covered cups with straws, stored below and away from food'], check: 'Look for open drinks or food on prep tables.' },
  'Employee personal items stored properly': { have: ['A designated spot or lockers for phones, bags, coats and staff food'], check: 'Look on shelves above food and prep areas.' },

  // Chemicals and pests
  'Chemicals labeled': { have: ['Every working container and spray bottle labeled with its contents'], check: 'Look under prep sinks and on the line for unlabeled bottles.' },
  'Chemicals stored properly': { have: ['Chemicals stored below and away from food, utensils and single-use items', 'Dispensers mounted away from food and clean ware'], check: 'Check the dish area, under sinks and the janitor closet.' },
  'No critical pest activity': { have: ['A licensed pest control provider with service reports on file', 'Under and behind equipment cleaned on a schedule'], check: 'Use a flashlight under equipment and in dry storage corners.' },
  'Insect control devices placed properly': { have: ['Fly lights and traps placed so insects cannot fall onto food or food-contact surfaces'], check: 'Look above prep tables and near doors.' },
  'Outer openings sealed (pest entry)': { have: ['Door sweeps, screens and sealed gaps around pipes and doors'], check: 'Look for daylight under exterior doors.' },
  'Pesticides applied by approved personnel': { have: ['Only the licensed provider applies pesticides; no store-bought sprays on site'], check: 'Check chemical shelves for consumer pest sprays.' },
  'First aid/medications stored': { have: ['Staff medications and first aid supplies stored labeled, in one place, away from food'], check: 'Look on shelves and in reach-ins for personal medications.' },

  // Cleaning and facility
  'Non-food contact surfaces clean/in repair': { have: ['A master cleaning schedule for equipment sides, shelving and carts, with sign-offs'], check: 'Look at the sides of the flat top, fryer and steamer, and at storage shelving.' },
  'Floors, walls, ceilings clean/in repair': { have: ['Floors cleaned under equipment daily', 'Work orders for damaged tiles, ceiling panels and vents'], check: 'Look under the fryers, behind the ovens and at ceiling vents.' },
  'Refrigeration gaskets clean/in repair': { have: ['Gaskets wiped weekly; torn gaskets replaced through a work order'], check: 'Run a finger along each cooler door gasket.' },
  'Hood system clean/in repair': { have: ['Hood filters cleaned on a schedule and professional hood cleaning on file'], check: 'Look at the filters and the hood edges.' },
  'Lighting shielded and clean': { have: ['Shatter-proof bulbs or covers in all food and storage areas', 'Burned-out lights reported and replaced'], check: 'Look up in the walk-in, dry storage and dish areas.' },
  'Dumpster area clean, lids closed': { have: ['Dumpster lids closed and the area cleaned on a schedule'], check: 'Walk out to the dumpster.' },
  'BOH waste containers clean': { have: ['Enough trash cans, cleaned regularly'], check: 'Look inside and around the kitchen trash cans.' },
  'Covered restroom waste container': { have: ['A lidded waste container in every staff restroom used by women'], check: 'Check staff restrooms.' },
  'Plumbing in good repair': { have: ['Leaks and slow drains reported through work orders'], check: 'Look under sinks for leaks.' },

  // Paperwork and postings
  'Food handler certificates': { have: ['Current food handler cards for every food employee where the state or county requires them, kept in one binder'], check: 'Compare the binder to the schedule.' },
  'Prior health inspection items corrected': { have: ['The last health inspection report on file with every priority item corrected'], check: 'Pull the last report and walk its findings.' },
  'Consumer advisory': { have: ['A consumer advisory disclosure and reminder on menus where raw or undercooked items are offered'], check: 'Read the menus for eggs, burgers and fish cooked to order.' },
  'Health permit current': { have: ['A current health permit posted'], check: 'Check the date on the posted permit.' },
  'Allergen awareness/policy': { have: ['A written allergen policy and the 9 major allergens posted', 'A person in charge who can explain how allergen orders are handled'], check: 'Ask the person in charge to name the 9 major allergens.' },
  'Certified manager/PIC': { have: ['A certified food protection manager on every shift where required'], check: 'Check the certificate and the schedule.' },
  'Biohazard clean-up procedures': { have: ['A written vomit and diarrhea clean-up procedure and a stocked clean-up kit'], check: 'Find the kit and the written procedure.' },
};
