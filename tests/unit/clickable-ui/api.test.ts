import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApi } from '../../../client/src/api';

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('client API wrapper', () => {
  it('starts a session with POST', async () => {
    const fetchMock = vi.fn(async () => json({ sessionId: 's1' }, 201));
    vi.stubGlobal('fetch', fetchMock);
    expect(await createApi('http://api.test').start()).toEqual({ sessionId: 's1' });
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/sessions', expect.objectContaining({ method: 'POST' }));
  });

  it('sends the clicked option ids as JSON', async () => {
    const fetchMock = vi.fn(async () => json({ complete: false }));
    vi.stubGlobal('fetch', fetchMock);
    await createApi().answer('a b', 'q1', ['q1-o2']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/sessions/a%20b/answers');
    expect(JSON.parse(init.body as string)).toEqual({ questionId: 'q1', optionIds: ['q1-o2'] });
  });

  it('turns server errors into ApiErrors with the server’s message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Session not found' }, 404)));
    const err = await createApi().result('nope').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, message: 'Session not found' });
  });

  it('explains network failures in plain English', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    await expect(createApi().start()).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/Can’t connect/) });
  });
});
