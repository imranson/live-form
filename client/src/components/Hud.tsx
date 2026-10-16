import type { Progress } from '../../../shared/types.js';

export function levelProgress(level: Progress['level'], xp: number): number {
  if (level.nextXp === null) return 100;
  return Math.round((100 * (xp - level.floorXp)) / (level.nextXp - level.floorXp));
}

export function Hud({ progress, current, xpGain }: { progress: Progress; current: number; xpGain?: { amount: number; key: number } | null }) {
  const pct = levelProgress(progress.level, progress.xp);
  return (
    <div className="hud" aria-label="Your progress">
      <p className="hud__count">
        Question <strong>{Math.min(current, progress.target)}</strong> of {progress.target}
      </p>
      <ol className="steps" aria-hidden="true">
        {Array.from({ length: progress.target }, (_, i) => (
          <li key={i} className={i < progress.answered ? 'step step--done' : i === progress.answered ? 'step step--current' : 'step'} />
        ))}
      </ol>

      <div className="hud__level">
        <span className="level-pill" title={progress.level.name}>
          Level {progress.level.number}
        </span>
        <div
          className="xpbar"
          role="progressbar"
          aria-label="XP towards next level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${progress.xp} XP`}
        >
          <div className="xpbar__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="hud__xp" data-testid="xp">
          {progress.xp} XP
        </span>
        {xpGain && xpGain.amount > 0 && (
          <span key={xpGain.key} className="xp-pop" aria-hidden="true">
            +{xpGain.amount} XP
          </span>
        )}
      </div>
    </div>
  );
}
