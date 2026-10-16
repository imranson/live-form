export interface AppConfig {
  port: number;
  aiMode: 'ollama' | 'offline';
  ollama: {
    host: string;
    apiKey?: string;
    models: string[];
    timeoutMs: number;
  };
  questionCount: number;
  sessionTtlMs: number;
}

export const OLLAMA_CLOUD_HOST = 'https://ollama.com';

/** ollama.com's API names models without the ":cloud"/"-cloud" suffix a local Ollama app uses. */
export function toDirectCloudModel(model: string): string {
  return model.replace(/[:-]cloud$/, '');
}

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiKey = env.OLLAMA_API_KEY?.trim() || undefined;
  const models = [env.OLLAMA_MODEL || 'kimi-k2.6', env.OLLAMA_FALLBACK_MODEL || 'gemma4:31b']
    .map((m) => toDirectCloudModel(m.trim()))
    .filter(Boolean);

  return {
    port: int(env.PORT, 8787, 1, 65535),
    aiMode: env.AI_MODE === 'offline' ? 'offline' : 'ollama',
    ollama: {
      host: OLLAMA_CLOUD_HOST,
      apiKey,
      models: [...new Set(models)],
      timeoutMs: int(env.OLLAMA_TIMEOUT_MS, 45_000, 1_000, 300_000),
    },
    questionCount: int(env.QUESTION_COUNT, 8, 5, 12),
    sessionTtlMs: int(env.SESSION_TTL_MINUTES, 60, 1, 24 * 60) * 60_000,
  };
}
