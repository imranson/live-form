import { useEffect, useState } from 'react';

export type ThinkingKind = 'start' | 'next' | 'result';

const STEPS: Record<ThinkingKind, string[]> = {
  start: ['Warming up your careers guide…', 'Looking at Wigan’s most in-demand jobs…', 'Writing your first question…'],
  next: ['Reading your answer…', 'Updating your job matches…', 'Writing your next question…'],
  result: ['Adding up your matches…', 'Finding local support for you…', 'Writing your personal results…'],
};

export function AgentThinking({ kind }: { kind: ThinkingKind }) {
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
        {STEPS[kind][step]}
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
