import { describe, expect, it } from 'vitest';
import { readConfig } from '../../server/config.js';
import { OllamaClient } from '../../server/ollama.js';
import { QuestionAgent } from '../../server/agent/questionAgent.js';
import { ResultAgent } from '../../server/agent/resultAgent.js';
import { buildProgress } from '../../shared/game.js';
import type { AnswerRecord } from '../../shared/types.js';

// Hits the real Ollama cloud models. Run with `npm run test:live` (needs `ollama signin` or OLLAMA_API_KEY).
describe.skipIf(!process.env.OLLAMA_LIVE)('live Ollama cloud models', () => {
  try {
    process.loadEnvFile();
  } catch {
    // no .env
  }
  const config = readConfig();
  const llm = new OllamaClient(config.ollama);
  const errors: string[] = [];
  const logger = { warn: (m: string) => errors.push(m) };

  it('generates a valid first question and a follow-up that reacts to the answer', async () => {
    const agent = new QuestionAgent(llm, logger);
    const first = await agent.next([], 8);
    expect(errors).toEqual([]);
    expect(first.source).toBe('ai');
    expect(['interests', 'environment', 'values', 'strengths']).toContain(first.topic);

    const answers: AnswerRecord[] = [{ question: first, optionIds: [first.options[0].id] }];
    const second = await agent.next(answers, 8);
    expect(errors).toEqual([]);
    expect(second).toMatchObject({ id: 'q2', source: 'ai' });
    expect(second.title).not.toBe(first.title);
  }, 120_000);

  it('writes a link-free narrative for the results', async () => {
    const agent = new QuestionAgent(null);
    const answers: AnswerRecord[] = [];
    for (let i = 0; i < 8; i++) {
      const q = await agent.next(answers, 8);
      answers.push({ question: q, optionIds: [q.options[0].id] });
    }
    const result = await new ResultAgent(llm, logger).build(answers, buildProgress(answers, 8, true));
    expect(errors).toEqual([]);
    expect(result.narrativeSource).toBe('ai');
    expect(result.narrative.nextSteps.length).toBeGreaterThan(0);
  }, 120_000);
});
