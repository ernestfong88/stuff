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
