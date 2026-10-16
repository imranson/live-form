import { describe, expect, it } from 'vitest';
import { answerBodySchema, llmNarrativeSchema, llmQuestionSchema } from '../../../shared/types.js';

const opt = (label: string, extra: Record<string, unknown> = {}) => ({ label, emoji: '🔧', signals: { construction: 2 }, tags: [], ...extra });
const valid = {
  topic: 'interests',
  kind: 'multi',
  maxSelections: 2,
  title: 'What do you enjoy?',
  helper: 'Pick two',
  agentNote: 'Hi!',
  options: [opt('A'), opt('B'), opt('C')],
};

describe('AI question schema (sanitises model output)', () => {
  it('accepts a well-formed question', () => {
    const q = llmQuestionSchema.parse(valid);
    expect(q).toMatchObject({ topic: 'interests', kind: 'multi', maxSelections: 2, title: 'What do you enjoy?' });
    expect(q.options).toHaveLength(3);
  });

  it('drops unknown sectors, rounds and clamps weights, and removes zero weights', () => {
    const q = llmQuestionSchema.parse({
      ...valid,
      options: [opt('A', { signals: { construction: 9, digital: -7, 'space-pirate': 3, logistics: '2', hospitality: 0, 'health-social-care': 1.6 } }), opt('B'), opt('C')],
    });
    expect(q.options[0].signals).toEqual({ construction: 3, digital: -2, logistics: 2, 'health-social-care': 2 });
  });

  it('keeps only known profile tags, deduplicated', () => {
    const q = llmQuestionSchema.parse({ ...valid, options: [opt('A', { tags: ['need:health', 'need:health', 'favourite:colour', 7] }), opt('B'), opt('C')] });
    expect(q.options[0].tags).toEqual(['need:health']);
  });

  it('tolerates missing or malformed signals/tags/emoji', () => {
    const q = llmQuestionSchema.parse({
      ...valid,
      options: [{ label: 'A' }, { label: 'B', signals: 'lots', tags: 'none', emoji: 5 }, { label: 'C', emoji: '👩‍🔧 extra text' }],
    });
    expect(q.options[0]).toEqual({ label: 'A', emoji: '✨', signals: {}, tags: [] });
    expect(q.options[1]).toMatchObject({ signals: {}, tags: [], emoji: '✨' });
    expect(q.options[2].emoji).toBe('👩‍🔧');
  });

  it('removes duplicate options and caps at six', () => {
    const q = llmQuestionSchema.parse({ ...valid, options: ['A', 'a', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => opt(l)) });
    expect(q.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('rejects questions with fewer than three distinct options', () => {
    expect(() => llmQuestionSchema.parse({ ...valid, options: [opt('A'), opt('B')] })).toThrow();
    expect(() => llmQuestionSchema.parse({ ...valid, options: [opt('A'), opt('a'), opt('B')] })).toThrow(/distinct/);
  });

  it('rejects unknown topics and missing titles', () => {
    expect(() => llmQuestionSchema.parse({ ...valid, topic: 'favourite-colour' })).toThrow();
    expect(() => llmQuestionSchema.parse({ ...valid, title: '   ' })).toThrow();
  });

  it('defaults a bad kind to single and drops an invalid maxSelections', () => {
    const q = llmQuestionSchema.parse({ ...valid, kind: 'essay', maxSelections: 99 });
    expect(q.kind).toBe('single');
    expect(q.maxSelections).toBeUndefined();
  });

  it('truncates over-long text with an ellipsis instead of failing', () => {
    const q = llmQuestionSchema.parse({ ...valid, title: 'x'.repeat(300), agentNote: 'y'.repeat(500) });
    expect(q.title).toHaveLength(140);
    expect(q.title.endsWith('…')).toBe(true);
    expect(q.agentNote.length).toBeLessThanOrEqual(220);
  });

  it('falls back to a friendly agent note when missing', () => {
    const { agentNote: _, ...rest } = valid;
    expect(llmQuestionSchema.parse(rest).agentNote).toBe('Let’s keep going!');
  });
});

describe('AI narrative schema', () => {
  it('keeps at most three strengths and four next steps', () => {
    const n = llmNarrativeSchema.parse({ headline: 'H', summary: 'S', strengths: ['a', 'b', 'c', 'd'], nextSteps: ['1', '2', '3', '4', '5'] });
    expect(n.strengths).toEqual(['a', 'b', 'c']);
    expect(n.nextSteps).toHaveLength(4);
  });

  it('requires a headline and summary', () => {
    expect(() => llmNarrativeSchema.parse({ summary: 'S', strengths: ['a'], nextSteps: ['1'] })).toThrow();
  });
});

describe('answer request schema', () => {
  it('requires a question id and at least one option', () => {
    expect(answerBodySchema.safeParse({ questionId: 'q1', optionIds: ['q1-o1'] }).success).toBe(true);
    expect(answerBodySchema.safeParse({ questionId: 'q1', optionIds: [] }).success).toBe(false);
    expect(answerBodySchema.safeParse({ optionIds: ['x'] }).success).toBe(false);
  });
});
