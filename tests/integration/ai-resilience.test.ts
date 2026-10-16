import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { OllamaClient } from '../../server/ollama.js';
import { QuestionAgent } from '../../server/agent/questionAgent.js';
import type { AnswerResponse, Question, SessionResult, StartResponse } from '../../shared/types.js';
import { aiQuestionFor, buildTestApp, silentLogger, topicFromPrompt } from '../helpers.js';

const ollamaReply = (content: string) => new Response(JSON.stringify({ message: { role: 'assistant', content } }), { status: 200 });
const config = { host: 'http://ollama.test', models: ['kimi-k2.6', 'gemma4:31b'], timeoutMs: 5_000 };

async function complete(app: Parameters<typeof request>[0]) {
  const http = request(app);
  const start = (await http.post('/api/sessions').expect(201)).body as StartResponse;
  let question: Question | null = start.question;
  const asked: Question[] = [];
  while (question) {
    asked.push(question);
    const res: request.Response = await http.post(`/api/sessions/${start.sessionId}/answers`).send({ questionId: question.id, optionIds: [question.options[0].id] }).expect(200);
    question = (res.body as AnswerResponse).question;
  }
  const result = (await http.get(`/api/sessions/${start.sessionId}/result`).expect(200)).body as SessionResult;
  return { asked, result };
}

describe('Ollama client + agents working together', () => {
  it('turns a fenced, chatty cloud-model reply into a validated live question', async () => {
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      return ollamaReply(`Here you go!\n\`\`\`json\n${JSON.stringify(aiQuestionFor(topicFromPrompt(body.messages)))}\n\`\`\``);
    });
    const agent = new QuestionAgent(new OllamaClient(config, fetchFn), silentLogger);
    const q = await agent.next([], 8);
    expect(q).toMatchObject({ source: 'ai', topic: 'interests' });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('switches to the fallback cloud model when the primary returns junk', async () => {
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.model === 'kimi-k2.6') return ollamaReply('{"topic":"interests","options":[]}');
      return ollamaReply(JSON.stringify(aiQuestionFor(topicFromPrompt(body.messages))));
    });
    const q = await new QuestionAgent(new OllamaClient(config, fetchFn), silentLogger).next([], 8);
    expect(q.source).toBe('ai');
    expect(fetchFn.mock.calls.map(([, init]) => JSON.parse(init.body as string).model)).toEqual(['kimi-k2.6', 'gemma4:31b']);
  });
});

describe('resilience: a resident is never left stuck', () => {
  it('completes the whole questionnaire from the question bank when Ollama is down', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const { app } = buildTestApp(new OllamaClient(config, fetchFn));
    const { asked, result } = await complete(app);
    expect(asked).toHaveLength(8);
    expect(asked.every((q) => q.source === 'fallback')).toBe(true);
    expect(result.narrativeSource).toBe('fallback');
    expect(result.signposts.length).toBeGreaterThan(2);
  });

  it('mixes AI and fallback questions seamlessly when the AI is flaky', async () => {
    let call = 0;
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      call += 1;
      if (call % 3 === 0) return new Response('busy', { status: 503 }); // every third request fails
      const body = JSON.parse(init.body as string);
      const system = body.messages[0].content as string;
      if (system.includes('personalised results')) return ollamaReply('not json at all');
      return ollamaReply(JSON.stringify(aiQuestionFor(topicFromPrompt(body.messages))));
    });
    const { app } = buildTestApp(new OllamaClient({ ...config, models: ['only'] }, fetchFn));
    const { asked, result } = await complete(app);
    const sources = new Set(asked.map((q) => q.source));
    expect(sources).toEqual(new Set(['ai', 'fallback']));
    expect(asked.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
    expect(result.narrativeSource).toBe('fallback');
  });

  it('runs entirely offline (AI_MODE=offline)', async () => {
    const { app } = buildTestApp(null);
    const { asked, result } = await complete(app);
    expect(asked.every((q) => q.source === 'fallback')).toBe(true);
    expect(result.topSectors[0].sector.name).toBeTruthy();
  });
});
