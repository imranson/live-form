// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultView } from '../../../client/src/components/ResultView';
import { ResultAgent } from '../../../server/agent/resultAgent.js';
import { buildProgress } from '../../../shared/game.js';
import { AI_NARRATIVE, FakeLlm, bankAnswer, silentLogger } from '../../helpers.js';

async function makeResult() {
  const answers = [bankAnswer('environment', 2), bankAnswer('situation', 1, 2), bankAnswer('age', 2, 3), bankAnswer('support', [3], 4)];
  return new ResultAgent(new FakeLlm(() => AI_NARRATIVE), silentLogger).build(answers, buildProgress(answers, 4, true));
}

describe('ResultView', () => {
  it('celebrates with the final level, XP and badges', async () => {
    render(<ResultView result={await makeResult()} onRestart={() => undefined} />);
    expect(screen.getByRole('heading', { level: 1, name: AI_NARRATIVE.headline })).toHaveFocus();
    expect(screen.getByText(/Level \d · .* XP/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Badges earned' })).getByText(/Wigan Pathfinder/)).toBeInTheDocument();
  });

  it('shows the top three sector matches with example roles and evidence sources', async () => {
    render(<ResultView result={await makeResult()} onRestart={() => undefined} />);
    const matches = screen.getByRole('heading', { name: /top Wigan matches/ }).parentElement!;
    const cards = within(matches).getAllByRole('heading', { level: 3 });
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('Engineering & Manufacturing');
    expect(within(matches).getAllByRole('link', { name: /Source/ })[0]).toHaveAttribute('target', '_blank');
  });

  it('signposts to real services with safe external links, reasons and phone numbers', async () => {
    const result = await makeResult();
    render(<ResultView result={result} onRestart={() => undefined} />);
    for (const { resource } of result.signposts) {
      const link = screen.getByRole('link', { name: new RegExp(`Visit ${resource.title.replace(/[?()]/g, '\\$&')}`) });
      expect(link).toHaveAttribute('href', resource.url);
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(screen.getByText('Free help to progress from low-paid work.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /01942 489758/ })).toHaveAttribute('href', 'tel:01942489758');
  });

  it('lists the AI’s next steps and offers print and restart', async () => {
    const onRestart = vi.fn();
    render(<ResultView result={await makeResult()} onRestart={onRestart} />);
    for (const step of AI_NARRATIVE.nextSteps) expect(screen.getByText(step)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print or save/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /start again/i }));
    expect(onRestart).toHaveBeenCalled();
  });
});
