import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { SECTORS } from '../shared/sectors.js';
import { buildProgress } from '../shared/game.js';
import { ENGLISH, ENGLISH_TRANSLATION, isEnglish } from '../shared/i18n.js';
import { answerBodySchema, startBodySchema, translateBodySchema, type AnswerResponse, type Language, type StartResponse } from '../shared/types.js';
import type { QuestionAgent } from './agent/questionAgent.js';
import type { ResultAgent } from './agent/resultAgent.js';
import { languageFromCode, TranslationUnavailableError } from './i18n/language.js';
import type { Translator } from './i18n/translator.js';
import type { SessionStore } from './sessions.js';

export interface AppDeps {
  questionAgent: Pick<QuestionAgent, 'next'>;
  resultAgent: Pick<ResultAgent, 'build'>;
  translator: Pick<Translator, 'available' | 'resolve' | 'catalog'>;
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

  const unavailable = () => new HttpError(503, 'Translation isn’t available right now. Please try again later.');

  // Turns whatever language the resident typed into a recognised language and the translated UI text.
  app.post('/api/translations', async (req, res) => {
    const { language: input } = translateBodySchema.parse(req.body);
    let language: Language | null;
    try {
      language = await deps.translator.resolve(input);
    } catch (err) {
      if (!(err instanceof TranslationUnavailableError)) console.warn(`[api] language lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      throw unavailable();
    }
    if (!language) throw new HttpError(422, 'We couldn’t recognise that language.');
    if (isEnglish(language)) {
      res.json(ENGLISH_TRANSLATION);
      return;
    }
    if (!deps.translator.available) throw unavailable();
    const translation = await deps.translator.catalog(language);
    // Nothing translated at all means the model is down; don't pretend the switch worked.
    if (!translation.complete && Object.entries(translation.messages).every(([key, text]) => ENGLISH_TRANSLATION.messages[key] === text)) throw unavailable();
    res.json(translation);
  });

  app.post('/api/sessions', async (req, res) => {
    const { language: code } = startBodySchema.parse(req.body ?? {});
    const language = code ? languageFromCode(code) : ENGLISH;
    if (!language) throw new HttpError(400, 'Unknown language.');
    const progress = buildProgress([], deps.questionCount, false);
    const session = deps.store.create(deps.questionCount, progress, language);
    session.busy = true;
    try {
      session.pending = await deps.questionAgent.next([], session.target, session.language);
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
      session.result = deps.resultAgent.build(session.answers, session.progress, session.language);
      session.result.catch(() => undefined);
    } else {
      session.busy = true;
      try {
        session.pending = await deps.questionAgent.next(session.answers, session.target, session.language);
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
    session.result ??= deps.resultAgent.build(session.answers, session.progress, session.language);
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
