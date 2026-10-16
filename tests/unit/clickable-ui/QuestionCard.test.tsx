// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionCard } from '../../../client/src/components/QuestionCard';
import { toQuestion } from '../../../server/agent/questionAgent.js';
import { FALLBACK_QUESTIONS } from '../../../server/agent/fallbackBank.js';

const single = toQuestion(FALLBACK_QUESTIONS.environment, 2, 'ai');
const multi = toQuestion(FALLBACK_QUESTIONS.interests, 1, 'fallback');

describe('QuestionCard – single choice', () => {
  it('shows the AI guide’s note, the question and one button per option', () => {
    render(<QuestionCard question={single} onSubmit={() => undefined} />);
    expect(screen.getByText(single.agentNote)).toBeInTheDocument();
    expect(screen.getByText(/Written live by AI/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: single.title })).toHaveFocus();
    expect(screen.getAllByRole('button')).toHaveLength(single.options.length);
  });

  it('submits immediately when an option is clicked, and only once', async () => {
    const onSubmit = vi.fn();
    render(<QuestionCard question={single} onSubmit={onSubmit} />);
    const button = screen.getByRole('button', { name: /lively kitchen/i });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([single.options[5].id]);
    expect(button).toBeDisabled();
  });

  it('can be answered with number keys', async () => {
    const onSubmit = vi.fn();
    render(<QuestionCard question={single} onSubmit={onSubmit} />);
    await userEvent.keyboard('2');
    expect(onSubmit).toHaveBeenCalledWith([single.options[1].id]);
  });

  it('ignores number keys beyond the available options', async () => {
    const onSubmit = vi.fn();
    render(<QuestionCard question={single} onSubmit={onSubmit} />);
    await userEvent.keyboard('9');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('QuestionCard – multi choice', () => {
  it('toggles options with aria-pressed and submits on Continue', async () => {
    const onSubmit = vi.fn();
    render(<QuestionCard question={multi} onSubmit={onSubmit} />);
    expect(screen.getByText(/From our question bank/)).toBeInTheDocument();
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    expect(continueBtn).toBeDisabled();

    const building = screen.getByRole('button', { name: /building or fixing/i });
    await userEvent.click(building);
    expect(building).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /cooking/i }));
    await userEvent.click(building);
    expect(building).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/picked/)).toHaveTextContent('Pick up to 3 · 1 picked');

    await userEvent.click(continueBtn);
    expect(onSubmit).toHaveBeenCalledWith([multi.options[5].id]);
  });

  it('caps selections at maxSelections by disabling the other options', async () => {
    render(<QuestionCard question={multi} onSubmit={() => undefined} />);
    for (const n of ['1', '2', '3']) await userEvent.keyboard(n);
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /out on the road/i })).toBeDisabled();
    await userEvent.keyboard('4');
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(3);
  });

  it('confirms a multi-select with Enter', async () => {
    const onSubmit = vi.fn();
    render(<QuestionCard question={multi} onSubmit={onSubmit} />);
    await userEvent.keyboard('1');
    await userEvent.keyboard('5');
    screen.getByRole('heading').focus();
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith([multi.options[0].id, multi.options[4].id]);
  });
});
