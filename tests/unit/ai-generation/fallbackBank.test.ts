import { describe, expect, it } from 'vitest';
import { FALLBACK_QUESTIONS } from '../../../server/agent/fallbackBank.js';
import { parseAgentQuestion } from '../../../server/agent/questionAgent.js';
import { TOPIC_IDS } from '../../../shared/profile.js';
import { SECTOR_IDS } from '../../../shared/sectors.js';

describe('offline question bank', () => {
  it.each(TOPIC_IDS)('has a valid %s question that passes the same checks as AI output', (topic) => {
    const q = FALLBACK_QUESTIONS[topic];
    expect(q.topic).toBe(topic);
    expect(() => parseAgentQuestion(q, [topic])).not.toThrow();
  });

  it('gives every under-filled sector a chance to score across discovery questions', () => {
    const signalled = new Set(
      (['interests', 'environment', 'strengths', 'values'] as const).flatMap((t) => FALLBACK_QUESTIONS[t].options.flatMap((o) => Object.keys(o.signals))),
    );
    expect([...signalled].sort()).toEqual([...SECTOR_IDS].sort());
  });

  it('maps every age band to a tag', () => {
    expect(FALLBACK_QUESTIONS.age.options.flatMap((o) => o.tags)).toEqual(['age:16-18', 'age:19-24', 'age:25-49', 'age:50-plus']);
  });

  it('lets people skip sensitive support questions', () => {
    const optOut = FALLBACK_QUESTIONS.support.options.find((o) => /prefer not to say/i.test(o.label));
    expect(optOut?.tags).toEqual([]);
  });
});
