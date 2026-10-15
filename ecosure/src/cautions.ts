/**
 * What else a leader should assess when a standard is cited: the follow-on risks a fix can miss.
 * Keyed by the standard's short label. Standards without an entry fall back to the playbook's quick check.
 */
export const CAUTIONS: Record<string, string[]> = {
  'Stored food-contact equipment clean (ice machines, pans)': [
    'Was the ice thrown out and the bin sanitized, not just the outside wiped?',
    'Is there a cleaning schedule with sign-offs, and is the ice machine filter changed on time?',
    'Do repeat findings point to a machine that needs service or replacement?',
  ],
  'Cold holding at 41°F or below': [
    'Was food that sat above 41°F for an unknown time thrown out, not just moved to another cooler?',
    'Is the unit itself failing? Check the ambient temperature and whether maintenance has been called.',
    'Are coolers being overloaded or left open during service, and are temperatures logged twice a day?',
  ],
  'Food-contact surfaces in good repair': [
    'Were damaged boards and utensils thrown out, or only set aside where they can drift back into use?',
    'Is there a budget and a reorder routine, so replacements do not wait on a purchase approval?',
  ],
  'Temperature monitoring system/logs': [
    'Are the logs filled in at the time, or backfilled? Spot-check a few readings against the probe.',
    'When a reading is out of range, is the corrective action written down?',
    'Are thermometers calibrated and is someone named for each shift?',
  ],
  'Wiping cloths/sanitizer buckets': [
    'Are test strips on hand and used, and is the sanitizer at the label concentration?',
    'Are buckets changed every 4 hours or when dirty, and kept off the floor and away from food?',
  ],
  'No expired RTE product': [
    'Was any expired food served to residents before it was found?',
    'Is the date-marking system (7-day discard) understood by every shift, including weekends?',
  ],
  'Chemicals labeled': [
    'Are working bottles labeled every time they are refilled, and do staff know which chemical is which?',
    'Are safety data sheets available for every chemical in use?',
  ],
  'Food covered/wrapped in storage': [
    'Is anything stored uncovered under a drip, fan or shelf that could contaminate it?',
    'Are opened items labeled and dated when they are wrapped?',
  ],
  'Chemicals stored properly': [
    'Are chemicals stored below and away from food, single-service items and prep areas?',
    'Could a chemical have dripped onto food or clean equipment before it was moved?',
  ],
  'Non-food contact surfaces clean/in repair': [
    'Is the deep-clean list realistic for staffing, and are tasks signed off?',
    'Is build-up hiding a repair need, such as a leak or damaged surface?',
  ],
  'Hot holding at 135°F or above': [
    'Was food below 135°F for more than 2 hours thrown out rather than reheated and served?',
    'Is the hot-holding equipment working, preheated, and not used to reheat food?',
  ],
  'Refrigeration gaskets clean/in repair': [
    'Are torn gaskets letting coolers run warm? Check the cooler temperatures too.',
    'Has the work order for replacement gaskets actually been completed?',
  ],
  'Food storage hierarchy': [
    'Is raw meat stored below ready-to-eat food in every cooler, including the walk-in after deliveries?',
    'Was any ready-to-eat food under raw product thrown out?',
  ],
  'Cross contamination prevented': [
    'Are separate boards, utensils and gloves used for raw and ready-to-eat food?',
    'Was any food that may have been contaminated thrown out?',
  ],
  'In-use utensils stored properly': [
    'Are scoops and utensils stored with handles up and out of the food, or in running water?',
  ],
  'Hand sinks accessible, handwash only': [
    'Is the hand sink kept clear during service, not used for dumping or storage?',
    'Are staff actually washing hands at the right times? This finding often travels with handwashing gaps.',
  ],
  'Proper cooling before cold holding': [
    'Was food that missed the 2-hour and 6-hour cooling steps thrown out?',
    'Is there a cooling log for every batch, and enough ice baths or shallow pans to cool large batches?',
  ],
  'Floors, walls, ceilings clean/in repair': [
    'Do gaps or damage give pests a way in? Check the pest findings for the same kitchen.',
    'Is any repair waiting on maintenance or a vendor?',
  ],
  'Proper thawing': [
    'Is food thawed in the cooler, under cold running water, or as part of cooking, never on the counter?',
  ],
  'Displayed food protected': [
    'Are sneeze guards, lids and utensils in place at every self-service station, including grab-and-go?',
    'Who monitors the buffet during service?',
  ],
  'No critical pest activity': [
    'Has a licensed pest control provider visited since the audit, and is the service report on file?',
    'Was any food or packaging that pests may have touched thrown out, and were surfaces cleaned and sanitized?',
    'Have entry points and harborage (gaps, clutter, standing water) been fixed so it does not come back?',
  ],
  'Soap and towels at hand sinks': [
    'Is someone named to restock hand sinks each shift?',
  ],
  'Consumer advisory': [
    'Is the advisory on every menu that offers undercooked or raw items, including specials and room service?',
  ],
  'Handwashing at appropriate times': [
    'Are staff washing between tasks and after touching raw food, trash or their face? Observe a shift.',
    'Are gloves being changed and hands washed before putting on new gloves?',
  ],
  '3-comp sink sanitizer concentration': [
    'Is the sanitizer tested at every set-up, and was anything washed in weak sanitizer re-washed?',
  ],
};

