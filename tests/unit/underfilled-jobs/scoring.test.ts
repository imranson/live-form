import { describe, expect, it } from 'vitest';
import { collectTags, computeScores, selectedLabels } from '../../../shared/scoring.js';
import { SECTOR_IDS } from '../../../shared/sectors.js';
import { bankAnswer, makeOption, makeQuestion } from '../../helpers.js';
import type { AnswerRecord } from '../../../shared/types.js';

const answerWith = (signalsPerOption: Record<string, number>[], picks: number[], topic: 'interests' | 'age' = 'interests'): AnswerRecord => {
  const question = makeQuestion({
    topic,
    kind: picks.length > 1 ? 'multi' : 'single',
    maxSelections: picks.length,
    options: signalsPerOption.map((signals, i) => makeOption(`o${i}`, { signals })),
  });
  return { question, optionIds: picks.map((i) => `o${i}`) };
};

describe('sector scoring', () => {
  it('starts every sector at zero, in catalogue priority order', () => {
    const scores = computeScores([]);
    expect(scores.map((s) => s.id)).toEqual([...SECTOR_IDS]);
    expect(scores.every((s) => s.score === 0 && s.matchPercent === 0)).toBe(true);
  });

  it('turns a maximum-strength answer into a 100% match', () => {
    const scores = computeScores([answerWith([{ construction: 3 }, { digital: 3 }, {}], [0])]);
    expect(scores[0]).toEqual({ id: 'construction', score: 3, matchPercent: 100 });
    expect(scores.find((s) => s.id === 'digital')?.score).toBe(0);
  });

  it('averages multi-select picks so one question cannot dominate', () => {
    const scores = computeScores([answerWith([{ construction: 3 }, { digital: 3 }, {}], [0, 1])]);
    expect(scores.find((s) => s.id === 'construction')).toMatchObject({ score: 1.5, matchPercent: 50 });
    expect(scores.find((s) => s.id === 'digital')).toMatchObject({ score: 1.5, matchPercent: 50 });
  });

  it('accumulates across questions relative to the maximum possible', () => {
    const scores = computeScores([answerWith([{ logistics: 3 }, {}, {}], [0]), answerWith([{ logistics: 1 }, {}, {}], [0])]);
    expect(scores[0]).toEqual({ id: 'logistics', score: 4, matchPercent: 67 });
  });

  it('lets negative signals push a sector down without going below 0%', () => {
    const scores = computeScores([answerWith([{ logistics: -2, hospitality: 1 }, {}, {}], [0])]);
    const logistics = scores.find((s) => s.id === 'logistics')!;
    expect(logistics.score).toBe(-2);
    expect(logistics.matchPercent).toBe(0);
    expect(scores.at(-1)?.id).toBe('logistics');
  });

  it('ignores profile-only questions (no signals) when computing match %', () => {
    const withProfile = computeScores([answerWith([{ digital: 3 }, {}, {}], [0]), bankAnswer('age', 1, 2)]);
    expect(withProfile[0]).toMatchObject({ id: 'digital', matchPercent: 100 });
  });

  it('breaks ties in favour of the more under-filled sector', () => {
    const scores = computeScores([answerWith([{ hospitality: 2, 'health-social-care': 2 }, {}, {}], [0])]);
    expect(scores.slice(0, 2).map((s) => s.id)).toEqual(['health-social-care', 'hospitality']);
  });

  it('collects profile tags from selected options only, without duplicates', () => {
    const answers = [bankAnswer('situation', 0), bankAnswer('support', [0, 3], 2), bankAnswer('support', [0], 3)];
    expect(collectTags(answers).sort()).toEqual(['need:confidence', 'need:health', 'status:unemployed']);
  });

  it('reports the labels a person picked', () => {
    const answer = bankAnswer('age', 2);
    expect(selectedLabels(answer)).toEqual(['25 to 49']);
  });
});
