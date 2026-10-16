import type { CSSProperties } from 'react';
import { SECTORS } from '../../../shared/sectors.js';

export function Intro({ onStart, questionCount = 8 }: { onStart: () => void; questionCount?: number }) {
  return (
    <section className="card intro" aria-labelledby="intro-title">
      <p className="eyebrow">Your future, your borough</p>
      <h1 id="intro-title">Find your future in Wigan</h1>
      <p className="lede">
        Answer {questionCount} quick questions, written live by our AI careers guide, and discover the in-demand local jobs that could suit you – plus
        exactly where to get help to start.
      </p>

      <ul className="intro__perks">
        <li>
          <span aria-hidden="true">⏱️</span> About 3 minutes
        </li>
        <li>
          <span aria-hidden="true">🎮</span> Earn XP and badges
        </li>
        <li>
          <span aria-hidden="true">🤖</span> Questions built around you
        </li>
        <li>
          <span aria-hidden="true">🧭</span> Real local support at the end
        </li>
      </ul>

      <h2 className="intro__subhead">Wigan employers need people in</h2>
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
      <p className="fine-print">No sign-up. No names. Just tap the answers that feel right.</p>
    </section>
  );
}
