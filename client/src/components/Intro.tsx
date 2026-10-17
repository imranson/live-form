import type { CSSProperties } from 'react';
import { SECTORS } from '../../../shared/sectors.js';
import { useI18n } from '../i18n';
import { LanguagePicker } from './LanguagePicker';

export function Intro({
  onStart,
  onTranslate,
  questionCount = 8,
}: {
  onStart: () => void;
  onTranslate?: (language: string) => Promise<void>;
  questionCount?: number;
}) {
  const { t, sector } = useI18n();
  return (
    <section className="card intro" aria-labelledby="intro-title">
      <h1 id="intro-title">{t('intro.title')}</h1>
      <p className="lede">{t('intro.lede', { count: questionCount })}</p>

      <ul className="intro__perks">
        <li>
          <span aria-hidden="true">⏱️</span> {t('intro.perkTime')}
        </li>
        <li>
          <span aria-hidden="true">🏅</span> {t('intro.perkBadges')}
        </li>
        <li>
          <span aria-hidden="true">🔒</span> {t('intro.perkPrivacy')}
        </li>
      </ul>

      <h2 className="intro__subhead">{t('intro.sectorsHeading')}</h2>
      <ul className="sector-chips" aria-label={t('intro.sectorsLabel')}>
        {SECTORS.map((s) => (
          <li key={s.id} className="sector-chip" style={{ '--chip': s.color } as CSSProperties}>
            <span aria-hidden="true">{s.emoji}</span> {sector(s.id).name}
          </li>
        ))}
      </ul>

      {onTranslate && <LanguagePicker onTranslate={onTranslate} />}

      <button type="button" className="btn btn--primary btn--xl" onClick={onStart}>
        {t('intro.start')} <span className="arrow" aria-hidden="true">→</span>
      </button>
    </section>
  );
}
