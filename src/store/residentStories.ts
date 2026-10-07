/**
 * Resident stories: who a resident is before what they eat.
 *
 * Their background and what fills their days now, a few things they love,
 * the little things going on in their life ("Good to know") and questions
 * to open a conversation with. Hospitality, never clinical: health, diet
 * and care notes have their own places. Back Office edits a story under
 * Conversation Profiles; the edit replaces the original for that resident
 * on every device until it is reset.
 */
import type { Resident } from '../domain/types';
import { createSharedStore, useShared } from '../lib/sharedStore';

export interface ResidentStory {
  /** Where they are from, what they did, family. */
  background: string;
  /** What they are up to at the community now. */
  now: string;
  /** Conversation starters drawn from their story. */
  starters: string[];
  /** Shown as chips ("Golf", "Book club"). */
  loves: string[];
  /** Little things going on in their life right now. */
  goodToKnow: string[];
  /** One question to ask tonight. */
  question: string;
}

const EMPTY_STORY: ResidentStory = { background: '', now: '', starters: [], loves: [], goodToKnow: [], question: '' };

const BASE_STORIES: Record<string, ResidentStory> = {
  r1: {
    background:
      'Marty taught high school history in Tucson for 34 years and coached the varsity baseball team for most of them. He and Cathie have been married 52 years and raised David and Susan a few miles from here.',
    now:
      "Now that his knee has healed he is back on the golf course Tuesdays and Fridays. He helps run the men's breakfast club and will happily tell you about any of his former players who made it to the majors.",
    starters: ['Who was the best player you ever coached?', 'How did the golf game go this week?'],
    loves: ['Golf', 'Baseball', "Men's breakfast club"],
    goodToKnow: [
      'Grandson Tyler just started at Arizona State.',
      'Back on the golf course now that his knee has healed.',
    ],
    question: 'How is Tyler liking Arizona State so far?',
  },
  r1b: {
    background:
      'Cathie was a pediatric nurse at Tucson Medical Center for three decades, and was the one every nervous parent asked for. She and Marty moved in together two years ago.',
    now:
      'Cathie lives in the garden. She tends the rose beds by the courtyard, belongs to the garden club, and hosts the Friday jigsaw puzzle table in the library.',
    starters: ['Which rose are you proudest of this year?', 'What puzzle is the Friday group working on?'],
    loves: ['Roses', 'Garden club', 'Jigsaw puzzles'],
    goodToKnow: [
      'Entered her roses in the garden club show this Saturday.',
      'Daughter Susan visited last weekend with a new puppy.',
    ],
    question: "Are your roses ready for Saturday's show?",
  },
  r2: {
    background:
      'Eleanor was a reference librarian in Boston for 40 years before following her son Paul to Scottsdale. She has read just about everything and remembers all of it.',
    now:
      'She leads the Thursday book club, travels whenever she can, and has just signed up for a Monday watercolor class with Joan. Ask her for a book recommendation and have a pen ready.',
    starters: ['What should I be reading right now?', 'Where is your next trip?'],
    loves: ['Book club', 'Travel', 'Watercolor'],
    goodToKnow: ['Just back from an Alaska cruise.', 'Leads the Thursday book club; this month is a mystery.'],
    question: 'What was the best part of Alaska?',
  },
  r3: {
    background:
      'Tom served in the Navy, then spent his career as a civil engineer building bridges and highways across the Southwest. His daughter Karen and son Jeff both live nearby.',
    now:
      'You will find him in the woodshop most afternoons working on his model ships, and in front of the TV for every Cardinals game. He loves talking about how things are built.',
    starters: ['What ship are you building now?', 'How are the Cardinals looking this season?'],
    loves: ['Model ships', 'Cardinals', 'Woodshop'],
    goodToKnow: ['Big Cardinals fan, and they won last night.', 'Building a model ship in the woodshop.'],
    question: 'Did you catch the Cardinals game last night?',
  },
  r4: {
    background:
      "Rose ran her family's Mexican restaurant in Phoenix for 40 years and was the chef for most of them. She knows food, and she will tell you exactly how she likes hers cooked.",
    now:
      "She teaches cooking classes in the community kitchen, with tamales the favorite, and is busy helping plan her granddaughter's wedding next June.",
    starters: ['What is the secret to a good tamale?', 'How are the wedding plans coming along?'],
    loves: ['Cooking', 'Tamales', 'Family'],
    goodToKnow: ['Teaching a tamale class in the community kitchen next week.', 'Her granddaughter just got engaged.'],
    question: 'What will you be teaching in the tamale class?',
  },
  r5: {
    background:
      'Walter grew up in Lagos and came to Arizona for engineering school, then spent 35 years as an electrical engineer at Motorola. He and his wife just celebrated 60 years of marriage.',
    now:
      'Walter plays chess in the library most mornings and teaches anyone who wants to learn. He likes a quiet window table and his coffee black before anything else.',
    starters: ['Who is the toughest chess player here?', 'What was Lagos like when you were growing up?'],
    loves: ['Chess', 'Engineering'],
    goodToKnow: ['Celebrated 60 years of marriage on Sunday.', 'Plays chess in the library most mornings.'],
    question: 'Sixty years! How did you two celebrate?',
  },
  r6: {
    background:
      'Joan taught art in the Denver public schools for 28 years and came south for the sunshine. Her son still lives in Denver and visits often. She has painted every day for as long as she can remember.',
    now:
      'Her watercolors are in the lobby art show this month, and she walks with the morning group before breakfast. She always wants to hear what is new on the salad menu.',
    starters: ['What are you painting at the moment?', 'How was the walk this morning?'],
    loves: ['Watercolor', 'Morning walks', 'Art show'],
    goodToKnow: ['Her watercolor is in the lobby art show this month.', 'Walks with the morning group.'],
    question: 'Which of your paintings is in the art show?',
  },
  r7: {
    background:
      'Frank owned an auto body shop in Chicago for 35 years before trading the winters for Arizona sun. His niece Maria looks in on him often.',
    now:
      "On weekends he helps his son restore a 1965 Mustang, and on Friday nights he is in the stands for his grandson's high school football games.",
    starters: ['How is the Mustang coming along?', 'Is your grandson playing this Friday?'],
    loves: ['Classic cars', 'Football'],
    goodToKnow: [
      'His grandson plays high school football on Friday nights.',
      'Restoring a 1965 Mustang with his son on weekends.',
    ],
    question: "How did your grandson's game go on Friday?",
  },
  r8: {
    background:
      'Mildred was a concert pianist in her twenties and then taught piano in Milwaukee for more than 50 years. Hundreds of students learned their scales at her bench.',
    now:
      'She never misses the Wednesday piano hour and sometimes plays herself when asked nicely. She just turned 92 and loves a visit from her great niece.',
    starters: ['What piece did they play at piano hour?', 'Who was your favorite student?'],
    loves: ['Piano', 'Music hour'],
    goodToKnow: ['Turned 92 last week.', 'Never misses the Wednesday piano hour.'],
    question: 'Happy belated birthday! Did you do anything fun?',
  },
  r9: {
    background:
      'Harold was an architect in Vancouver, designing libraries and schools, before moving south for the sunshine. His children and grandchildren are still in Canada.',
    now:
      'He has taken up tai chi on the lawn and now helps lead the group. He is a light eater who likes green tea and a quiet table.',
    starters: ['What was your favorite building to design?', 'How is the tai chi group getting on?'],
    loves: ['Tai chi', 'Architecture'],
    goodToKnow: ['Flying to see family in Vancouver next month.', 'Just started tai chi on the lawn.'],
    question: 'Who are you most looking forward to seeing in Vancouver?',
  },
  r10: {
    background:
      "Beatrice kept the books for her family's farm in Iowa for 45 years and can still add a column of numbers faster than a calculator.",
    now:
      'She plays bridge every Tuesday and hosts in her apartment when it is her turn. Her first great grandchild was just born, and she has the photos to prove it.',
    starters: ['Any new photos of the baby?', 'How did bridge go on Tuesday?'],
    loves: ['Bridge', 'Great grandchild'],
    goodToKnow: ['Her first great grandchild was born on Monday.', 'Plays bridge on Tuesday afternoons.'],
    question: 'Congratulations! What did they name the baby?',
  },
  r11: {
    background:
      'Keith spent his career in hospitality, first running hotel restaurants and then building the technology dining teams use every day. He grew up in Minnesota, moved to Arizona for the sunshine, and says he has spent more time in kitchens than dining rooms.',
    now:
      "Keith plays pickleball three mornings a week and volunteers at the Tuesday tech help desk, showing neighbors how to get the most from their phones and tablets. He is always first to try the chef's new specials and gives honest feedback.",
    starters: ["What's the secret to winning the pickleball ladder?", 'What should the chef put on the menu next?'],
    loves: ['Pickleball', 'Tech help desk', 'Grandkids', 'Food'],
    goodToKnow: ['Just back from visiting his grandkids in Minneapolis.', 'Won the pickleball ladder last week.'],
    question: 'How were the grandkids in Minneapolis?',
  },
};

