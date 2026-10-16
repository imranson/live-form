import { FALLBACK_QUESTIONS } from '../server/agent/fallbackBank.js';
import { toQuestion } from '../server/agent/questionAgent.js';
import { NARRATIVE_SYSTEM_PROMPT } from '../server/agent/prompts.js';
import { QuestionAgent } from '../server/agent/questionAgent.js';
import { ResultAgent } from '../server/agent/resultAgent.js';
import { createApp } from '../server/app.js';
import { SessionStore } from '../server/sessions.js';
import type { ChatMessage, LlmClient } from '../server/ollama.js';
import { TOPIC_IDS, type TopicId } from '../shared/profile.js';
import type { AnswerRecord, LlmQuestion, Option, Question } from '../shared/types.js';

export const silentLogger = { warn: () => undefined };

export function makeOption(id: string, overrides: Partial<Option> = {}): Option {
  return { id, label: `Option ${id}`, emoji: '🙂', signals: {}, tags: [], ...overrides };
}

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    number: 1,
    topic: 'interests',
    kind: 'single',
    title: 'What do you enjoy?',
    agentNote: 'Hello!',
    options: [makeOption('q1-o1'), makeOption('q1-o2'), makeOption('q1-o3')],
    maxSelections: 1,
    source: 'ai',
    ...overrides,
  };
}

/** Build an answer from the fallback bank – realistic signals and tags without hand-writing them. */
export function bankAnswer(topic: TopicId, pick: number[] | number, number = 1): AnswerRecord {
  const question = toQuestion(FALLBACK_QUESTIONS[topic], number, 'fallback');
  const picks = Array.isArray(pick) ? pick : [pick];
  return { question, optionIds: picks.map((i) => question.options[i].id) };
}

export interface FakeCall {
  messages: ChatMessage[];
}

/** Deterministic stand-in for the Ollama client. Still runs the caller's validator, like the real one. */
export class FakeLlm implements LlmClient {
  readonly calls: FakeCall[] = [];
  constructor(private readonly respond: (messages: ChatMessage[], callIndex: number) => unknown) {}

  async generateJson<T>(messages: ChatMessage[], parse: (data: unknown) => T) {
    this.calls.push({ messages });
    const data = await this.respond(messages, this.calls.length - 1);
    return { value: parse(data), model: 'fake-model' };
  }
}

/** Reads the planner's allowed topics out of the prompt, the same way a real model would have to. */
export function topicFromPrompt(messages: ChatMessage[]): TopicId {
  const user = messages.find((m) => m.role === 'user')?.content ?? '';
  const must = /MUST have topic: ([a-z]+)/.exec(user);
  if (must) return must[1] as TopicId;
  const list = /from: ([a-z, ]+)\./.exec(user);
  const first = list?.[1].split(',')[0].trim();
  if (first && (TOPIC_IDS as string[]).includes(first)) return first as TopicId;
  throw new Error(`No topic in prompt:\n${user}`);
}

export function aiQuestionFor(topic: TopicId): LlmQuestion {
  const base = FALLBACK_QUESTIONS[topic];
  return { ...base, title: `AI: ${base.title}`, agentNote: `AI note for ${topic}` };
}

export const AI_NARRATIVE = {
  headline: 'You were made for caring work',
  summary: 'You told us you love helping people. Care roles in Wigan could be a great fit.',
  strengths: ['Kind', 'Patient', 'Reliable'],
  nextSteps: ['Look at Care to join us?', 'Talk to the National Careers Service', 'Browse Jobs, careers and skills'],
};

/** A fake model that behaves like a well-behaved real one: right topic, valid JSON. */
export function scriptedLlm(): FakeLlm {
  return new FakeLlm((messages) =>
    messages[0].content === NARRATIVE_SYSTEM_PROMPT ? AI_NARRATIVE : aiQuestionFor(topicFromPrompt(messages)),
  );
}

export function buildTestApp(llm: LlmClient | null, questionCount = 8) {
  const store = new SessionStore(60 * 60_000);
  const app = createApp({
    questionAgent: new QuestionAgent(llm, silentLogger),
    resultAgent: new ResultAgent(llm, silentLogger),
    store,
    questionCount,
    aiInfo: { mode: llm ? 'test' : 'offline', models: llm ? ['fake-model'] : [] },
  });
  return { app, store };
}
