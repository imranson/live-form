import type { AnswerRecord, Badge, Progress, SectorScore } from './types.js';
import { computeScores } from './scoring.js';

export const XP_PER_ANSWER = 100;
export const XP_EXPLORER_BONUS = 25; // per extra pick in a multi-select question
export const XP_COMPLETION_BONUS = 200;

export const LEVELS = [
  { number: 1, name: 'Explorer', floorXp: 0 },
  { number: 2, name: 'Navigator', floorXp: 250 },
  { number: 3, name: 'Pathfinder', floorXp: 550 },
  { number: 4, name: 'Trailblazer', floorXp: 900 },
] as const;

export const BADGES = {
  firstStep: { id: 'first-step', name: 'First Step', emoji: '👣', description: 'Answered your first question' },
  openMind: { id: 'open-mind', name: 'Open Mind', emoji: '🧠', description: 'Picked more than one answer' },
  straightTalker: { id: 'straight-talker', name: 'Straight Talker', emoji: '💬', description: 'Told us what support would help' },
  halfway: { id: 'halfway', name: 'Halfway Hero', emoji: '⛰️', description: 'Made it halfway' },
  sparkFound: { id: 'spark-found', name: 'Spark Found', emoji: '✨', description: 'Reached a 50% match with a sector' },
  pathfinder: { id: 'wigan-pathfinder', name: 'Wigan Pathfinder', emoji: '🏅', description: 'Completed the questionnaire' },
} satisfies Record<string, Badge>;

export function computeXp(answers: readonly AnswerRecord[], complete: boolean): number {
  const base = answers.reduce((xp, a) => xp + XP_PER_ANSWER + Math.max(0, a.optionIds.length - 1) * XP_EXPLORER_BONUS, 0);
  return base + (complete ? XP_COMPLETION_BONUS : 0);
}

export function levelFor(xp: number): Progress['level'] {
  let index = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.floorXp) index = i;
  });
  const level = LEVELS[index];
  return { number: level.number, name: level.name, floorXp: level.floorXp, nextXp: LEVELS[index + 1]?.floorXp ?? null };
}

export function earnedBadges(answers: readonly AnswerRecord[], target: number, complete: boolean, scores: readonly SectorScore[]): Badge[] {
  const out: Badge[] = [];
  if (answers.length >= 1) out.push(BADGES.firstStep);
  if (answers.some((a) => a.optionIds.length > 1)) out.push(BADGES.openMind);
  if (answers.some((a) => a.question.topic === 'support')) out.push(BADGES.straightTalker);
  if (answers.length >= Math.ceil(target / 2)) out.push(BADGES.halfway);
  if (scores.some((s) => s.matchPercent >= 50)) out.push(BADGES.sparkFound);
  if (complete) out.push(BADGES.pathfinder);
  return out;
}

/** Full progress snapshot. `previous` lets the UI celebrate only badges earned by the latest answer. */
export function buildProgress(
  answers: readonly AnswerRecord[],
  target: number,
  complete: boolean,
  previous?: Pick<Progress, 'badges'>,
): Progress {
  const scores = computeScores(answers);
  const xp = computeXp(answers, complete);
  const badges = earnedBadges(answers, target, complete, scores);
  const before = new Set(previous?.badges.map((b) => b.id) ?? []);
  return {
    answered: answers.length,
    target,
    xp,
    level: levelFor(xp),
    badges,
    newBadges: badges.filter((b) => !before.has(b.id)),
    scores,
  };
}