const GAME_CLUES: Record<string, string[]> = {
  r1: [
    'Taught high school history and coached varsity baseball for 34 years.',
    'Back on the golf course now that his knee has healed.',
    "Helps run the men's breakfast club.",
  ],
  r1b: [
    'Was a pediatric nurse for three decades.',
    'Tends the rose beds by the courtyard.',
    'Hosts the Friday jigsaw puzzle table.',
  ],
  r2: [
    'Was a reference librarian in Boston for 40 years.',
    'Just back from an Alaska cruise.',
    'Leads the Thursday book club.',
  ],
  r3: [
    'Served in the Navy, then built bridges and highways as a civil engineer.',
    'Builds model ships in the woodshop.',
    'Never misses a Cardinals game.',
  ],
  r4: [
    "Ran her family's Mexican restaurant in Phoenix for 40 years.",
    'Teaches the tamale class in the community kitchen.',
    "Is helping plan a granddaughter's wedding.",
  ],
  r5: [
    'Grew up in Lagos and was an electrical engineer at Motorola.',
    'Plays chess in the library most mornings.',
    'Just celebrated 60 years of marriage.',
  ],
  r6: [
    'Taught art in the Denver public schools for 28 years.',
    'Has a watercolor in the lobby art show.',
    'Walks with the morning group before breakfast.',
  ],
  r7: [
    'Owned an auto body shop in Chicago.',
    'Is restoring a 1965 Mustang with his son.',
    "Cheers at his grandson's Friday night football games.",
  ],
  r8: [
    'Was a concert pianist, then taught piano for more than 50 years.',
    'Never misses the Wednesday piano hour.',
    'Turned 92 last week.',
  ],
  r9: [
    'Designed libraries and schools as an architect in Vancouver.',
    'Helps lead tai chi on the lawn.',
    'Likes green tea and a quiet table.',
  ],
  r11: [
    'Ran hotel restaurants, then built the technology dining teams use.',
    'Won the pickleball ladder last week.',
    'Volunteers at the Tuesday tech help desk.',
  ],
};

