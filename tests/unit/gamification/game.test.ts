import { describe, expect, it } from 'vitest';
import { BADGES, LEVELS, XP_COMPLETION_BONUS, XP_EXPLORER_BONUS, XP_PER_ANSWER, buildProgress, computeXp, earnedBadges, levelFor } from '../../../shared/game.js';
import { computeScores } from '../../../shared/scoring.js';
import { bankAnswer } from '../../helpers.js';

const fullRun = () => [
  bankAnswer('interests', [0, 1], 1),
  bankAnswer('situation', 0, 2),
  bankAnswer('environment', 1, 3),
  bankAnswer('strengths', [0], 4),
  bankAnswer('learning', [0], 5),
  bankAnswer('values', 0, 6),
  bankAnswer('age', 1, 7),
  bankAnswer('support', [5], 8),
];

describe('XP', () => {
  it('awards XP per answer, a bonus for exploring extra options, and a completion bonus', () => {
    expect(computeXp([], false)).toBe(0);
    expect(computeXp([bankAnswer('age', 0)], false)).toBe(XP_PER_ANSWER);
    expect(computeXp([bankAnswer('interests', [0, 1, 2])], false)).toBe(XP_PER_ANSWER + 2 * XP_EXPLORER_BONUS);
    expect(computeXp([bankAnswer('age', 0)], true)).toBe(XP_PER_ANSWER + XP_COMPLETION_BONUS);
  });
});

describe('levels', () => {
  it.each([
    [0, 'Explorer', 250],
    [249, 'Explorer', 250],
    [250, 'Navigator', 550],
    [600, 'Pathfinder', 900],
    [5000, 'Trailblazer', null],
  ])('%i XP is %s (next at %s)', (xp, name, nextXp) => {
    expect(levelFor(xp)).toMatchObject({ name, nextXp });
  });

  it('has strictly increasing thresholds', () => {
    LEVELS.slice(1).forEach((l, i) => expect(l.floorXp).toBeGreaterThan(LEVELS[i].floorXp));
  });

  it('reaches the top level by finishing a standard 8-question run', () => {
    expect(buildProgress(fullRun(), 8, true).level.name).toBe('Trailblazer');
    expect(buildProgress(fullRun(), 8, false).level.name).not.toBe('Trailblazer');
  });
});

describe('badges', () => {
  it('awards nothing before the first answer', () => {
    expect(earnedBadges([], 8, false, computeScores([]))).toEqual([]);
  });

  it('awards badges for milestones and behaviours', () => {
    const answers = fullRun();
    const ids = earnedBadges(answers, 8, true, computeScores(answers)).map((b) => b.id);
    expect(ids).toEqual(
      expect.arrayContaining([BADGES.firstStep.id, BADGES.openMind.id, BADGES.straightTalker.id, BADGES.halfway.id, BADGES.pathfinder.id]),
    );
  });

  it('awards Spark Found only when a sector reaches a 50% match', () => {
    const strong = [bankAnswer('environment', 1)];
    expect(earnedBadges(strong, 8, false, computeScores(strong)).map((b) => b.id)).toContain(BADGES.sparkFound.id);
    const weak = [bankAnswer('practicalities', [1])];
    expect(earnedBadges(weak, 8, false, computeScores(weak)).map((b) => b.id)).not.toContain(BADGES.sparkFound.id);
  });

  it('reports only newly earned badges so the UI celebrates each once', () => {
    const first = buildProgress([bankAnswer('age', 0)], 8, false);
    expect(first.newBadges.map((b) => b.id)).toEqual([BADGES.firstStep.id]);
    const second = buildProgress([bankAnswer('age', 0), bankAnswer('situation', 0, 2)], 8, false, first);
    expect(second.newBadges).toEqual([]);
  });
});

describe('progress snapshot', () => {
  it('bundles answered count, target, XP, level, badges and live scores', () => {
    const progress = buildProgress([bankAnswer('environment', 0)], 8, false);
    expect(progress).toMatchObject({ answered: 1, target: 8, xp: 100, level: { name: 'Explorer' } });
    expect(progress.scores[0].id).toBe('construction');
  });
});
