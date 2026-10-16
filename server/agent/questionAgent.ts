import { collectTags, computeScores } from '../../shared/scoring.js';
import { llmQuestionSchema, type AnswerRecord, type LlmQuestion, type Question } from '../../shared/types.js';
import type { TopicId } from '../../shared/profile.js';
import type { LlmClient } from '../ollama.js';
import { FALLBACK_QUESTIONS } from './fallbackBank.js';
import { allowedTopics } from './planner.js';
import { buildQuestionMessages } from './prompts.js';

const DISCOVERY_TOPICS: readonly TopicId[] = ['interests', 'environment', 'strengths', 'values'];

export interface Logger {
  warn(message: string): void;
}

/**
 * Validates model output beyond the schema: the topic must be one the planner allowed,
 * and discovery questions must actually separate sectors (otherwise the match meter can't move).
 */
export function parseAgentQuestion(data: unknown, allowed: readonly TopicId[]): LlmQuestion {
  const q = llmQuestionSchema.parse(data);
  if (!allowed.includes(q.topic)) throw new Error(`Topic "${q.topic}" not allowed (expected ${allowed.join('/')})`);
  if (DISCOVERY_TOPICS.includes(q.topic)) {
    const sectors = new Set(q.options.flatMap((o) => Object.keys(o.signals)));
    if (sectors.size < 2) throw new Error('Discovery question must signal at least two sectors');
  }
  return q;
}

export function toQuestion(q: LlmQuestion, number: number, source: Question['source']): Question {
  const id = `q${number}`;
  const multi = q.kind === 'multi';
  return {
    id,
    number,
    topic: q.topic,
    kind: q.kind,
    title: q.title,
    ...(q.helper ? { helper: q.helper } : {}),
    agentNote: q.agentNote,
    options: q.options.map((o, i) => ({ id: `${id}-o${i + 1}`, label: o.label, emoji: o.emoji, signals: o.signals, tags: o.tags })),
    maxSelections: multi ? Math.min(q.maxSelections ?? 3, q.options.length) : 1,
    source,
  };
}

export class QuestionAgent {
  constructor(
    private readonly llm: LlmClient | null,
    private readonly logger: Logger = console,
  ) {}

  async next(answers: readonly AnswerRecord[], target: number): Promise<Question> {
    const number = answers.length + 1;
    const allowed = allowedTopics(
      answers.map((a) => a.question.topic),
      target,
    );

    if (this.llm) {
      const messages = buildQuestionMessages({ answers, target, allowed, scores: computeScores(answers), tags: collectTags(answers) });
      try {
        const { value } = await this.llm.generateJson(messages, (data) => parseAgentQuestion(data, allowed), { temperature: 0.8 });
        return toQuestion(value, number, 'ai');
      } catch (err) {
        this.logger.warn(`[question-agent] falling back to question bank: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return toQuestion(FALLBACK_QUESTIONS[allowed[0]], number, 'fallback');
  }
}
