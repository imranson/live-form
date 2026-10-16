import type { CSSProperties } from 'react';
import { SECTORS } from '../../../shared/sectors.js';

export function Intro({ onStart, questionCount = 8 }: { onStart: () => void; questionCount?: number }) {
  return (
    <section className="card intro" aria-labelledby="intro-title">
      <h1 id="intro-title">Find your future in Wigan</h1>
      <p className="lede">Answer {questionCount} quick questions. See which local jobs suit you and where to get help.</p>

      <ul className="intro__perks">
        <li>
          <span aria-hidden="true">⏱️</span> 3 minutes
        </li>
        <li>
          <span aria-hidden="true">🏅</span> Earn badges
        </li>
        <li>
          <span aria-hidden="true">🔒</span> No sign-up
        </li>
      </ul>

      <h2 className="intro__subhead">Wigan needs people in</h2>
      <ul className="sector-chips" aria-label="In-demand sectors">
        {SECTORS.map((s) => (
          <li key={s.id} className="sector-chip" style={{ '--chip': s.color } as CSSProperties}>
            <span aria-hidden="true">{s.emoji}</span> {s.name}
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn--primary btn--xl" onClick={onStart}>
        Let’s go <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
