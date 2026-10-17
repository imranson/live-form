// Every fixed piece of text the resident reads, in English. Other languages are machine-translated
// from this catalog by the server (see server/i18n/translator.ts) and cached per language.
import { BADGES, LEVELS } from './game.js';
import { SECTORS, type Sector } from './sectors.js';
import type { Badge, Language, TranslationResponse } from './types.js';

export const UI_MESSAGES = {
  'header.home': 'Wigan Council home',
  'header.service': 'Jobs & Skills',
  'header.prototype': 'Prototype',
  'footer.text': 'We don’t ask for your name. Answers are deleted after 1 hour. Questions are written by AI; links go to trusted services.',

  'intro.title': 'Find your future in Wigan',
  'intro.lede': 'Answer {count} quick questions. See which local jobs suit you and where to get help.',
  'intro.perkTime': '3 minutes',
  'intro.perkBadges': 'Earn badges',
  'intro.perkPrivacy': 'No sign-up',
  'intro.sectorsHeading': 'Wigan needs people in',
  'intro.sectorsLabel': 'In-demand sectors',
  'intro.start': 'Let’s go',

  'language.label': 'Language',
  'language.submit': 'Translate',
  'language.working': 'Translating… the first time can take up to 30 seconds.',
  'language.notice': 'Translated by AI, so some words may not be quite right. Links go to English websites.',
  'language.partial': 'Some words are still in English.',
  'language.errorInvalid': 'Type the name of a language, using letters only.',
  'language.errorUnknown': 'We couldn’t recognise that language. Try its name in English or in the language itself.',
  'language.errorUnavailable': 'Translation isn’t available right now. Please try again later.',

  'hud.label': 'Your progress',
  'hud.count': 'Question {current} of {total}',
  'hud.level': 'Level {level}',
  'hud.xpLabel': 'XP towards next level',
  'hud.xp': '{xp} XP',
  'hud.xpGain': '+{xp} XP',

  'meter.title': 'Your matches',
  'meter.hintEmpty': 'Answer to see them.',
  'meter.hint': 'Updates as you answer.',
  'meter.top': 'Top',

  'question.ai': 'Written by AI',
  'question.standard': 'Standard question',
  'question.picked': '{count} of {max} picked',
  'question.continue': 'Continue',

  'thinking.start1': 'Getting ready…',
  'thinking.start2': 'Checking local jobs…',
  'thinking.start3': 'Writing your first question…',
  'thinking.next1': 'Saving your answer…',
  'thinking.next2': 'Updating your matches…',
  'thinking.next3': 'Writing the next question…',
  'thinking.result1': 'Adding up your answers…',
  'thinking.result2': 'Finding help near you…',
  'thinking.result3': 'Writing your results…',

  'toast.newBadge': 'New badge: {name}',

  'results.tabs': 'Your results',
  'results.tabYou': 'You',
  'results.tabJobs': 'Jobs',
  'results.tabSteps': 'Next steps',
  'results.tabHelp': 'Help',
  'results.eyebrow': 'Level {level} · {name} · {xp} XP',
  'results.strengths': 'Your strengths',
  'results.badges': 'Badges earned',
  'results.template': 'This summary uses a standard template.',
  'results.jobsTitle': 'Your top job matches',
  'results.source': 'Source',
  'results.newTab': '(opens in new tab)',
  'results.stepsTitle': 'Your next steps',
  'results.helpTitle': 'Where to get help',
  'results.print': 'Print or save',

  'common.startAgain': 'Start again',
  'error.title': 'Something went wrong',
  'error.retry': 'Try again',
  'error.offline': 'Can’t connect. Check your internet and try again.',
  'error.expired': 'Session not found or expired. Please start again.',
  'error.generic': 'Something went wrong. Please try again.',
} as const;

export type UiKey = keyof typeof UI_MESSAGES;
export type Messages = Readonly<Record<string, string>>;

export const ENGLISH: Language = { code: 'en-GB', name: 'English', nativeName: 'English', dir: 'ltr' };

export function isEnglish(language: Pick<Language, 'code'>): boolean {
  return language.code === 'en' || language.code.startsWith('en-');
}

/** UI strings plus the sector, badge and level text that ships in shared code. */
export function sourceCatalog(): Record<string, string> {
  const out: Record<string, string> = { ...UI_MESSAGES };
  for (const s of SECTORS) {
    const p = `sector.${s.id}`;
    Object.assign(out, { [`${p}.name`]: s.name, [`${p}.shortName`]: s.shortName, [`${p}.blurb`]: s.blurb, [`${p}.evidence`]: s.evidence });
    s.roles.forEach((r, i) => Object.assign(out, { [`${p}.role${i}.title`]: r.title, [`${p}.role${i}.entry`]: r.entry }));
  }
  for (const b of Object.values(BADGES)) Object.assign(out, { [`badge.${b.id}.name`]: b.name, [`badge.${b.id}.description`]: b.description });
  for (const l of LEVELS) out[`level.${l.number}`] = l.name;
  return out;
}

export const ENGLISH_TRANSLATION: TranslationResponse = { language: ENGLISH, messages: sourceCatalog(), complete: true };

/** Changes whenever the English catalog does, so stale cached translations can be ignored. */
export const CATALOG_VERSION = (() => {
  let h = 5381;
  for (const ch of JSON.stringify(ENGLISH_TRANSLATION.messages)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
})();

const PLACEHOLDER = /\{(\w+)\}/g;

export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();
}

export function format(template: string, vars: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(PLACEHOLDER, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function localizeSector(sector: Sector, messages: Messages): Sector {
  const p = `sector.${sector.id}`;
  return {
    ...sector,
    name: messages[`${p}.name`] ?? sector.name,
    shortName: messages[`${p}.shortName`] ?? sector.shortName,
    blurb: messages[`${p}.blurb`] ?? sector.blurb,
    evidence: messages[`${p}.evidence`] ?? sector.evidence,
    roles: sector.roles.map((r, i) => ({ title: messages[`${p}.role${i}.title`] ?? r.title, entry: messages[`${p}.role${i}.entry`] ?? r.entry })),
  };
}

export function localizeBadge(badge: Badge, messages: Messages): Badge {
  return { ...badge, name: messages[`badge.${badge.id}.name`] ?? badge.name, description: messages[`badge.${badge.id}.description`] ?? badge.description };
}

export function levelName(level: { number: number; name: string }, messages: Messages): string {
  return messages[`level.${level.number}`] ?? level.name;
}
