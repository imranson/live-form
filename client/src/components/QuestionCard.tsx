import { useEffect, useRef, useState } from 'react';
import type { Question } from '../../../shared/types.js';

interface Props {
  question: Question;
  onSubmit: (optionIds: string[]) => void;
}

/** Remount per question (key={question.id}) so selection state resets cleanly. */
export function QuestionCard({ question, onSubmit }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const multi = question.kind === 'multi';
  const atMax = multi && selected.length >= question.maxSelections;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const submit = (ids: string[]) => {
    if (submitted || ids.length === 0) return;
    setSubmitted(true);
    onSubmit(ids);
  };

  const choose = (id: string) => {
    if (submitted) return;
    if (!multi) {
      setSelected([id]);
      submit([id]);
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= question.maxSelections ? prev : [...prev, id]));
  };

  // Number keys pick options; Enter confirms a multi-select. Makes it quick to play with a keyboard.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const n = Number.parseInt(e.key, 10);
    if (n >= 1 && n <= question.options.length) {
      e.preventDefault();
      choose(question.options[n - 1].id);
    } else if (e.key === 'Enter' && multi && selected.length > 0 && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
      e.preventDefault();
      submit(selected);
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  return (
    <section className="card question" aria-labelledby={`${question.id}-title`}>
      <div className="agent-note">
        <span className="agent-note__avatar" aria-hidden="true">
          🧭
        </span>
        <div>
          <p className="agent-note__who">
            Your Wigan careers guide
            <span className={`source source--${question.source}`}>{question.source === 'ai' ? '✨ Written live by AI' : '📋 From our question bank'}</span>
          </p>
          <p className="agent-note__text">{question.agentNote}</p>
        </div>
      </div>

      <h2 id={`${question.id}-title`} className="question__title" tabIndex={-1} ref={headingRef}>
        {question.title}
      </h2>
      {question.helper && <p className="question__helper">{question.helper}</p>}
      {multi && (
        <p className="question__multi" aria-live="polite">
          Pick up to {question.maxSelections} · <strong>{selected.length}</strong> picked
        </p>
      )}

      <div className="options" role="group" aria-labelledby={`${question.id}-title`}>
        {question.options.map((o, i) => {
          const isSelected = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              className={`option${isSelected ? ' option--selected' : ''}`}
              aria-pressed={multi ? isSelected : undefined}
              disabled={submitted || (atMax && !isSelected)}
              onClick={() => choose(o.id)}
            >
              <span className="option__key" aria-hidden="true">
                {i + 1}
              </span>
              <span className="option__emoji" aria-hidden="true">
                {o.emoji}
              </span>
              <span className="option__label">{o.label}</span>
              {isSelected && (
                <span className="option__tick" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {multi && (
        <div className="question__actions">
          <button type="button" className="btn btn--primary" disabled={selected.length === 0 || submitted} onClick={() => submit(selected)}>
            Continue <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </section>
  );
}
