import { z } from 'zod';
import { SECTOR_IDS, isSectorId, type Sector, type SectorId } from './sectors.js';
import { TOPIC_IDS, isProfileTag, type ProfileTag, type TopicId } from './profile.js';

export const MIN_OPTIONS = 3;
export const MAX_OPTIONS = 6;
export const SIGNAL_MIN = -2;
export const SIGNAL_MAX = 3;

export type Signals = Partial<Record<SectorId, number>>;

export interface Option {
  id: string;
  label: string;
  emoji: string;
  signals: Signals;
  tags: ProfileTag[];
}

export interface Question {
  id: string;
  number: number;
  topic: TopicId;
  kind: 'single' | 'multi';
  title: string;
  helper?: string;
  agentNote: string;
  options: Option[];
  maxSelections: number;
  source: 'ai' | 'fallback';
}

export interface AnswerRecord {
  question: Question;
  optionIds: string[];
}

const clip = (max: number) => z.string().trim().min(1).transform((s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s));

/** Accepts sloppy model output and turns it into clean signals: unknown sectors dropped, weights rounded and clamped. */
const signalsSchema = z
  .record(z.string(), z.unknown())
  .catch({})
  .transform((raw) => {
    const out: Signals = {};
    for (const [key, value] of Object.entries(raw)) {
      const n = typeof value === 'string' ? Number(value) : value;
      if (!isSectorId(key) || typeof n !== 'number' || !Number.isFinite(n)) continue;
      const w = Math.max(SIGNAL_MIN, Math.min(SIGNAL_MAX, Math.round(n)));
      if (w !== 0) out[key] = w;
    }
    return out;
  });

const tagsSchema = z
  .array(z.unknown())
  .catch([])
  .transform((raw) => [...new Set(raw.filter(isProfileTag))]);

const firstGrapheme = (s: string) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)][0]?.segment ?? '';

export const llmOptionSchema = z.object({
  label: clip(70),
  emoji: z
    .string()
    .catch('')
    .transform((s) => firstGrapheme(s.trim()) || '✨'),
  signals: signalsSchema.optional().transform((s) => s ?? {}),
  tags: tagsSchema.optional().transform((t) => t ?? []),
});

/** Shape the question agent must return. Ids and numbering are assigned by the server, never trusted from the model. */
export const llmQuestionSchema = z.object({
  topic: z.enum(TOPIC_IDS as [TopicId, ...TopicId[]]),
  kind: z.enum(['single', 'multi']).catch('single'),
  title: clip(140),
  helper: clip(200).optional().catch(undefined),
  agentNote: clip(220).catch('Let’s keep going!'),
  options: z
    .array(llmOptionSchema)
    .min(MIN_OPTIONS)
    .transform((opts) => {
      const seen = new Set<string>();
      return opts
        .filter((o) => {
          const key = o.label.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, MAX_OPTIONS);
    })
    .refine((opts) => opts.length >= MIN_OPTIONS, `Need at least ${MIN_OPTIONS} distinct options`),
  maxSelections: z.coerce.number().int().min(2).max(4).optional().catch(undefined),
});

export type LlmQuestion = z.infer<typeof llmQuestionSchema>;

export const answerBodySchema = z.object({
  questionId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1).max(MAX_OPTIONS),
});

export const llmNarrativeSchema = z.object({
  headline: clip(90),
  summary: clip(600),
  strengths: z.array(clip(80)).min(1).transform((a) => a.slice(0, 3)),
  nextSteps: z.array(clip(160)).min(1).transform((a) => a.slice(0, 4)),
});

export type Narrative = z.infer<typeof llmNarrativeSchema>;

export interface SectorScore {
  id: SectorId;
  score: number;
  matchPercent: number;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface Progress {
  answered: number;
  target: number;
  xp: number;
  level: { number: number; name: string; floorXp: number; nextXp: number | null };
  badges: Badge[];
  newBadges: Badge[];
  scores: SectorScore[];
}

export interface Resource {
  id: string;
  title: string;
  provider: string;
  url: string;
  description: string;
  phone?: string;
  kind: 'council' | 'training' | 'jobs' | 'support' | 'careers';
}

export interface Signpost {
  resource: Resource;
  reason: string;
}

export interface SessionResult {
  topSectors: (SectorScore & { sector: Sector })[];
  signposts: Signpost[];
  narrative: Narrative;
  narrativeSource: 'ai' | 'fallback';
  progress: Progress;
  tags: ProfileTag[];
}

export interface StartResponse {
  sessionId: string;
  question: Question;
  progress: Progress;
}

export interface AnswerResponse {
  complete: boolean;
  question: Question | null;
  progress: Progress;
}

export { SECTOR_IDS };
