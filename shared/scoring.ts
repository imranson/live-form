import { SECTORS } from './sectors.js';
import { SIGNAL_MAX, type AnswerRecord, type Option, type SectorScore } from './types.js';
import type { ProfileTag } from './profile.js';

function selectedOptions(answer: AnswerRecord): Option[] {
  return answer.question.options.filter((o) => answer.optionIds.includes(o.id));
}

/**
 * Each answered question carries equal weight: picking three options in a multi-select
 * question averages their signals rather than tripling them.
 * matchPercent is absolute – 100% means every answer pointed strongly at that sector.
 */
export function computeScores(answers: readonly AnswerRecord[]): SectorScore[] {
  const totals = new Map(SECTORS.map((s) => [s.id, 0]));
  let counted = 0;

  for (const answer of answers) {
    const picked = selectedOptions(answer);
    if (picked.length === 0) continue;
    const carriesSignal = picked.some((o) => Object.keys(o.signals).length > 0);
    if (!carriesSignal) continue;
    counted += 1;
    for (const option of picked) {
      for (const [id, weight] of Object.entries(option.signals)) {
        totals.set(id as SectorScore['id'], (totals.get(id as SectorScore['id']) ?? 0) + (weight ?? 0) / picked.length);
      }
    }
  }

  const maxPossible = counted * SIGNAL_MAX;
  const scores = SECTORS.map((s, priority) => {
    const score = Math.round((totals.get(s.id) ?? 0) * 100) / 100;
    const matchPercent = maxPossible === 0 ? 0 : Math.round((100 * Math.max(0, score)) / maxPossible);
    return { id: s.id, score, matchPercent, priority };
  });

  // Highest score first; ties go to the more under-filled sector (catalogue order).
  scores.sort((a, b) => b.score - a.score || a.priority - b.priority);
  return scores.map(({ id, score, matchPercent }) => ({ id, score, matchPercent }));
}

export function collectTags(answers: readonly AnswerRecord[]): ProfileTag[] {
  const tags = new Set<ProfileTag>();
  for (const answer of answers) for (const option of selectedOptions(answer)) option.tags.forEach((t) => tags.add(t));
  return [...tags];
}

export function selectedLabels(answer: AnswerRecord): string[] {
  return selectedOptions(answer).map((o) => o.label);
}
