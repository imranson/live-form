import { useEffect, useState } from 'react';
import type { UiKey } from '../../../shared/i18n.js';
import { useI18n } from '../i18n';

export type ThinkingKind = 'start' | 'next' | 'result';

const STEPS: Record<ThinkingKind, UiKey[]> = {
  start: ['thinking.start1', 'thinking.start2', 'thinking.start3'],
  next: ['thinking.next1', 'thinking.next2', 'thinking.next3'],
  result: ['thinking.result1', 'thinking.result2', 'thinking.result3'],
};

export function AgentThinking({ kind }: { kind: ThinkingKind }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS[kind].length - 1)), 1200);
    return () => clearInterval(timer);
  }, [kind]);

  return (
    <section className="card thinking" aria-busy="true">
      <div className="thinking__orb" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="thinking__text" role="status" aria-live="polite">
        {t(STEPS[kind][step])}
      </p>
      <div className="skeleton" aria-hidden="true">
        <div className="skeleton__line skeleton__line--title" />
        <div className="skeleton__grid">
          <div className="skeleton__tile" />
          <div className="skeleton__tile" />
          <div className="skeleton__tile" />
          <div className="skeleton__tile" />
        </div>
      </div>
    </section>
  );
}
