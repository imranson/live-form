// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Hud, levelProgress } from '../../../client/src/components/Hud';
import { MatchMeter } from '../../../client/src/components/MatchMeter';
import { BadgeToasts } from '../../../client/src/components/BadgeToasts';
import { BADGES, buildProgress, levelFor } from '../../../shared/game.js';
import { computeScores } from '../../../shared/scoring.js';
import { bankAnswer } from '../../helpers.js';

describe('HUD', () => {
  const answers = [bankAnswer('environment', 0), bankAnswer('interests', [0, 1], 2), bankAnswer('age', 0, 3)];
  const progress = buildProgress(answers, 8, false);

  it('shows question count, level and XP', () => {
    render(<Hud progress={progress} current={4} />);
    expect(screen.getByText(/Question/)).toHaveTextContent('Question 4 of 8');
    expect(screen.getByText(/Lv 2 · Navigator/)).toBeInTheDocument();
    expect(screen.getByTestId('xp')).toHaveTextContent('325 XP');
  });

  it('exposes XP progress to assistive tech', () => {
    render(<Hud progress={progress} current={4} />);
    const bar = screen.getByRole('progressbar', { name: /XP towards next level/ });
    expect(bar).toHaveAttribute('aria-valuenow', String(levelProgress(progress.level, progress.xp)));
    expect(bar).toHaveAttribute('aria-valuetext', '325 XP');
  });

  it('pops the XP just earned', () => {
    render(<Hud progress={progress} current={4} xpGain={{ amount: 125, key: 1 }} />);
    expect(screen.getByText('+125 XP')).toBeInTheDocument();
  });

  it('computes progress within the current level', () => {
    expect(levelProgress(levelFor(400), 400)).toBe(50);
    expect(levelProgress(levelFor(5000), 5000)).toBe(100);
  });
});

describe('MatchMeter', () => {
  it('lists every sector with its live match and marks the leader', () => {
    const answers = [bankAnswer('environment', 4)];
    render(<MatchMeter scores={computeScores(answers)} answered={1} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    const digital = screen.getByTestId('meter-digital');
    expect(within(digital).getByText('Leading')).toBeInTheDocument();
    expect(digital).toHaveTextContent('100%');
  });

  it('invites the person to answer before any matches exist', () => {
    render(<MatchMeter scores={computeScores([])} answered={0} />);
    expect(screen.getByText(/Answer a question to light this up/)).toBeInTheDocument();
    expect(screen.queryByText('Leading')).not.toBeInTheDocument();
  });
});

describe('BadgeToasts', () => {
  it('announces unlocked badges politely', () => {
    render(<BadgeToasts badges={[BADGES.firstStep, BADGES.halfway]} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Badge unlocked: First Step');
    expect(region).toHaveTextContent('Badge unlocked: Halfway Hero');
  });
});