/** Back Office edits by resident id; a resident without one shows the original. */
export type StoryEdits = Record<string, ResidentStory>;

export const residentStoriesStore = createSharedStore<StoryEdits>({}, {
  persistKey: 'kisco.residentStories.v1',
  channel: 'kisco-resident-stories',
});

/** The story as first written, before any Back Office edit. */
export function originalStory(residentId: string): ResidentStory {
  return BASE_STORIES[residentId] ?? EMPTY_STORY;
}

/** The story servers see: the Back Office edit, else the original. */
export function storyFor(edits: StoryEdits, residentId: string): ResidentStory {
  return edits[residentId] ?? originalStory(residentId);
}

export function isStoryEdited(edits: StoryEdits, residentId: string): boolean {
  return !!edits[residentId];
}

/**
 * Questions to open a conversation with: tonight's question, then the
 * starters from their story. A resident with neither gets one about their
 * first family contact, so every profile has somewhere to start.
 */
export function conversationStarters(story: ResidentStory, resident: Pick<Resident, 'contacts'>): string[] {
  const out = [story.question, ...story.starters].map((s) => s.trim()).filter(Boolean);
  const first = resident.contacts?.[0];
  if (!out.length && first) out.push(`How is your ${first.rel.toLowerCase()} ${first.name.split(' ')[0]} doing?`);
  return out;
}

/**
 * Clues for the residents game's bonus round, written so they never name
 * the resident: knowing the answer means knowing their story.
 */
export function gameClues(residentId: string): string[] {
  return GAME_CLUES[residentId] ?? [];
}

export function saveResidentStory(residentId: string, story: ResidentStory): void {
  residentStoriesStore.set((edits) => ({ ...edits, [residentId]: story }));
}

/** Back to the original story. */
export function resetResidentStory(residentId: string): void {
  residentStoriesStore.set((edits) => {
    const next = { ...edits };
    delete next[residentId];
    return next;
  });
}

export function useStoryEdits(): StoryEdits {
  return useShared(residentStoriesStore);
}

/** One resident's story, re-rendering when Back Office edits it. */
export function useResidentStory(residentId: string): ResidentStory {
  return useShared(residentStoriesStore, (edits) => storyFor(edits, residentId));
}
