// Fixed vocabularies the AI agent must use. Anything outside these lists is dropped.

export const TOPICS = {
  situation: 'Their current situation (out of work, low-paid work, facing redundancy, student, returning after a break, employed but want a change)',
  age: 'Their age band',
  interests: 'What kinds of activities they enjoy',
  environment: 'Where they would like to work (indoors/outdoors, busy/calm, on the move, at a desk)',
  strengths: 'What they are good at or what others praise them for',
  values: 'What matters most to them in a job',
  practicalities: 'Hours, shifts, travel and whether they hold a driving licence',
  learning: 'How they like to learn and how confident they feel with English, maths and computers',
  support: 'Anything that could make starting work harder (health, childcare, transport, confidence) – always optional',
} as const;

export type TopicId = keyof typeof TOPICS;
export const TOPIC_IDS = Object.keys(TOPICS) as TopicId[];

/** Topics we must cover so signposting can be personalised. */
export const REQUIRED_TOPICS: readonly TopicId[] = ['situation', 'age', 'learning', 'support'];

export const PROFILE_TAGS = {
  'status:unemployed': 'Out of work and looking',
  'status:low-paid': 'In low-paid work and wants to progress',
  'status:redundancy': 'Facing or recently had redundancy',
  'status:student': 'At school, college or recently left education',
  'status:returning': 'Returning to work after a break (e.g. caring, parenting, illness)',
  'status:employed-change': 'Employed and wants a career change',
  'age:16-18': 'Aged 16 to 18',
  'age:19-24': 'Aged 19 to 24',
  'age:25-49': 'Aged 25 to 49',
  'age:50-plus': 'Aged 50 or over',
  'need:health': 'Has a health condition or disability that affects work',
  'need:childcare': 'Needs help with childcare to work',
  'need:transport': 'Finds travel to work difficult',
  'need:confidence': 'Would like help with confidence, CVs or interviews',
  'need:english-maths': 'Would like to improve English or maths',
  'need:digital-skills': 'Would like to improve computer skills',
  'need:experience': 'Wants to gain work experience first',
  'learn:apprenticeship': 'Interested in an apprenticeship (earn while you learn)',
  'learn:short-course': 'Prefers a short course or bootcamp',
  'learn:on-the-job': 'Prefers to learn on the job',
  'learn:degree': 'Open to university-level study',
  'has:driving-licence': 'Holds a full driving licence',
  'pref:part-time': 'Prefers part-time hours',
  'pref:full-time': 'Prefers full-time hours',
  'pref:shifts-ok': 'Happy with shifts, early starts or nights',
} as const;

export type ProfileTag = keyof typeof PROFILE_TAGS;
export const PROFILE_TAG_IDS = Object.keys(PROFILE_TAGS) as ProfileTag[];

export function isTopicId(value: unknown): value is TopicId {
  return typeof value === 'string' && Object.hasOwn(TOPICS, value);
}

export function isProfileTag(value: unknown): value is ProfileTag {
  return typeof value === 'string' && Object.hasOwn(PROFILE_TAGS, value);
}
