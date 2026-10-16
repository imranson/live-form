import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { SECTORS } from '../shared/sectors.js';
import { buildProgress } from '../shared/game.js';
import { answerBodySchema, type AnswerResponse, type StartResponse } from '../shared/types.js';
import type { QuestionAgent } from './agent/questionAgent.js';
import type { ResultAgent } from './agent/resultAgent.js';
import type { SessionStore } from './sessions.js';

export interface AppDeps {
  questionAgent: Pick<QuestionAgent, 'next'>;
  resultAgent: Pick<ResultAgent, 'build'>;
  store: SessionStore;
  questionCount: number;
  aiInfo: { mode: string; models: string[] };
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  const loadSession = (id: string | string[] | undefined) => {
    const session = typeof id === 'string' ? deps.store.get(id) : undefined;
    if (!session) throw new HttpError(404, 'Session not found or expired. Please start again.');
    return session;
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ai: deps.aiInfo });
  });

  app.get('/api/sectors', (_req, res) => {
    res.json(SECTORS);
  });

  app.post('/api/sessions', async (_req, res) => {
    const progress = buildProgress([], deps.questionCount, false);
    const session = deps.store.create(deps.questionCount, progress);
    session.busy = true;
    try {
      session.pending = await deps.questionAgent.next([], session.target);
    } finally {
      session.busy = false;
    }
    const body: StartResponse = { sessionId: session.id, question: session.pending, progress };
    res.status(201).json(body);
  });

  app.post('/api/sessions/:id/answers', async (req, res) => {
    const session = loadSession(req.params.id);
    const { questionId, optionIds } = answerBodySchema.parse(req.body);

    if (session.busy) throw new HttpError(409, 'Still preparing your next question.');
    const question = session.pending;
    if (!question) throw new HttpError(409, 'This questionnaire is already complete.');
    if (question.id !== questionId) throw new HttpError(409, 'That question has already been answered.');

    const unique = [...new Set(optionIds)];
    const validIds = new Set(question.options.map((o) => o.id));
    if (unique.some((id) => !validIds.has(id))) throw new HttpError(400, 'Unknown option for this question.');
    if (unique.length > question.maxSelections) throw new HttpError(400, `Pick up to ${question.maxSelections} options.`);

    session.answers.push({ question, optionIds: unique });
    session.pending = null;
    deps.store.touch(session);

    const complete = session.answers.length >= session.target;
    const previous = session.progress;

    if (complete) {
      session.progress = buildProgress(session.answers, session.target, true, previous);
      // Start writing the results straight away so they're ready when the client asks.
      session.result = deps.resultAgent.build(session.answers, session.progress);
      session.result.catch(() => undefined);
    } else {
      session.busy = true;
      try {
        session.pending = await deps.questionAgent.next(session.answers, session.target);
      } catch (err) {
        // Roll back so the resident can simply retry the same question.
        session.answers.pop();
        session.pending = question;
        throw err;
      } finally {
        session.busy = false;
      }
      session.progress = buildProgress(session.answers, session.target, false, previous);
    }

    const body: AnswerResponse = { complete, question: session.pending, progress: session.progress };
    res.json(body);
  });

  app.get('/api/sessions/:id/result', async (req, res) => {
    const session = loadSession(req.params.id);
    if (session.answers.length < session.target) throw new HttpError(409, 'Finish the questionnaire to see your results.');
    session.result ??= deps.resultAgent.build(session.answers, session.progress);
    res.json(await session.result);
  });

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Invalid request', issues: err.issues.map((i) => i.message) });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON' });
    } else {
      console.error('[api] unexpected error', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  });

  return app;
}
