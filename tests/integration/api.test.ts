import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { NARRATIVE_SYSTEM_PROMPT, QUESTION_SYSTEM_PROMPT } from '../../server/agent/prompts.js';
import { REQUIRED_TOPICS } from '../../shared/profile.js';
import { SECTORS } from '../../shared/sectors.js';
import type { AnswerResponse, Question, SessionResult, StartResponse } from '../../shared/types.js';
import { AI_NARRATIVE, buildTestApp, scriptedLlm } from '../helpers.js';

type Agent = ReturnType<typeof request>;

/** Plays the questionnaire like a resident: first option on single questions, first two on multi. */
async function playThrough(app: Parameters<typeof request>[0], pick = (q: Question) => q.options.slice(0, q.kind === 'multi' ? 2 : 1).map((o) => o.id)) {
  const http: Agent = request(app);
  const start = await http.post('/api/sessions').expect(201);
  const { sessionId } = start.body as StartResponse;
  let question: Question | null = (start.body as StartResponse).question;
  const asked: Question[] = [];
  let last: AnswerResponse | undefined;
  while (question) {
    asked.push(question);
    const res = await http.post(`/api/sessions/${sessionId}/answers`).send({ questionId: question.id, optionIds: pick(question) }).expect(200);
    last = res.body as AnswerResponse;
    question = last.question;
  }
  return { http, sessionId, asked, last: last! };
}