/**
 * The one thing our SMEs will focus on with teams next quarter, per standard.
 * Standards without an entry fall back to their first caution above.
 */
export const FOCUS: Record<string, string> = {
  'Stored food-contact equipment clean (ice machines, pans)': 'Monthly ice machine deep clean with a sign-off log at every community; SMEs check behind the drop plate and under beverage nozzles on each visit.',
  'Cold holding at 41°F or below': 'Twice-daily cooler temperature logs reviewed by the chef; SMEs probe reach-ins and cold wells on each visit and confirm units are serviced.',
  'Food-contact surfaces in good repair': 'A replacement par for cutting boards, spatulas and fry baskets; SMEs pull worn smallwares from service on each visit.',
  'Temperature monitoring system/logs': 'Logs filled in at the time, with corrective actions written down; SMEs spot-check readings against a calibrated probe.',
  'Wiping cloths/sanitizer buckets': 'Test strips at every station and buckets changed every 4 hours; SMEs test a bucket on each visit.',
  'No expired RTE product': 'A 7-day date-marking routine every shift understands, including weekends; SMEs pull a cooler sample on each visit.',
  'Chemicals labeled': 'Every working bottle labeled at refill; SMEs check spray bottles at each station.',
  'Food covered/wrapped in storage': 'Opened product wrapped, labeled and dated; SMEs check the walk-in on each visit.',
  'Chemicals stored properly': 'Chemicals stored below and away from food and clean equipment; SMEs check storage areas on each visit.',
  'Non-food contact surfaces clean/in repair': 'A realistic deep-clean schedule with sign-offs; SMEs flag build-up that points to a repair need.',
  'Hot holding at 135°F or above': 'Hot-holding units preheated and probed every 2 hours; SMEs confirm food below 135°F is discarded, not reheated.',
  'Refrigeration gaskets clean/in repair': 'Gaskets on the weekly cleaning list and torn ones replaced; SMEs confirm work orders are closed.',
  'Food storage hierarchy': 'Raw below ready-to-eat in every cooler, including after deliveries; SMEs check the walk-in on each visit.',
  'Cross contamination prevented': 'Separate boards, utensils and gloves for raw and ready-to-eat food; SMEs observe prep during visits.',
  'In-use utensils stored properly': 'Scoops and utensils stored handle-up and out of the food; SMEs check bins and wells on each visit.',
  'Hand sinks accessible, handwash only': 'Hand sinks clear and stocked through service; SMEs check them on each visit.',
  'Proper cooling before cold holding': 'A cooling log for every batch and the right tools (ice baths, shallow pans); SMEs match cooled items to the log.',
  'Floors, walls, ceilings clean/in repair': 'Repairs that could let pests in closed out; SMEs follow up on open work orders.',
  'No critical pest activity': 'Licensed pest control visits with service reports on file and entry points sealed; SMEs confirm within 48 hours of any sighting.',
};

/** What an issue mostly is, matched against the auditor's notes, for the "trend" line. */
export const PATTERNS: Record<string, [string, RegExp][]> = {
  'Stored food-contact equipment clean (ice machines, pans)': [['ice machine interiors', /ice (machine|maker|bin)|drop plate/], ['beverage nozzles', /nozzle|diffuser|bar gun|dispenser/], ['utensils put away dirty', /\bknife|knives|tongs?\b|slicer|dicer|mandolin|spoon|ladle|spinner/]],
  'Cold holding at 41°F or below': [['cold wells and prep tables', /cold well|holding table|drawer|cold holding unit|prep table|fill line/], ['reach-in coolers', /reach.?in|upright|fridge/], ['salads', /salad|coleslaw/], ['eggs and dairy', /\beggs?\b|milk|half and half|cheese/]],
  'Food-contact surfaces in good repair': [['chipped spatulas and utensils', /spatula|utensil|strainer/], ['grooved cutting boards', /cutting board/], ['cracked containers and lids', /container|\blid\b|lexan|\bpans?\b|bucket/], ['frayed fry baskets', /fry basket|fryer basket/]],
  'Refrigeration gaskets clean/in repair': [['torn gaskets', /torn|ripped|tear|damaged/], ['dirty gaskets', /dirty|debris|mold|build.?up|soiled/]],
  'Temperature monitoring system/logs': [['missing entries', /missing|blank|not (recorded|completed)|incomplete/], ['no thermometer or calibration', /thermometer|calibrat/]],
  'Wiping cloths/sanitizer buckets': [['weak or untested sanitizer', /ppm|concentration|test strip|sanitizer/], ['cloths left out of buckets', /cloth|towel|rag/]],
};
