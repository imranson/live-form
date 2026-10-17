import { randomUUID } from 'node:crypto';
import { ENGLISH } from '../shared/i18n.js';
import type { AnswerRecord, Language, Progress, Question, SessionResult } from '../shared/types.js';

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  target: number;
  language: Language;
  answers: AnswerRecord[];
  pending: Question | null;
  progress: Progress;
  busy: boolean;
  result?: Promise<SessionResult>;
}

/** In-memory, anonymous sessions. Nothing personal is stored and everything expires. */
export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxSessions = 5_000,
    private readonly now: () => number = Date.now,
  ) {}

  create(target: number, progress: Progress, language: Language = ENGLISH): Session {
    this.prune();
    if (this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (oldest) this.sessions.delete(oldest);
    }
    const t = this.now();
    const session: Session = { id: randomUUID(), createdAt: t, updatedAt: t, target, language, answers: [], pending: null, progress, busy: false };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (this.now() - session.updatedAt > this.ttlMs) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  touch(session: Session): void {
    session.updatedAt = this.now();
    // Re-insert so Map order stays least-recently-used first.
    this.sessions.delete(session.id);
    this.sessions.set(session.id, session);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  prune(): void {
    const t = this.now();
    for (const [id, s] of this.sessions) if (t - s.updatedAt > this.ttlMs) this.sessions.delete(id);
  }

  get size(): number {
    return this.sessions.size;
  }
}