describe('questionnaire API (AI agent generating the form live)', () => {
  it('reports health and which AI is configured', async () => {
    const { app } = buildTestApp(scriptedLlm());
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toEqual({ ok: true, ai: { mode: 'test', models: ['fake-model'] } });
  });

  it('serves the under-filled sector catalogue', async () => {
    const { app } = buildTestApp(null);
    const res = await request(app).get('/api/sectors').expect(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual(SECTORS.map((s) => s.id));
  });

  it('starts a session with an AI-written first question and empty progress', async () => {
    const llm = scriptedLlm();
    const { app } = buildTestApp(llm);
    const res = await request(app).post('/api/sessions').expect(201);
    const body = res.body as StartResponse;
    expect(body.sessionId).toBeTruthy();
    expect(body.question).toMatchObject({ id: 'q1', number: 1, source: 'ai' });
    expect(body.progress).toMatchObject({ answered: 0, target: 8, xp: 0 });
    expect(llm.calls).toHaveLength(1);
  });

  it('runs a full questionnaire: one live AI call per question, required topics covered, XP and badges awarded', async () => {
    const llm = scriptedLlm();
    const { app } = buildTestApp(llm);
    const { asked, last } = await playThrough(app);

    expect(asked).toHaveLength(8);
    expect(asked.every((q) => q.source === 'ai')).toBe(true);
    expect(asked.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
    expect(asked.map((q) => q.topic)).toEqual(expect.arrayContaining([...REQUIRED_TOPICS]));
    expect(new Set(asked.map((q) => q.topic)).size).toBe(8);
    // 8 live question calls, plus the results narrative which starts as soon as the last answer lands.
    const systemPrompts = llm.calls.map((c) => c.messages[0].content);
    expect(systemPrompts.filter((p) => p === QUESTION_SYSTEM_PROMPT)).toHaveLength(8);
    expect(systemPrompts.filter((p) => p === NARRATIVE_SYSTEM_PROMPT)).toHaveLength(1);

    expect(last.complete).toBe(true);
    expect(last.progress).toMatchObject({ answered: 8, level: { name: 'Trailblazer' } });
    expect(last.progress.badges.map((b) => b.id)).toContain('wigan-pathfinder');
    expect(last.progress.newBadges.map((b) => b.id)).toContain('wigan-pathfinder');
  });

  it('updates the live sector match after each answer', async () => {
    const { app } = buildTestApp(scriptedLlm());
    const http = request(app);
    const start = (await http.post('/api/sessions')).body as StartResponse;
    const caring = start.question.options.find((o) => (o.signals['health-social-care'] ?? 0) >= 3)!;
    const res = await http.post(`/api/sessions/${start.sessionId}/answers`).send({ questionId: start.question.id, optionIds: [caring.id] });
    const body = res.body as AnswerResponse;
    expect(body.progress.scores[0]).toMatchObject({ id: 'health-social-care', matchPercent: 100 });
    expect(body.progress.newBadges.map((b) => b.id)).toEqual(expect.arrayContaining(['first-step', 'spark-found']));
    expect(body.question).toMatchObject({ id: 'q2' });
  });

  it('returns results with sector matches, curated signposts and an AI narrative', async () => {
    const llm = scriptedLlm();
    const { app } = buildTestApp(llm);
    const { http, sessionId } = await playThrough(app);
    const res = await http.get(`/api/sessions/${sessionId}/result`).expect(200);
    const result = res.body as SessionResult;

    expect(result.narrativeSource).toBe('ai');
    expect(result.narrative).toEqual(AI_NARRATIVE);
    expect(result.topSectors).toHaveLength(3);
    expect(result.topSectors[0].matchPercent).toBeGreaterThan(0);
    expect(result.signposts.at(-1)?.resource.id).toBe('councilJobsHub');
    expect(result.signposts.every((s) => s.resource.url.startsWith('https://'))).toBe(true);
    expect(result.tags.length).toBeGreaterThan(0);

    // Cached: asking again doesn't call the model again.
    const calls = llm.calls.length;
    await http.get(`/api/sessions/${sessionId}/result`).expect(200);
    expect(llm.calls.length).toBe(calls);
  });

  it('personalises signposts from the answers given', async () => {
    const { app } = buildTestApp(scriptedLlm());
    // Pick options tagged "unemployed" and "health" where offered, otherwise the first option.
    const pick = (q: Question) => {
      const wanted = q.options.find((o) => o.tags.some((t) => t === 'status:unemployed' || t === 'need:health'));
      return [(wanted ?? q.options[0]).id];
    };
    const { http, sessionId } = await playThrough(app, pick);
    const result = (await http.get(`/api/sessions/${sessionId}/result`)).body as SessionResult;
    const ids = result.signposts.map((s) => s.resource.id);
    expect(ids).toEqual(expect.arrayContaining(['supportedEmployment', 'jobHelp']));
  });
});

describe('questionnaire API validation', () => {
  async function started() {
    const { app } = buildTestApp(scriptedLlm());
    const http = request(app);
    const body = (await http.post('/api/sessions')).body as StartResponse;
    return { http, ...body, url: `/api/sessions/${body.sessionId}/answers` };
  }

  it('404s for unknown sessions', async () => {
    const { app } = buildTestApp(null);
    await request(app).post('/api/sessions/nope/answers').send({ questionId: 'q1', optionIds: ['x'] }).expect(404);
    const res = await request(app).get('/api/sessions/nope/result').expect(404);
    expect(res.body.error).toMatch(/start again/);
  });

  it('rejects malformed bodies', async () => {
    const { http, url } = await started();
    await http.post(url).send({ questionId: 'q1', optionIds: [] }).expect(400);
    await http.post(url).set('Content-Type', 'application/json').send('{bad json').expect(400);
  });

  it('rejects options that do not belong to the question', async () => {
    const { http, url, question } = await started();
    const res = await http.post(url).send({ questionId: question.id, optionIds: ['q9-o1'] }).expect(400);
    expect(res.body.error).toMatch(/Unknown option/);
  });

  it('enforces the maximum number of selections', async () => {
    const { http, url, question } = await started();
    expect(question.kind).toBe('multi');
    const res = await http.post(url).send({ questionId: question.id, optionIds: question.options.map((o) => o.id) }).expect(400);
    expect(res.body.error).toMatch(/Pick up to 3/);
  });

  it('rejects answering the same question twice (e.g. a double click)', async () => {
    const { http, url, question } = await started();
    await http.post(url).send({ questionId: question.id, optionIds: [question.options[0].id] }).expect(200);
    await http.post(url).send({ questionId: question.id, optionIds: [question.options[0].id] }).expect(409);
  });

  it('refuses results before the questionnaire is finished', async () => {
    const { http, sessionId } = await started();
    await http.get(`/api/sessions/${sessionId}/result`).expect(409);
  });

  it('404s unknown API routes with JSON', async () => {
    const { app } = buildTestApp(null);
    const res = await request(app).get('/api/nothing').expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
