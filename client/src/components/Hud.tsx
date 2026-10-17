import type { Progress } from '../../../shared/types.js';
import { useI18n } from '../i18n';

export function levelProgress(level: Progress['level'], xp: number): number {
  if (level.nextXp === null) return 100;
  return Math.round((100 * (xp - level.floorXp)) / (level.nextXp - level.floorXp));
}

export function Hud({ progress, current, xpGain }: { progress: Progress; current: number; xpGain?: { amount: number; key: number } | null }) {
  const { t, rich, level } = useI18n();
  const pct = levelProgress(progress.level, progress.xp);
  return (
    <div className="hud" aria-label={t('hud.label')}>
      <p className="hud__count">{rich('hud.count', { current: <strong>{Math.min(current, progress.target)}</strong>, total: progress.target })}</p>
      <ol className="steps" aria-hidden="true">
        {Array.from({ length: progress.target }, (_, i) => (
          <li key={i} className={i < progress.answered ? 'step step--done' : i === progress.answered ? 'step step--current' : 'step'} />
        ))}
      </ol>

      <div className="hud__level">
        <span className="level-pill" title={level(progress.level)}>
          {t('hud.level', { level: progress.level.number })}
        </span>
        <div
          className="xpbar"
          role="progressbar"
          aria-label={t('hud.xpLabel')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={t('hud.xp', { xp: progress.xp })}
        >
          <div className="xpbar__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="hud__xp" data-testid="xp">
          {t('hud.xp', { xp: progress.xp })}
        </span>
        {xpGain && xpGain.amount > 0 && (
          <span key={xpGain.key} className="xp-pop" aria-hidden="true">
            {t('hud.xpGain', { xp: xpGain.amount })}
          </span>
        )}
      </div>
    </div>
  );
}
