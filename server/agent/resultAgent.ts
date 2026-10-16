import { getSector } from '../../shared/sectors.js';
import { collectTags, selectedLabels } from '../../shared/scoring.js';
import { selectSignposts } from '../../shared/signpost.js';
import { llmNarrativeSchema, type AnswerRecord, type Narrative, type Progress, type SessionResult, type Signpost } from '../../shared/types.js';
import type { LlmClient } from '../ollama.js';
import type { Logger } from './questionAgent.js';
import { buildNarrativeMessages } from './prompts.js';

const LINK_PATTERN = /https?:\/\/|www\./i;

export function parseNarrative(data: unknown): Narrative {
  const narrative = llmNarrativeSchema.parse(data);
  const text = [narrative.headline, narrative.summary, ...narrative.strengths, ...narrative.nextSteps].join(' ');
  if (LINK_PATTERN.test(text)) throw new Error('Narrative must not contain links');
  return narrative;
}

export function fallbackNarrative(answers: readonly AnswerRecord[], top: SessionResult['topSectors'], signposts: readonly Signpost[]): Narrative {
  const [first, second] = top;
  const strengthsAnswer = answers.find((a) => a.question.topic === 'strengths');
  const strengths = strengthsAnswer ? selectedLabels(strengthsAnswer) : [];
  return {
    headline: `You could shine in ${first.sector.name}`,
    summary:
      `Your answers point towards ${first.sector.name}${second ? ` and ${second.sector.name}` : ''}. ` +
      'These are some of the jobs Wigan employers find hardest to fill, so there are real opportunities – and free support to help you take the first step.',
    strengths: strengths.length ? strengths.slice(0, 3) : ['Curious about new options', 'Ready to take a first step', 'Honest about what you need'],
    nextSteps: signposts.slice(0, 3).map((s) => `${s.resource.title}: ${s.resource.description}`),
  };
}

export class ResultAgent {
  constructor(
    private readonly llm: LlmClient | null,
    private readonly logger: Logger = console,
  ) {}

  async build(answers: readonly AnswerRecord[], progress: Progress): Promise<SessionResult> {
    const topSectors = progress.scores.slice(0, 3).map((s) => ({ ...s, sector: getSector(s.id) }));
    const tags = collectTags(answers);
    const signposts = selectSignposts(progress.scores, tags);

    if (this.llm) {
      try {
        const { value } = await this.llm.generateJson(buildNarrativeMessages(answers, topSectors, tags, signposts), parseNarrative, {
          temperature: 0.6,
        });
        return { topSectors, signposts, narrative: value, narrativeSource: 'ai', progress, tags };
      } catch (err) {
        this.logger.warn(`[result-agent] using template narrative: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { topSectors, signposts, narrative: fallbackNarrative(answers, topSectors, signposts), narrativeSource: 'fallback', progress, tags };
  }
}
