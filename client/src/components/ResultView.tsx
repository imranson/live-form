import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { SessionResult } from '../../../shared/types.js';
import { useI18n } from '../i18n';

const CONFETTI_COLOURS = ['#005a73', '#97be10', '#fec724', '#c2185b', '#00838f', '#e65100'];

const TABS = [
  { id: 'you', label: 'results.tabYou' },
  { id: 'jobs', label: 'results.tabJobs' },
  { id: 'steps', label: 'results.tabSteps' },
  { id: 'help', label: 'results.tabHelp' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          style={
            {
              '--x': `${(i * 37) % 100}%`,
              '--delay': `${(i % 7) * 0.12}s`,
              '--spin': `${(i * 53) % 360}deg`,
              background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function ResultView({ result, onRestart }: { result: SessionResult; onRestart: () => void }) {
  const { t, sector: localized, badge, level } = useI18n();
  const { narrative, topSectors, signposts, progress } = result;
  const newTab = <span className="visually-hidden"> {t('results.newTab')}</span>;
  const [tab, setTab] = useState<TabId>('you');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  useEffect(() => headingRef.current?.focus(), []);

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(TABS.findIndex((item) => item.id === tab) + step + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const panel = (id: TabId) => ({ role: 'tabpanel', id: `panel-${id}`, 'aria-labelledby': `tab-${id}`, hidden: tab !== id }) as const;

  return (
    <div className="results">
      <div className="tabs no-print" role="tablist" aria-label={t('results.tabs')} onKeyDown={onTabKey}>
        {TABS.map((item) => (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[item.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-controls={`panel-${item.id}`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            className="tab"
            onClick={() => setTab(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      <section className="card results__hero" {...panel('you')}>
        <Confetti />
        <p className="eyebrow">{t('results.eyebrow', { level: progress.level.number, name: level(progress.level), xp: progress.xp })}</p>
        <h1 tabIndex={-1} ref={headingRef}>
          {narrative.headline}
        </h1>
        <p className="lede">{narrative.summary}</p>
        <ul className="strengths" aria-label={t('results.strengths')}>
          {narrative.strengths.map((s) => (
            <li key={s} className="strength">
              💪 {s}
            </li>
          ))}
        </ul>
        <ul className="badges" aria-label={t('results.badges')}>
          {progress.badges.map(badge).map((b) => (
            <li key={b.id} className="badge" title={b.description}>
              <span aria-hidden="true">{b.emoji}</span> {b.name}
            </li>
          ))}
        </ul>
        {result.narrativeSource === 'fallback' && <p className="fine-print">{t('results.template')}</p>}
      </section>

      <section className="card" {...panel('jobs')}>
        <h2 className="section-title">{t('results.jobsTitle')}</h2>
        <ol className="matches">
          {topSectors.map(({ sector: { id }, matchPercent }, i) => {
            const sector = localized(id);
            return (
              <li key={sector.id} className="match" style={{ '--accent': sector.color } as CSSProperties}>
                <details name="match" open={i === 0}>
                  <summary className="match__head">
                    <span className="match__emoji" aria-hidden="true">
                      {sector.emoji}
                    </span>
                    <h3>{sector.name}</h3>
                    <span className="match__pct">{matchPercent}%</span>
                  </summary>
                  <p className="match__blurb">{sector.blurb}</p>
                  <ul className="roles">
                    {sector.roles.map((r) => (
                      <li key={r.title}>
                        <strong>{r.title}</strong>
                        <span>{r.entry}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="match__evidence">
                    <span aria-hidden="true">📊</span> {sector.evidence}{' '}
                    <a href={sector.evidenceUrl} target="_blank" rel="noopener noreferrer">
                      {t('results.source')}
                      {newTab}
                    </a>
                  </p>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card" {...panel('steps')}>
        <h2 className="section-title">{t('results.stepsTitle')}</h2>
        <ol className="next-steps">
          {narrative.nextSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="card" {...panel('help')}>
        <h2 className="section-title">{t('results.helpTitle')}</h2>
        <ul className="signposts">
          {signposts.map(({ resource, reason }) => (
            <li key={resource.id} className={`signpost signpost--${resource.kind}`}>
              <h3 className="signpost__title">
                <a href={resource.url} target="_blank" rel="noopener noreferrer">
                  {resource.title}
                  {newTab} <span aria-hidden="true">↗</span>
                </a>
              </h3>
              <p className="signpost__reason">{reason}</p>
              {resource.phone && (
                <a className="signpost__phone" href={`tel:${resource.phone.replace(/\s/g, '')}`}>
                  📞 {resource.phone}
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="results__actions no-print">
        <button type="button" className="btn btn--secondary" onClick={() => window.print()}>
          🖨️ {t('results.print')}
        </button>
        <button type="button" className="btn btn--primary" onClick={onRestart}>
          {t('common.startAgain')}
        </button>
      </div>
    </div>
  );
}
