import { describe, expect, it, vi } from 'vitest';
import { LlmError, OllamaClient } from '../../../server/ollama.js';

const reply = (content: string, status = 200) => new Response(JSON.stringify({ message: { role: 'assistant', content } }), { status });
const config = { host: 'http://ollama.test', models: ['primary:cloud', 'backup:cloud'], timeoutMs: 5_000 };
const messages = [{ role: 'user' as const, content: 'hi' }];
const parseOk = (d: unknown) => d as { ok: boolean };

describe('OllamaClient', () => {
  it('posts a non-streaming JSON chat request with thinking disabled', async () => {
    const fetchFn = vi.fn(async () => reply('{"ok":true}'));
    const client = new OllamaClient(config, fetchFn);
    const result = await client.generateJson(messages, parseOk, { temperature: 0.3 });

    expect(result).toEqual({ value: { ok: true }, model: 'primary:cloud' });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ollama.test/api/chat');
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'primary:cloud',
      messages,
      stream: false,
      format: 'json',
      think: false,
      options: { temperature: 0.3 },
    });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends a bearer token when talking to ollama.com directly', async () => {
    const fetchFn = vi.fn(async () => reply('{"ok":true}'));
    await new OllamaClient({ ...config, apiKey: 'k3y' }, fetchFn).generateJson(messages, parseOk);
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k3y');
  });

  it('extracts JSON wrapped in markdown fences', async () => {
    const client = new OllamaClient(config, async () => reply('```json\n{"ok":true}\n```'));
    expect((await client.generateJson(messages, parseOk)).value).toEqual({ ok: true });
  });

  it('falls back to the next model on HTTP errors', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response('overloaded', { status: 503 })).mockResolvedValueOnce(reply('{"ok":true}'));
    const result = await new OllamaClient(config, fetchFn).generateJson(messages, parseOk);
    expect(result.model).toBe('backup:cloud');
    expect(JSON.parse((fetchFn.mock.calls[1][1] as RequestInit).body as string).model).toBe('backup:cloud');
  });

  it('falls back to the next model when output fails validation', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(reply('{"ok":"nope"}')).mockResolvedValueOnce(reply('{"ok":true}'));
    const strict = (d: unknown) => {
      if ((d as { ok: unknown }).ok !== true) throw new Error('invalid');
      return d;
    };
    expect((await new OllamaClient(config, fetchFn).generateJson(messages, strict)).model).toBe('backup:cloud');
  });

  it('retries without the think flag when a model rejects it', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":"model does not support thinking"}', { status: 400 }))
      .mockResolvedValueOnce(reply('{"ok":true}'));
    const result = await new OllamaClient(config, fetchFn).generateJson(messages, parseOk);
    expect(result.model).toBe('primary:cloud');
    expect(JSON.parse((fetchFn.mock.calls[1][1] as RequestInit).body as string)).not.toHaveProperty('think');
  });

  it('throws an LlmError listing every failed attempt', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(reply('')).mockRejectedValueOnce(new Error('network down'));
    const err = await new OllamaClient(config, fetchFn).generateJson(messages, parseOk).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.attempts).toEqual([
      { model: 'primary:cloud', error: 'Empty response from model' },
      { model: 'backup:cloud', error: 'network down' },
    ]);
  });

  it('surfaces errors reported in the response body', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'model not found' }), { status: 200 }));
    const err = await new OllamaClient({ ...config, models: ['x'] }, fetchFn).generateJson(messages, parseOk).catch((e) => e);
    expect(err.attempts[0].error).toBe('model not found');
  });
});
