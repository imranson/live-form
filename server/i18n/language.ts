import { z } from 'zod';
import { ENGLISH, isEnglish } from '../../shared/i18n.js';
import type { Language } from '../../shared/types.js';
import type { ChatMessage, LlmClient } from '../ollama.js';

const RTL_SCRIPTS = new Set(['Arab', 'Hebr', 'Thaa', 'Syrc', 'Nkoo', 'Adlm', 'Rohg', 'Mand', 'Samr']);
const CODE_PATTERN = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;
const englishNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });

function nameIn(locale: string, code: string): string | undefined {
  try {
    return new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }).of(code);
  } catch {
    return undefined;
  }
}

/**
 * Turns a BCP 47 tag into a Language, or null if it isn't one the runtime knows (rejects invented
 * codes like "zz"). Names come from Intl, never from the model or the resident.
 */
export function languageFromCode(raw: unknown): Language | null {
  if (typeof raw !== 'string' || !CODE_PATTERN.test(raw)) return null;
  let code: string;
  try {
    [code] = Intl.getCanonicalLocales(raw);
  } catch {
    return null;
  }
  const name = code ? englishNames.of(code) : undefined;
  if (!name) return null;
  if (isEnglish({ code })) return ENGLISH;
  const native = nameIn(code, code) ?? name;
  let script: string | undefined;
  try {
    script = new Intl.Locale(code).maximize().script;
  } catch {
    script = undefined;
  }
  return {
    code,
    name,
    nativeName: native.charAt(0).toLocaleUpperCase(code) + native.slice(1),
    dir: script && RTL_SCRIPTS.has(script) ? 'rtl' : 'ltr',
  };
}

const normalise = (s: string) => s.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

let knownNames: Map<string, string> | undefined;

/** English names and endonyms of every two-letter language code the runtime knows (about 190). */
function known(): Map<string, string> {
  if (knownNames) return knownNames;
  knownNames = new Map();
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  for (const a of letters) {
    for (const b of letters) {
      const language = languageFromCode(a + b);
      if (!language) continue;
      for (const n of [language.name, language.nativeName]) if (!knownNames.has(normalise(n))) knownNames.set(normalise(n), language.code);
    }
  }
  return knownNames;
}

export function matchKnownLanguage(input: string): Language | null {
  const code = known().get(normalise(input));
  return code ? languageFromCode(code) : null;
}

export const RESOLVER_SYSTEM_PROMPT = `You work out which human language someone wants a website translated into. They may type the language's name in English, in the language itself or in another language, and may misspell it.

OUTPUT: exactly one JSON object and nothing else: {"code":"<BCP 47 language tag, e.g. pl, pt-BR, ckb, pa-Arab, yue>"}
If the text is not the name of a language, reply {"code":null}.`;

export function buildResolverMessages(input: string): ChatMessage[] {
  return [
    { role: 'system', content: RESOLVER_SYSTEM_PROMPT },
    { role: 'user', content: `Requested language: ${JSON.stringify(input)}` },
  ];
}

const resolverSchema = z.object({ code: z.string().nullable() });

export function parseResolvedLanguage(data: unknown): Language | null {
  const { code } = resolverSchema.parse(data);
  return code ? languageFromCode(code) : null;
}

export class TranslationUnavailableError extends Error {
  constructor() {
    super('Translation isn’t available right now.');
    this.name = 'TranslationUnavailableError';
  }
}

/** Known names resolve instantly; anything else is identified by the model. Null = not a language. */
export async function resolveLanguage(input: string, llm: LlmClient | null): Promise<Language | null> {
  const match = matchKnownLanguage(input);
  if (match) return match;
  if (!llm) throw new TranslationUnavailableError();
  const { value } = await llm.generateJson(buildResolverMessages(input), parseResolvedLanguage, { temperature: 0 });
  return value;
}
