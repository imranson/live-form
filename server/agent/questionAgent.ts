import { collectTags, computeScores } from '../../shared/scoring.js';
import { ENGLISH, isEnglish } from '../../shared/i18n.js';
import { llmQuestionSchema, type AnswerRecord, type Language, type LlmQuestion, type Question } from '../../shared/types.js';
import type { TopicId } from '../../shared/profile.js';
import type { LlmClient } from '../ollama.js';
import { Translator } from '../i18n/translator.js';
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

/** Translates a hand-written bank question; anything the translator can't handle stays in English. */
export async function localizeQuestion(q: LlmQuestion, language: Language, translator: Pick<Translator, 'translate'>): Promise<LlmQuestion> {
  if (isEnglish(language)) return q;
  const entries: Record<string, string> = { title: q.title, agentNote: q.agentNote, ...(q.helper ? { helper: q.helper } : {}) };
  q.options.forEach((o, i) => (entries[`option${i}`] = o.label));
  const { messages } = await translator.translate(entries, language);
  return {
    ...q,
    title: messages.title,
    agentNote: messages.agentNote,
    ...(q.helper ? { helper: messages.helper } : {}),
    options: q.options.map((o, i) => ({ ...o, label: messages[`option${i}`] })),
  };
}

export class QuestionAgent {
  constructor(
    private readonly llm: LlmClient | null,
    private readonly logger: Logger = console,
    private readonly translator: Pick<Translator, 'translate'> = new Translator(llm, logger),
  ) {}

  async next(answers: readonly AnswerRecord[], target: number, language: Language = ENGLISH): Promise<Question> {
    const number = answers.length + 1;
    const allowed = allowedTopics(
      answers.map((a) => a.question.topic),
      target,
    );

    if (this.llm) {
      const messages = buildQuestionMessages({ answers, target, allowed, scores: computeScores(answers), tags: collectTags(answers), language });
      try {
        const { value } = await this.llm.generateJson(messages, (data) => parseAgentQuestion(data, allowed), { temperature: 0.8 });
        return toQuestion(value, number, 'ai');
      } catch (err) {
        this.logger.warn(`[question-agent] falling back to question bank: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return toQuestion(await localizeQuestion(FALLBACK_QUESTIONS[allowed[0]], language, this.translator), number, 'fallback');
  }
}
