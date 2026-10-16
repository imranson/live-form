import type express from 'express';
import { readConfig } from './config.js';
import { OllamaClient } from './ollama.js';
import { QuestionAgent } from './agent/questionAgent.js';
import { ResultAgent } from './agent/resultAgent.js';
import { SessionStore } from './sessions.js';
import { createApp } from './app.js';

/** Wires the API from the environment. Shared by the local server and the Vercel function. */
export function bootstrap(config = readConfig()): express.Express {
  const llm = config.aiMode === 'ollama' ? new OllamaClient(config.ollama) : null;
  if (llm && !config.ollama.apiKey) console.warn('OLLAMA_API_KEY is not set: ollama.com will reject requests and every question will come from the fallback bank.');
  const store = new SessionStore(config.sessionTtlMs);
  setInterval(() => store.prune(), 60_000).unref();

  return createApp({
    questionAgent: new QuestionAgent(llm),
    resultAgent: new ResultAgent(llm),
    store,
    questionCount: config.questionCount,
    aiInfo: { mode: llm ? 'ollama-cloud' : 'offline', models: llm ? config.ollama.models : [] },
  });
}
