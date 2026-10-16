import type { AnswerResponse, SessionResult, StartResponse } from '../../shared/types.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Api {
  start(): Promise<StartResponse>;
  answer(sessionId: string, questionId: string, optionIds: string[]): Promise<AnswerResponse>;
  result(sessionId: string): Promise<SessionResult>;
}

export function createApi(base = ''): Api {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
    } catch {
      throw new ApiError(0, 'Can’t connect. Check your internet and try again.');
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new ApiError(res.status, body.error ?? 'Something went wrong. Please try again.');
    return body as T;
  }

  return {
    start: () => request<StartResponse>('/api/sessions', { method: 'POST' }),
    answer: (sessionId, questionId, optionIds) =>
      request<AnswerResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/answers`, {
        method: 'POST',
        body: JSON.stringify({ questionId, optionIds }),
      }),
    result: (sessionId) => request<SessionResult>(`/api/sessions/${encodeURIComponent(sessionId)}/result`),
  };
}
