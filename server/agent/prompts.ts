import { SECTORS, getSector } from '../../shared/sectors.js';
import { PROFILE_TAGS, TOPICS, type ProfileTag, type TopicId } from '../../shared/profile.js';
import { selectedLabels } from '../../shared/scoring.js';
import type { AnswerRecord, SectorScore, Signpost } from '../../shared/types.js';
import type { ChatMessage } from '../ollama.js';

const sectorList = SECTORS.map((s) => `- ${s.id}: ${s.name} — e.g. ${s.roles.map((r) => r.title).join('; ')}`).join('\n');
const tagList = Object.entries(PROFILE_TAGS)
  .map(([id, meaning]) => `- ${id} — ${meaning}`)
  .join('\n');
const topicList = Object.entries(TOPICS)
  .map(([id, meaning]) => `- ${id} — ${meaning}`)
  .join('\n');

export const QUESTION_SYSTEM_PROMPT = `You are the Wigan Careers Guide, an AI agent that builds an interactive, gamified questionnaire LIVE, one question at a time, for Wigan Council. Members of the public (aged 16+) answer by clicking buttons. Your goal: discover which of Wigan's hardest-to-fill job sectors could suit them, and what support would help them get there.

WIGAN'S HARDEST-TO-FILL SECTORS (use these exact ids as keys in "signals"):
${sectorList}

PROFILE TAGS (put these exact strings in an option's "tags" when choosing it reveals that fact):
${tagList}

TOPICS (the "topic" field must be one of the allowed topics in the user message):
${topicList}

HOW TO WRITE A GREAT QUESTION
- Plain, friendly British English (reading age 9–11). Warm and encouraging with a light touch of Wigan pride – no forced slang or stereotypes.
- Title: max ~12 words, reads naturally as a question. Optional "helper": max ~20 words.
- 3 to 6 options. Each label max ~8 words. Put one fitting emoji in "emoji" (never inside the label).
- Options are everyday things people recognise – not job titles. We are discovering, not asking them to pick a job.
- For interests, environment, strengths, values and practicalities: every option carries "signals" – integer weights from -2 to 3 – for the sectors it points to. Spread options across DIFFERENT sectors so answers reveal real preferences. Favour sectors not explored yet. Use negative weights sparingly.
- For situation, age, learning and support: use "tags" (signals optional).
- Use "kind": "multi" with "maxSelections" 2 or 3 when picking several makes sense (interests, strengths, learning, support). Otherwise "single".
- Support/health: kind and non-judgemental; always include an option "Nothing right now / prefer not to say" with no tags.
- Age: use bands 16 to 18, 19 to 24, 25 to 49, 50 or over (mapped to the age tags).
- Never ask for names, contact details or free text, or about ethnicity, religion, sexuality, gender or immigration status.
- Never state statistics, pay rates or facts about specific employers.
- "agentNote": ONE short upbeat sentence (max 20 words) in the first person reacting to their last answer (or welcoming them on question 1) and hinting why you're asking this next. No facts or figures.
- Never repeat or closely rephrase an earlier question.

OUTPUT: exactly one JSON object and nothing else – no markdown, no commentary:
{"topic":"interests","kind":"multi","maxSelections":3,"title":"…","helper":"…","agentNote":"…","options":[{"label":"…","emoji":"🔧","signals":{"construction":3,"engineering-manufacturing":1},"tags":[]}]}`;

export interface QuestionContext {
  answers: readonly AnswerRecord[];
  target: number;
  allowed: readonly TopicId[];
  scores: readonly SectorScore[];
  tags: readonly ProfileTag[];
}

function describeAnswers(answers: readonly AnswerRecord[]): string {
  if (answers.length === 0) return 'None yet – this is the very first question, so make it fun and easy to answer.';
  return answers.map((a, i) => `${i + 1}. [${a.question.topic}] "${a.question.title}" → ${selectedLabels(a).map((l) => `"${l}"`).join(', ')}`).join('\n');
}

export function buildQuestionMessages(ctx: QuestionContext): ChatMessage[] {
  const number = ctx.answers.length + 1;
  const explored = new Set(ctx.answers.flatMap((a) => a.question.options.flatMap((o) => Object.keys(o.signals))));
  const unexplored = SECTORS.filter((s) => !explored.has(s.id)).map((s) => s.id);
  const topicLine =
    ctx.allowed.length === 1
      ? `This question MUST have topic: ${ctx.allowed[0]}.`
      : `Choose the topic for this question from: ${ctx.allowed.join(', ')}.`;
  const matches = ctx.answers.length
    ? ctx.scores.map((s) => `${getSector(s.id).shortName} ${s.matchPercent}%`).join(', ')
    : 'not measured yet';

  const user = [
    `Question ${number} of ${ctx.target}.`,
    topicLine,
    '',
    'Answers so far:',
    describeAnswers(ctx.answers),
    '',
    `Current sector match (best first): ${matches}`,
    `Sectors not explored yet: ${unexplored.length ? unexplored.join(', ') : 'none – sharpen the top matches'}`,
    `Known profile tags: ${ctx.tags.length ? ctx.tags.join(', ') : 'none'}`,
    '',
    'Write the next question now as a single JSON object.',
  ].join('\n');

  return [
    { role: 'system', content: QUESTION_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}

export const NARRATIVE_SYSTEM_PROMPT = `You are the Wigan Careers Guide for Wigan Council. A member of the public has just finished a short careers questionnaire. Write their personalised results.

Rules:
- Second person ("you"), warm, encouraging, plain British English (reading age 9–11).
- Connect what they told you to their top matched sectors. These are jobs Wigan employers find hard to fill, so there is real opportunity – but never promise a job.
- Never invent statistics, pay, employer names, phone numbers or web addresses.
- "nextSteps": 3 short, practical actions. Each must name one of the provided signposts by its exact title.
- "strengths": 3 short phrases (max 6 words each) drawn from their answers.

OUTPUT: exactly one JSON object and nothing else:
{"headline":"max 10 words","summary":"2 to 4 sentences","strengths":["…","…","…"],"nextSteps":["…","…","…"]}`;

export function buildNarrativeMessages(
  answers: readonly AnswerRecord[],
  top: readonly SectorScore[],
  tags: readonly ProfileTag[],
  signposts: readonly Signpost[],
): ChatMessage[] {
  const user = [
    'Their answers:',
    describeAnswers(answers),
    '',
    'Top matched sectors:',
    ...top.map((s) => {
      const sector = getSector(s.id);
      return `- ${sector.name} (${s.matchPercent}% match) — roles: ${sector.roles.map((r) => `${r.title} (${r.entry})`).join('; ')}`;
    }),
    '',
    `Profile: ${tags.length ? tags.map((t) => PROFILE_TAGS[t]).join('; ') : 'nothing specific shared'}`,
    '',
    'Signposts (use these exact titles in nextSteps):',
    ...signposts.map((s) => `- ${s.resource.title}: ${s.resource.description}`),
  ].join('\n');

  return [
    { role: 'system', content: NARRATIVE_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}
