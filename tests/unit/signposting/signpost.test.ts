import { describe, expect, it } from 'vitest';
import { MAX_SIGNPOSTS, selectSignposts } from '../../../shared/signpost.js';
import { RESOURCES } from '../../../shared/resources.js';
import { SECTOR_IDS, type SectorId } from '../../../shared/sectors.js';
import type { ProfileTag } from '../../../shared/profile.js';
import type { SectorScore } from '../../../shared/types.js';

function scoresFavouring(...ids: SectorId[]): SectorScore[] {
  const favoured = ids.map((id, i) => ({ id, score: 10 - i, matchPercent: 80 - i * 10 }));
  const rest = SECTOR_IDS.filter((id) => !ids.includes(id)).map((id) => ({ id, score: 0, matchPercent: 0 }));
  return [...favoured, ...rest];
}

const ids = (scores: SectorScore[], tags: ProfileTag[] = []) => selectSignposts(scores, tags).map((s) => s.resource.id);

describe('signposting rules', () => {
  it('always ends with the Wigan Council jobs hub and never exceeds the cap', () => {
    const everything = Object.keys({
      'status:unemployed': 1,
      'status:low-paid': 1,
      'need:health': 1,
      'need:english-maths': 1,
      'need:confidence': 1,
      'need:childcare': 1,
      'learn:apprenticeship': 1,
      'age:19-24': 1,
    }) as ProfileTag[];
    const result = ids(scoresFavouring('construction', 'digital'), everything);
    expect(result.length).toBeLessThanOrEqual(MAX_SIGNPOSTS);
    expect(result.at(-1)).toBe('councilJobsHub');
    expect(new Set(result).size).toBe(result.length);
  });

  it('leads with resources for the top-matched sector and explains why', () => {
    const result = selectSignposts(scoresFavouring('health-social-care', 'logistics'), []);
    expect(result.slice(0, 2).map((s) => s.resource.id)).toEqual(['careToJoinUs', 'wwlNhs']);
    expect(result[0].reason).toMatch(/top match is Health & Social Care/);
    expect(result.some((s) => s.resource.id === 'skillsBootcampsGM' && /second match/.test(s.reason))).toBe(true);
  });

  it.each(SECTOR_IDS)('gives %s at least two dedicated resources when it is the top match', (sector) => {
    const result = selectSignposts(scoresFavouring(sector), []);
    expect(result.filter((s) => s.reason.includes('top match')).length).toBeGreaterThanOrEqual(2);
  });

  it('puts disability and health support near the top', () => {
    const result = ids(scoresFavouring('digital'), ['need:health']);
    expect(result.slice(0, 3)).toContain('supportedEmployment');
    expect(result).toContain('workingWell');
  });

  it.each([
    ['status:unemployed', 'jobHelp'],
    ['status:low-paid', 'inWorkProgression'],
    ['status:redundancy', 'redundancySupport'],
    ['status:returning', 'workExperience'],
    ['need:childcare', 'childcareChoices'],
    ['need:experience', 'workExperience'],
    ['learn:apprenticeship', 'apprenticeships'],
    ['learn:short-course', 'skillsBootcampsGM'],
  ] as [ProfileTag, keyof typeof RESOURCES][])('signposts %s to %s', (tag, resource) => {
    expect(ids(scoresFavouring('hospitality'), [tag])).toContain(resource);
  });

  it('sends 16–18 year olds to college and youth careers support, not adult (19+) learning', () => {
    const result = ids(scoresFavouring('hospitality'), ['age:16-18', 'need:english-maths', 'need:confidence']);
    expect(result).toContain('youngPeopleCareers');
    expect(result).toContain('wiganLeighCollege');
    expect(result).not.toContain('adultLearning');
  });

  it('sends adults who want English, maths or digital help to Adult Learning', () => {
    expect(ids(scoresFavouring('logistics'), ['age:25-49', 'need:digital-skills'])).toContain('adultLearning');
  });

  it('still gives general help when no sector has a positive match yet', () => {
    const flat = SECTOR_IDS.map((id) => ({ id, score: 0, matchPercent: 0 }));
    const result = selectSignposts(flat, []);
    expect(result.map((s) => s.resource.id)).toEqual(['nationalCareers', 'councilVacancies', 'councilJobsHub']);
    expect(result.every((s) => !s.reason.includes('match'))).toBe(true);
  });
});
