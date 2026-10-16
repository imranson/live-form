import { getSector, type SectorId } from './sectors.js';
import { getResource, type ResourceId } from './resources.js';
import type { ProfileTag } from './profile.js';
import type { SectorScore, Signpost } from './types.js';

export const MAX_SIGNPOSTS = 8;

const SECTOR_RESOURCES: Record<SectorId, ResourceId[]> = {
  'health-social-care': ['careToJoinUs', 'wwlNhs', 'healthCareers'],
  construction: ['constructionCareers', 'wiganLeighCollege', 'goConstruct'],
  'engineering-manufacturing': ['wiganLeighCollege', 'tomorrowsEngineers', 'apprenticeships'],
  logistics: ['skillsBootcampsGM', 'lorryDriver', 'generationLogistics'],
  'education-childcare': ['childcareCareers', 'getIntoTeaching', 'adultLearning'],
  digital: ['skillsBootcampsGM', 'wiganLeighCollege', 'apprenticeships'],
  hospitality: ['wiganLeighCollege', 'findApprenticeship', 'employGM'],
};

interface Candidate {
  id: ResourceId;
  rank: number;
  reason: string;
}

/**
 * Deterministic signposting: top-matched sectors + profile tags → curated resources.
 * Lower rank = shown first. The council jobs hub is always included, last.
 */
export function selectSignposts(scores: readonly SectorScore[], tagList: readonly ProfileTag[]): Signpost[] {
  const tags = new Set(tagList);
  const has = (t: ProfileTag) => tags.has(t);
  const under19 = has('age:16-18');
  const candidates: Candidate[] = [];
  const add = (rank: number, reason: string, ...ids: ResourceId[]) => ids.forEach((id) => candidates.push({ id, rank, reason }));

  const matched = scores.filter((s) => s.score > 0).slice(0, 2);
  matched.forEach((s, i) => {
    const sector = getSector(s.id);
    const ids = SECTOR_RESOURCES[s.id];
    const reason = `Your ${i === 0 ? 'top' : 'second'} match is ${sector.name}.`;
    if (i === 0) add(1, reason, ...ids.slice(0, 2));
    else add(3, reason, ids[0]);
    add(6, reason, ...ids.slice(i === 0 ? 2 : 1));
  });

  if (has('need:health')) {
    add(1, 'Specialist support for people with a health condition or disability.', 'supportedEmployment');
    add(3, 'Free health-aware employment support across Greater Manchester.', 'workingWell');
  }
  if (has('status:unemployed')) {
    add(2, 'You’re looking for work right now.', 'jobHelp');
    add(5, 'Search live vacancies.', 'findAJob', 'employGM');
  }
  if (has('status:low-paid')) add(2, 'Free help to progress from low-paid work.', 'inWorkProgression');
  if (has('status:redundancy')) add(2, 'Support after redundancy, including retraining.', 'redundancySupport');
  if (has('status:employed-change')) add(3, 'Free advice for planning a career change.', 'nationalCareers');
  if (has('status:returning')) add(4, 'Build confidence and experience as you return to work.', 'workExperience');
  if (under19 || has('status:student')) {
    add(2, 'Careers help designed for young people in Wigan.', 'youngPeopleCareers');
    add(4, 'Compare colleges, courses and apprenticeships.', 'gmacs');
  }

  if (has('need:english-maths') || has('need:digital-skills')) {
    if (under19) add(3, 'Study English, maths or digital skills at college.', 'wiganLeighCollege');
    else add(3, 'Free English, maths and digital skills courses.', 'adultLearning');
  }
  if (has('need:confidence')) {
    if (under19) add(3, 'Get help with CVs, interviews and confidence.', 'youngPeopleCareers');
    else add(3, 'Free CV, application and interview sessions.', 'adultLearning');
    add(5, 'One-to-one careers advice when you want it.', 'nationalCareers');
  }
  if (has('need:experience')) add(4, 'Try a workplace before you commit.', 'workExperience');
  if (has('need:childcare')) add(4, 'Check what help you can get with childcare costs.', 'childcareChoices');
  if (has('need:transport')) add(5, 'Ask Jobcentre Plus about help with getting to work.', 'jobHelp');

  if (has('learn:apprenticeship')) {
    add(3, 'You’re interested in earning while you learn.', 'apprenticeships');
    add(6, 'Search apprenticeship vacancies.', 'findApprenticeship');
  }
  if (has('learn:short-course') && !under19) add(4, 'Short, free courses with a route to interview.', 'skillsBootcampsGM');
  if (has('learn:degree')) add(5, 'Plan a route through university-level study.', 'nationalCareers');
  if (under19 || has('age:19-24')) add(6, 'Free programmes and support for 16–30 year olds.', 'kingsTrust');

  add(7, 'Free, impartial careers advice for everyone.', 'nationalCareers');
  add(8, 'Live vacancies at Wigan Council.', 'councilVacancies');

  // Stable sort keeps rule order within the same rank; first reason for a resource wins.
  const seen = new Set<ResourceId>(['councilJobsHub']);
  const picked = [...candidates]
    .sort((a, b) => a.rank - b.rank)
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .slice(0, MAX_SIGNPOSTS - 1);

  return [
    ...picked.map((c) => ({ resource: getResource(c.id), reason: c.reason })),
    { resource: getResource('councilJobsHub'), reason: 'Everything Wigan Council offers for jobs and skills, in one place.' },
  ];
}
