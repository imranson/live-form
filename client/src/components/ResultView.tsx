import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { SessionResult } from '../../../shared/types.js';

const CONFETTI_COLOURS = ['#005a73', '#97be10', '#fec724', '#c2185b', '#00838f', '#e65100'];

const TABS = [
  { id: 'you', label: 'You' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'steps', label: 'Next steps' },
  { id: 'help', label: 'Help' },
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

const newTab = <span className="visually-hidden"> (opens in new tab)</span>;

export function ResultView({ result, onRestart }: { result: SessionResult; onRestart: () => void }) {
  const { narrative, topSectors, signposts, progress } = result;
  const [tab, setTab] = useState<TabId>('you');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  useEffect(() => headingRef.current?.focus(), []);

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(TABS.findIndex((t) => t.id === tab) + step + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const panel = (id: TabId) => ({ role: 'tabpanel', id: `panel-${id}`, 'aria-labelledby': `tab-${id}`, hidden: tab !== id }) as const;

  return (
    <div className="results">
      <div className="tabs no-print" role="tablist" aria-label="Your results" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-controls={`panel-${t.id}`}
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="card results__hero" {...panel('you')}>
        <Confetti />
        <p className="eyebrow">
          Level {progress.level.number} · {progress.level.name} · {progress.xp} XP
        </p>
        <h1 tabIndex={-1} ref={headingRef}>
          {narrative.headline}
        </h1>
        <p className="lede">{narrative.summary}</p>
        <ul className="strengths" aria-label="Your strengths">
          {narrative.strengths.map((s) => (
            <li key={s} className="strength">
              💪 {s}
            </li>
          ))}
        </ul>
        <ul className="badges" aria-label="Badges earned">
          {progress.badges.map((b) => (
            <li key={b.id} className="badge" title={b.description}>
              <span aria-hidden="true">{b.emoji}</span> {b.name}
            </li>
          ))}
        </ul>
        {result.narrativeSource === 'fallback' && <p className="fine-print">This summary uses a standard template.</p>}
      </section>

      <section className="card" {...panel('jobs')}>
        <h2 className="section-title">Your top job matches</h2>
        <ol className="matches">
          {topSectors.map(({ sector, matchPercent }, i) => (
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
                    Source{newTab}
                  </a>
                </p>
              </details>
            </li>
          ))}
        </ol>
      </section>

      <section className="card" {...panel('steps')}>
        <h2 className="section-title">Your next steps</h2>
        <ol className="next-steps">
          {narrative.nextSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="card" {...panel('help')}>
        <h2 className="section-title">Where to get help</h2>
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
          🖨️ Print or save
        </button>
        <button type="button" className="btn btn--primary" onClick={onRestart}>
          Start again
        </button>
      </div>
    </div>
  );
}
