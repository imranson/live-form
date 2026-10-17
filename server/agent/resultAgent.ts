import { getSector } from '../../shared/sectors.js';
import { collectTags, selectedLabels } from '../../shared/scoring.js';
import { selectSignposts } from '../../shared/signpost.js';
import { ENGLISH, isEnglish } from '../../shared/i18n.js';
import { llmNarrativeSchema, type AnswerRecord, type Language, type Narrative, type Progress, type SessionResult, type Signpost } from '../../shared/types.js';
import type { LlmClient } from '../ollama.js';
import { Translator } from '../i18n/translator.js';
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

/** Translates the curated signposts (title, description, reason). Links and phone numbers are untouched. */
export async function localizeSignposts(signposts: readonly Signpost[], language: Language, translator: Pick<Translator, 'translate'>): Promise<Signpost[]> {
  if (isEnglish(language)) return [...signposts];
  const entries: Record<string, string> = {};
  signposts.forEach((s, i) => Object.assign(entries, { [`${i}.title`]: s.resource.title, [`${i}.description`]: s.resource.description, [`${i}.reason`]: s.reason }));
  const { messages } = await translator.translate(entries, language);
  return signposts.map((s, i) => ({
    resource: { ...s.resource, title: messages[`${i}.title`], description: messages[`${i}.description`] },
    reason: messages[`${i}.reason`],
  }));
}

export class ResultAgent {
  constructor(
    private readonly llm: LlmClient | null,
    private readonly logger: Logger = console,
    private readonly translator: Pick<Translator, 'translate'> = new Translator(llm, logger),
  ) {}

  async build(answers: readonly AnswerRecord[], progress: Progress, language: Language = ENGLISH): Promise<SessionResult> {
    const topSectors = progress.scores.slice(0, 3).map((s) => ({ ...s, sector: getSector(s.id) }));
    const tags = collectTags(answers);
    // Translated before the narrative is written, so its next steps can name the translated titles.
    const signposts = await localizeSignposts(selectSignposts(progress.scores, tags), language, this.translator);

    if (this.llm) {
      try {
        const { value } = await this.llm.generateJson(buildNarrativeMessages(answers, topSectors, tags, signposts, language), parseNarrative, {
          temperature: 0.6,
        });
        return { topSectors, signposts, narrative: value, narrativeSource: 'ai', progress, tags };
      } catch (err) {
        this.logger.warn(`[result-agent] using template narrative: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const narrative = await this.localizeNarrative(fallbackNarrative(answers, topSectors, signposts), language);
    return { topSectors, signposts, narrative, narrativeSource: 'fallback', progress, tags };
  }

  /** The template narrative is English; its next steps are already built from translated signposts. */
  private async localizeNarrative(narrative: Narrative, language: Language): Promise<Narrative> {
    if (isEnglish(language)) return narrative;
    const entries: Record<string, string> = { headline: narrative.headline, summary: narrative.summary };
    narrative.strengths.forEach((s, i) => (entries[`strength${i}`] = s));
    const { messages } = await this.translator.translate(entries, language);
    return { ...narrative, headline: messages.headline, summary: messages.summary, strengths: narrative.strengths.map((_, i) => messages[`strength${i}`]) };
  }
}
