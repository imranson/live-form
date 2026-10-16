import { useCallback, useEffect, useRef, useState } from 'react';
import type { Badge, Progress, Question, SessionResult } from '../../shared/types.js';
import { ApiError, createApi, type Api } from './api';
import { Footer, Header } from './components/Header';
import { Intro } from './components/Intro';
import { Hud } from './components/Hud';
import { MatchMeter } from './components/MatchMeter';
import { QuestionCard } from './components/QuestionCard';
import { AgentThinking, type ThinkingKind } from './components/AgentThinking';
import { BadgeToasts } from './components/BadgeToasts';
import { ResultView } from './components/ResultView';

type Phase = 'intro' | 'loading' | 'question' | 'result' | 'error';

const defaultApi = createApi();
const TOAST_MS = 4000;

export function App({ api = defaultApi }: { api?: Api }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [thinking, setThinking] = useState<ThinkingKind>('start');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [error, setError] = useState<{ message: string; canRetry: boolean; retry: () => void } | null>(null);
  const [toasts, setToasts] = useState<Badge[]>([]);
  const [xpGain, setXpGain] = useState<{ amount: number; key: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const celebrate = useCallback((next: Progress, prev: Progress | null) => {
    if (prev && next.xp > prev.xp) setXpGain({ amount: next.xp - prev.xp, key: Date.now() });
    if (next.newBadges.length === 0) return;
    setToasts((t) => [...t, ...next.newBadges]);
    const ids = new Set(next.newBadges.map((b) => b.id));
    timers.current.push(setTimeout(() => setToasts((t) => t.filter((b) => !ids.has(b.id))), TOAST_MS));
  }, []);

  const run = useCallback(async (kind: ThinkingKind, task: () => Promise<void>) => {
    setThinking(kind);
    setPhase('loading');
    setError(null);
    try {
      await task();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      const canRetry = !(err instanceof ApiError && err.status === 404);
      setError({ message, canRetry, retry: () => void run(kind, task) });
      setPhase('error');
    }
  }, []);

  const loadResult = useCallback(
    (id: string) =>
      run('result', async () => {
        setResult(await api.result(id));
        setPhase('result');
      }),
    [api, run],
  );

  const start = useCallback(() => {
    setResult(null);
    setToasts([]);
    setXpGain(null);
    void run('start', async () => {
      const res = await api.start();
      setSessionId(res.sessionId);
      setQuestion(res.question);
      setProgress(res.progress);
      setPhase('question');
    });
  }, [api, run]);

  const answer = useCallback(
    (optionIds: string[]) => {
      if (!sessionId || !question) return;
      const prev = progress;
      void run('next', async () => {
        const res = await api.answer(sessionId, question.id, optionIds);
        setProgress(res.progress);
        celebrate(res.progress, prev);
        if (res.complete || !res.question) {
          await loadResult(sessionId);
          return;
        }
        setQuestion(res.question);
        setPhase('question');
      });
    },
    [api, celebrate, loadResult, progress, question, run, sessionId],
  );

  const restart = useCallback(() => {
    setSessionId(null);
    setQuestion(null);
    setProgress(null);
    setResult(null);
    setPhase('intro');
  }, []);

  const inQuiz = progress && (phase === 'question' || (phase === 'loading' && thinking === 'next'));

  return (
    <>
      <Header />
      <main className="page" id="main">
        {phase === 'intro' && <Intro onStart={start} />}

        {inQuiz && progress && <Hud progress={progress} current={progress.answered + 1} xpGain={xpGain} />}

        {(phase === 'question' || phase === 'loading') && (
          <div className={inQuiz ? 'quiz' : undefined}>
            <div className="quiz__main">
              {phase === 'question' && question ? <QuestionCard key={question.id} question={question} onSubmit={answer} /> : <AgentThinking kind={thinking} />}
            </div>
            {inQuiz && progress && <MatchMeter scores={progress.scores} answered={progress.answered} />}
          </div>
        )}

        {phase === 'result' && result && <ResultView result={result} onRestart={restart} />}

        {phase === 'error' && error && (
          <section className="card error" role="alert">
            <h2>Sorry – that didn’t work</h2>
            <p>{error.message}</p>
            <div className="error__actions">
              {error.canRetry && (
                <button type="button" className="btn btn--primary" onClick={error.retry}>
                  Try again
                </button>
              )}
              <button type="button" className="btn btn--secondary" onClick={restart}>
                Start again
              </button>
            </div>
          </section>
        )}
      </main>
      <BadgeToasts badges={toasts} />
      <Footer />
    </>
  );
}
