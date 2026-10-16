import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { SessionResult } from '../../../shared/types.js';

const CONFETTI_COLOURS = ['#005a73', '#97be10', '#fec724', '#c2185b', '#00838f', '#e65100'];

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
  const { narrative, topSectors, signposts, progress } = result;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="results">
      <section className="card results__hero" aria-labelledby="results-title">
        <Confetti />
        <p className="eyebrow">
          Level {progress.level.number} · {progress.level.name} · {progress.xp} XP
        </p>
        <h1 id="results-title" tabIndex={-1} ref={headingRef}>
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
      </section>

      <section aria-labelledby="matches-title">
        <h2 id="matches-title" className="section-title">
          Your top Wigan matches
        </h2>
        <ol className="matches">
          {topSectors.map(({ sector, matchPercent }, i) => (
            <li key={sector.id} className="card match" style={{ '--accent': sector.color } as CSSProperties}>
              <div className="match__head">
                <span className="match__rank">#{i + 1}</span>
                <span className="match__emoji" aria-hidden="true">
                  {sector.emoji}
                </span>
                <h3>{sector.name}</h3>
                <span className="match__pct">{matchPercent}% match</span>
              </div>
              <p>{sector.blurb}</p>
              <ul className="roles">
                {sector.roles.map((r) => (
                  <li key={r.title}>
                    <strong>{r.title}</strong>
                    <span>{r.entry}</span>
                  </li>
                ))}
              </ul>
              <p className="match__evidence">
                <span aria-hidden="true">📊</span> Why Wigan needs you: {sector.evidence}{' '}
                <a href={sector.evidenceUrl} target="_blank" rel="noopener noreferrer">
                  Source<span className="visually-hidden"> (opens in new tab)</span>
                </a>
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card" aria-labelledby="steps-title">
        <h2 id="steps-title" className="section-title">
          Your next steps
        </h2>
        <ol className="next-steps">
          {narrative.nextSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="signposts-title">
        <h2 id="signposts-title" className="section-title">
          Where to get help
        </h2>
        <ul className="signposts">
          {signposts.map(({ resource, reason }) => (
            <li key={resource.id} className={`card signpost signpost--${resource.kind}`}>
              <p className="signpost__provider">{resource.provider}</p>
              <h3 className="signpost__title">{resource.title}</h3>
              <p className="signpost__desc">{resource.description}</p>
              <p className="signpost__reason">
                <span aria-hidden="true">💡</span> {reason}
              </p>
              <div className="signpost__actions">
                <a className="btn btn--secondary" href={resource.url} target="_blank" rel="noopener noreferrer">
                  Visit {resource.title}
                  <span className="visually-hidden"> (opens in new tab)</span> <span aria-hidden="true">↗</span>
                </a>
                {resource.phone && (
                  <a className="signpost__phone" href={`tel:${resource.phone.replace(/\s/g, '')}`}>
                    📞 {resource.phone}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="results__actions no-print">
        <button type="button" className="btn btn--secondary" onClick={() => window.print()}>
          🖨️ Print or save my results
        </button>
        <button type="button" className="btn btn--primary" onClick={onRestart}>
          Start again
        </button>
      </div>
      {result.narrativeSource === 'fallback' && <p className="fine-print">Your summary was put together from our standard template.</p>}
    </div>
  );
}
