import { describe, expect, it, vi } from 'vitest';
import { QuestionAgent, parseAgentQuestion, toQuestion } from '../../../server/agent/questionAgent.js';
import { QUESTION_SYSTEM_PROMPT, buildQuestionMessages } from '../../../server/agent/prompts.js';
import { FALLBACK_QUESTIONS } from '../../../server/agent/fallbackBank.js';
import { computeScores, collectTags } from '../../../shared/scoring.js';
import { SECTORS } from '../../../shared/sectors.js';
import { FakeLlm, aiQuestionFor, bankAnswer, silentLogger, topicFromPrompt } from '../../helpers.js';

describe('question agent prompt', () => {
  it('briefs the model on every Wigan under-filled sector and the tag vocabulary', () => {
    for (const s of SECTORS) expect(QUESTION_SYSTEM_PROMPT).toContain(s.id);
    expect(QUESTION_SYSTEM_PROMPT).toContain('status:unemployed');
    expect(QUESTION_SYSTEM_PROMPT).toMatch(/Never ask for names/);
  });

  it('gives the model live context: progress, allowed topics, previous answers and current matches', () => {
    const answers = [bankAnswer('environment', 1, 1)];
    const [, user] = buildQuestionMessages({ answers, target: 8, allowed: ['situation', 'age'], scores: computeScores(answers), tags: collectTags(answers) });
    expect(user.content).toContain('Question 2 of 8');
    expect(user.content).toContain('from: situation, age.');
    expect(user.content).toContain('In people’s homes or a care setting');
    expect(user.content).toMatch(/Care 100%/);
    expect(user.content).toContain('Sectors not explored yet: none');
  });

  it('insists on a single topic when the planner requires it', () => {
    const [, user] = buildQuestionMessages({ answers: [], target: 8, allowed: ['support'], scores: computeScores([]), tags: [] });
    expect(user.content).toContain('MUST have topic: support');
    expect(user.content).toContain('very first question');
  });
});

describe('parseAgentQuestion', () => {
  it('rejects a topic the planner did not allow', () => {
    expect(() => parseAgentQuestion(aiQuestionFor('age'), ['situation'])).toThrow(/not allowed/);
  });

  it('rejects discovery questions that do not separate sectors', () => {
    const flat = { ...aiQuestionFor('interests'), options: aiQuestionFor('interests').options.map((o) => ({ ...o, signals: { digital: 1 } })) };
    expect(() => parseAgentQuestion(flat, ['interests'])).toThrow(/two sectors/);
  });

  it('accepts profile questions without sector signals', () => {
    expect(parseAgentQuestion(aiQuestionFor('age'), ['age']).topic).toBe('age');
  });
});

describe('toQuestion', () => {
  it('assigns server-side ids and selection limits', () => {
    const multi = toQuestion(FALLBACK_QUESTIONS.interests, 3, 'ai');
    expect(multi).toMatchObject({ id: 'q3', number: 3, kind: 'multi', maxSelections: 3, source: 'ai' });
    expect(multi.options.map((o) => o.id)).toEqual(['q3-o1', 'q3-o2', 'q3-o3', 'q3-o4', 'q3-o5', 'q3-o6']);
    expect(toQuestion(FALLBACK_QUESTIONS.age, 1, 'fallback').maxSelections).toBe(1);
  });

  it('never allows more selections than there are options', () => {
    expect(toQuestion({ ...FALLBACK_QUESTIONS.age, kind: 'multi', maxSelections: 4, options: FALLBACK_QUESTIONS.age.options.slice(0, 3) }, 1, 'ai').maxSelections).toBe(3);
  });
});

describe('QuestionAgent', () => {
  it('generates the next question live with the AI', async () => {
    const llm = new FakeLlm((messages) => aiQuestionFor(topicFromPrompt(messages)));
    const q = await new QuestionAgent(llm, silentLogger).next([], 8);
    expect(q).toMatchObject({ id: 'q1', source: 'ai', topic: 'interests', title: expect.stringMatching(/^AI:/) });
    expect(llm.calls).toHaveLength(1);
  });

  it('falls back to the question bank for an allowed topic when the AI fails', async () => {
    const warn = vi.fn();
    const llm = new FakeLlm(() => {
      throw new Error('cloud unavailable');
    });
    const answers = [bankAnswer('interests', [0]), bankAnswer('environment', 0, 2), bankAnswer('strengths', [0], 3), bankAnswer('values', 0, 4)];
    const q = await new QuestionAgent(llm, { warn }).next(answers, 8);
    expect(q).toMatchObject({ id: 'q5', source: 'fallback', topic: 'situation' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cloud unavailable'));
  });

  it('falls back when the AI picks a topic it was not allowed', async () => {
    const llm = new FakeLlm(() => aiQuestionFor('age'));
    const q = await new QuestionAgent(llm, silentLogger).next([], 8);
    expect(q.source).toBe('fallback');
    expect(q.topic).toBe('interests');
  });

  it('works fully offline with no AI client', async () => {
    const q = await new QuestionAgent(null, silentLogger).next([], 8);
    expect(q.source).toBe('fallback');
  });
});
