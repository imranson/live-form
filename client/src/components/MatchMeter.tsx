import { getSector } from '../../../shared/sectors.js';
import type { SectorScore } from '../../../shared/types.js';

export function MatchMeter({ scores, answered }: { scores: readonly SectorScore[]; answered: number }) {
  const leader = answered > 0 && scores[0]?.score > 0 ? scores[0].id : null;
  return (
    <aside className="card meter" aria-labelledby="meter-title">
      <h2 id="meter-title" className="meter__title">
        Your Wigan job match
      </h2>
      <p className="meter__hint">{answered === 0 ? 'Answer a question to light this up.' : 'Updates live as you answer.'}</p>
      <ul className="meter__list">
        {scores.map((s) => {
          const sector = getSector(s.id);
          return (
            <li key={s.id} className={s.id === leader ? 'meter__row meter__row--lead' : 'meter__row'} data-testid={`meter-${s.id}`}>
              <span className="meter__label">
                <span aria-hidden="true">{sector.emoji}</span> {sector.shortName}
                {s.id === leader && <span className="meter__lead">Leading</span>}
              </span>
              <span className="meter__bar" aria-hidden="true">
                <span className="meter__fill" style={{ width: `${s.matchPercent}%`, background: sector.color }} />
              </span>
              <span className="meter__pct">{s.matchPercent}%</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
