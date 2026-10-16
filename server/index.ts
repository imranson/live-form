import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { readConfig } from './config.js';
import { OllamaClient } from './ollama.js';
import { QuestionAgent } from './agent/questionAgent.js';
import { ResultAgent } from './agent/resultAgent.js';
import { SessionStore } from './sessions.js';
import { createApp } from './app.js';

try {
  process.loadEnvFile();
} catch {
  // no .env – fall back to defaults / real environment
}

const config = readConfig();
const llm = config.aiMode === 'ollama' ? new OllamaClient(config.ollama) : null;
if (llm && !config.ollama.apiKey) console.warn('OLLAMA_API_KEY is not set: ollama.com will reject requests and every question will come from the fallback bank.');
const store = new SessionStore(config.sessionTtlMs);
setInterval(() => store.prune(), 60_000).unref();

const app = createApp({
  questionAgent: new QuestionAgent(llm),
  resultAgent: new ResultAgent(llm),
  store,
  questionCount: config.questionCount,
  aiInfo: { mode: llm ? 'ollama-cloud' : 'offline', models: llm ? config.ollama.models : [] },
});

// In production, serve the built client from the same origin.
const clientDir = path.resolve(process.cwd(), 'dist/client');
if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(path.join(clientDir, 'index.html')) : next()));
}

app.listen(config.port, () => {
  const ai = llm ? `${config.ollama.models.join(' → ')} via ${config.ollama.host}` : 'offline question bank';
  console.log(`Wigan live form API on http://localhost:${config.port} (AI: ${ai})`);
});
