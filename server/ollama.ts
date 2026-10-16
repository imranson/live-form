import { extractJson } from './json.js';
import type { AppConfig } from './config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  temperature?: number;
}

/** Anything that can turn a prompt into validated JSON. Real implementation: OllamaClient. */
export interface LlmClient {
  generateJson<T>(messages: ChatMessage[], parse: (data: unknown) => T, options?: GenerateOptions): Promise<{ value: T; model: string }>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly attempts: { model: string; error: string }[],
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Talks to Ollama's /api/chat – either a local Ollama app (which proxies "*:cloud" models)
 * or ollama.com directly with an API key. Tries each configured model in turn until one
 * returns output that parses *and* passes the caller's validation.
 */
export class OllamaClient implements LlmClient {
  private readonly fetchFn: FetchLike;

  constructor(
    private readonly config: AppConfig['ollama'],
    fetchFn?: FetchLike,
  ) {
    this.fetchFn = fetchFn ?? ((url, init) => fetch(url, init));
  }

  async generateJson<T>(messages: ChatMessage[], parse: (data: unknown) => T, options: GenerateOptions = {}) {
    const attempts: { model: string; error: string }[] = [];
    for (const model of this.config.models) {
      try {
        const content = await this.chat(model, messages, options);
        return { value: parse(extractJson(content)), model };
      } catch (err) {
        attempts.push({ model, error: err instanceof Error ? err.message : String(err) });
      }
    }
    throw new LlmError(`All models failed: ${attempts.map((a) => `${a.model} (${a.error})`).join('; ')}`, attempts);
  }

  async chat(model: string, messages: ChatMessage[], options: GenerateOptions = {}, disableThinking = true): Promise<string> {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      format: 'json',
      options: { temperature: options.temperature ?? 0.7 },
    };
    // Thinking adds latency we don't need for short structured output.
    if (disableThinking) body.think = false;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

    const res = await this.fetchFn(`${this.config.host}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      // Some models reject the `think` flag entirely – retry once without it.
      if (disableThinking && res.status === 400 && /think/i.test(detail)) return this.chat(model, messages, options, false);
      throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }

    const data = (await res.json()) as { message?: { content?: string }; error?: string };
    if (data.error) throw new Error(data.error);
    const content = data.message?.content?.trim();
    if (!content) throw new Error('Empty response from model');
    return content;
  }
}
