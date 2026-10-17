import { z } from 'zod';
import { isEnglish, placeholdersOf, sourceCatalog } from '../../shared/i18n.js';
import type { Language, TranslationResponse } from '../../shared/types.js';
import type { Logger } from '../agent/questionAgent.js';
import type { ChatMessage, LlmClient } from '../ollama.js';
import { resolveLanguage } from './language.js';

const LINK_PATTERN = /https?:\/\/|www\./i;

export const TRANSLATE_SYSTEM_PROMPT = `You translate short pieces of text for Wigan Council's public careers website. Readers are members of the public, some still learning the language.

Rules:
- Translate every value of the JSON object. Keep the keys exactly as they are.
- Translate everything a resident needs to understand, including job titles, sector names, qualifications, badge names and short labels.
- Plain, friendly, everyday words (reading age 9–11).
- Keep anything in {curly braces} exactly as it is, untranslated.
- Keep emoji, numbers and symbols such as "…" and "·".
- Only proper names stay as they are: places (Wigan, Greater Manchester, M6), organisations (Wigan Council, NHS, Jobcentre Plus) and named schemes (Skills Bootcamps).
- Never add links, notes or explanations.

OUTPUT: exactly one JSON object with the same keys and the translated text as values, and nothing else.`;

export function buildTranslateMessages(sources: readonly string[], language: Language): ChatMessage[] {
  const payload = Object.fromEntries(sources.map((s, i) => [String(i + 1), s]));
  return [
    { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
    { role: 'user', content: `Translate every value into ${language.name} (${language.code}).\n\n${JSON.stringify(payload)}` },
  ];
}

/**
 * Rejects the whole chunk if any string is missing, lost a {placeholder}, gained a link or ballooned,
 * or if the model just echoed most of the English back (seen with long chunks of job titles).
 */
export function parseTranslations(data: unknown, sources: readonly string[]): string[] {
  const out = z.record(z.string(), z.unknown()).parse(data);
  const translated = sources.map((source, i) => {
    const value = out[String(i + 1)];
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing translation for #${i + 1}`);
    const text = value.trim();
    if (placeholdersOf(text).join() !== placeholdersOf(source).join()) throw new Error(`Placeholders changed in #${i + 1}`);
    if (LINK_PATTERN.test(text) && !LINK_PATTERN.test(source)) throw new Error(`Link added in #${i + 1}`);
    if (text.length > source.length * 3 + 20) throw new Error(`Translation #${i + 1} is too long`);
    return text;
  });
  const echoed = translated.filter((text, i) => text === sources[i]).length;
  if (sources.length >= 4 && echoed > sources.length / 2) throw new Error(`${echoed} of ${sources.length} strings came back untranslated`);
  return translated;
}

function touch<V>(map: Map<string, V>, key: string, create: () => V, max: number): V {
  const existing = map.get(key);
  if (existing !== undefined) map.delete(key);
  const value = existing ?? create();
  map.set(key, value);
  if (map.size > max) map.delete(map.keys().next().value!);
  return value;
}

export interface TranslatorOptions {
  chunkSize?: number;
  maxLanguages?: number;
}

/**
 * Machine-translates fixed English text with the same LLM that writes the questions. Results are
 * cached per language by source string, so each string is translated at most once per language.
 * Never throws: anything it can't translate stays in English and `complete` is false.
 */
export class Translator {
  private readonly memo = new Map<string, Map<string, string>>();
  private readonly catalogs = new Map<string, Promise<TranslationResponse>>();
  private readonly chunkSize: number;
  private readonly maxLanguages: number;

  constructor(
    private readonly llm: LlmClient | null,
    private readonly logger: Logger = console,
    options: TranslatorOptions = {},
  ) {
    // Smaller chunks translate more reliably; they run in parallel, so the wait barely changes.
    this.chunkSize = options.chunkSize ?? 20;
    this.maxLanguages = options.maxLanguages ?? 50;
  }

  get available(): boolean {
    return this.llm !== null;
  }

  resolve(input: string): Promise<Language | null> {
    return resolveLanguage(input, this.llm);
  }

  async translate<K extends string>(entries: Readonly<Record<K, string>>, language: Language): Promise<{ messages: Record<K, string>; complete: boolean }> {
    const source = entries as Readonly<Record<string, string>>;
    if (isEnglish(language)) return { messages: { ...source } as Record<K, string>, complete: true };

    const memo = touch(this.memo, language.code, () => new Map<string, string>(), this.maxLanguages);
    const missing = [...new Set(Object.values(source))].filter((s) => !memo.has(s));
    let complete = true;
    if (missing.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < missing.length; i += this.chunkSize) chunks.push(missing.slice(i, i + this.chunkSize));
      const results = await Promise.all(chunks.map((chunk) => this.translateChunk(chunk, language)));
      results.forEach((translated, i) => {
        if (translated) chunks[i].forEach((s, j) => memo.set(s, translated[j]));
        else complete = false;
      });
    }

    const messages = Object.fromEntries(Object.entries(source).map(([key, text]) => [key, memo.get(text) ?? text]));
    return { messages: messages as Record<K, string>, complete };
  }

  /** The whole client catalog for one language. Shared by concurrent requests; retried later if incomplete. */
  catalog(language: Language): Promise<TranslationResponse> {
    const existing = this.catalogs.get(language.code);
    if (existing) return existing;
    const pending = this.translate(sourceCatalog(), language).then(({ messages, complete }) => ({ language, messages, complete }));
    touch(this.catalogs, language.code, () => pending, this.maxLanguages);
    pending.then(
      (r) => r.complete || this.catalogs.delete(language.code),
      () => this.catalogs.delete(language.code),
    );
    return pending;
  }

  private async translateChunk(sources: string[], language: Language): Promise<string[] | null> {
    if (!this.llm) return null;
    try {
      const { value } = await this.llm.generateJson(buildTranslateMessages(sources, language), (data) => parseTranslations(data, sources), {
        temperature: 0.2,
      });
      return value;
    } catch (err) {
      this.logger.warn(`[translator] ${sources.length} strings left in English for ${language.code}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
