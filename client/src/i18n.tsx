import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CATALOG_VERSION,
  ENGLISH_TRANSLATION,
  format,
  isEnglish,
  levelName,
  localizeBadge,
  localizeSector,
  UI_MESSAGES,
  type UiKey,
} from '../../shared/i18n.js';
import { getSector, type Sector, type SectorId } from '../../shared/sectors.js';
import type { Badge, Language, TranslationResponse } from '../../shared/types.js';

type Vars = Readonly<Record<string, string | number>>;

export interface I18n {
  language: Language;
  english: boolean;
  /** False when the server could only translate part of the text. */
  complete: boolean;
  t(key: UiKey, vars?: Vars): string;
  /** Like t(), but placeholders can be elements, e.g. a <strong> number. */
  rich(key: UiKey, vars: Readonly<Record<string, ReactNode>>): ReactNode;
  sector(id: SectorId): Sector;
  badge(badge: Badge): Badge;
  level(level: { number: number; name: string }): string;
  /** null switches back to English. */
  setTranslation(translation: TranslationResponse | null): void;
}

function createI18n(translation: TranslationResponse, setTranslation: I18n['setTranslation']): I18n {
  const { language, messages, complete } = translation;
  const text = (key: UiKey) => messages[key] ?? UI_MESSAGES[key];
  return {
    language,
    english: isEnglish(language),
    complete,
    t: (key, vars) => format(text(key), vars),
    rich: (key, vars) =>
      text(key)
        .split(/(\{\w+\})/)
        .map((part, i) => {
          const name = /^\{(\w+)\}$/.exec(part)?.[1];
          return <Fragment key={i}>{name && name in vars ? vars[name] : part}</Fragment>;
        }),
    sector: (id) => localizeSector(getSector(id), messages),
    badge: (badge) => localizeBadge(badge, messages),
    level: (level) => levelName(level, messages),
    setTranslation,
  };
}

// Components rendered without a provider (e.g. in unit tests) get plain English.
const I18nContext = createContext<I18n>(createI18n(ENGLISH_TRANSLATION, () => undefined));

export const useI18n = () => useContext(I18nContext);

const STORAGE_KEY = 'live-form:translation';

function loadSaved(): TranslationResponse | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { version?: string; translation?: TranslationResponse } | null;
    const t = saved?.translation;
    if (saved?.version !== CATALOG_VERSION || typeof t?.language?.code !== 'string' || typeof t.messages !== 'object') return null;
    return t;
  } catch {
    return null;
  }
}

function save(translation: TranslationResponse | null) {
  try {
    if (translation && !isEnglish(translation.language)) localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CATALOG_VERSION, translation }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode etc.) – the choice just won't survive a reload.
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [translation, setState] = useState<TranslationResponse>(() => loadSaved() ?? ENGLISH_TRANSLATION);

  const setTranslation = useCallback((next: TranslationResponse | null) => {
    setState(next ?? ENGLISH_TRANSLATION);
    save(next);
  }, []);

  const { code, dir } = translation.language;
  useEffect(() => {
    document.documentElement.lang = code;
    document.documentElement.dir = dir;
  }, [code, dir]);

  const value = useMemo(() => createI18n(translation, setTranslation), [translation, setTranslation]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
