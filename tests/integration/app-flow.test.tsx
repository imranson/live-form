// @vitest-environment jsdom
import { once } from 'node:events';
import type { AddressInfo, Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../client/src/App';
import { ApiError, createApi, type Api } from '../../client/src/api';
import { AI_NARRATIVE, buildTestApp, scriptedLlm } from '../helpers.js';
import { toQuestion } from '../../server/agent/questionAgent.js';
import { FALLBACK_QUESTIONS } from '../../server/agent/fallbackBank.js';
import { buildProgress } from '../../shared/game.js';

let server: Server;
let base: string;

beforeAll(async () => {
  const { app } = buildTestApp(scriptedLlm());
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const hudCount = () => document.querySelector('.hud__count')?.textContent;
const questionCard = () => document.querySelector<HTMLElement>('section.question');

describe('resident journey (React UI ↔ Express API ↔ AI agent)', () => {
  it('plays the whole gamified questionnaire with clicks and ends with signposts', async () => {
    const user = userEvent.setup();
    render(<App api={createApi(base)} />);

    await user.click(screen.getByRole('button', { name: /let’s go/i }));

    for (let n = 1; n <= 8; n++) {
      await waitFor(() => {
        expect(hudCount()).toBe(`Question ${n} of 8`);
        expect(questionCard()).not.toBeNull();
      });
      const card = within(questionCard()!);
      expect(card.getByRole('heading', { level: 2 })).toHaveTextContent(/^AI:/);
      const options = card.getAllByRole('button').filter((b) => !/continue/i.test(b.textContent ?? ''));
      await user.click(options[0]);
      const proceed = card.queryByRole('button', { name: /continue/i });
      if (proceed) await user.click(proceed);

      if (n === 1) {
        // Gamification feedback after the first answer
        expect(await screen.findByText('New badge: First Step')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('Top')).toBeInTheDocument());
        expect(screen.getByTestId('xp')).toHaveTextContent('100 XP');
      }
    }

    // Results: AI narrative + curated signposts
    expect(await screen.findByRole('heading', { level: 1, name: AI_NARRATIVE.headline }, { timeout: 5_000 })).toBeInTheDocument();
    expect(screen.getByText(/Trailblazer/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Jobs' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    await user.click(screen.getByRole('tab', { name: 'Help' }));
    expect(screen.getByRole('link', { name: /^Jobs, careers and skills/ })).toHaveAttribute('href', 'https://www.wigan.gov.uk/Resident/Jobs-Careers/index.aspx');

    await user.click(screen.getByRole('button', { name: /start again/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Find your future in Wigan' })).toBeInTheDocument();
  });

  it('shows a friendly error with a retry when the server is unreachable', async () => {
    const user = userEvent.setup();
    render(<App api={createApi('http://127.0.0.1:9')} />);
    await user.click(screen.getByRole('button', { name: /let’s go/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Can’t connect/);
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('offers only “Start again” when the session has expired', async () => {
    const user = userEvent.setup();
    const question = toQuestion(FALLBACK_QUESTIONS.age, 1, 'ai');
    const api: Api = {
      start: vi.fn(async () => ({ sessionId: 's', question, progress: buildProgress([], 8, false) })),
      answer: vi.fn(async () => Promise.reject(new ApiError(404, 'Session not found or expired. Please start again.'))),
      result: vi.fn(),
    };
    render(<App api={api} />);
    await user.click(screen.getByRole('button', { name: /let’s go/i }));
    await user.click(await screen.findByRole('button', { name: /19 to 24/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/expired/);
    expect(within(alert).queryByRole('button', { name: /try again/i })).toBeNull();
    await user.click(within(alert).getByRole('button', { name: /start again/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Find your future in Wigan' })).toBeInTheDocument();
  });
});
