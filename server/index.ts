import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { readConfig } from './config.js';
import { bootstrap } from './bootstrap.js';

try {
  process.loadEnvFile();
} catch {
  // no .env – fall back to defaults / real environment
}

const config = readConfig();
const app = bootstrap(config);

// In production, serve the built client from the same origin.
const clientDir = path.resolve(process.cwd(), 'dist/client');
if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(path.join(clientDir, 'index.html')) : next()));
}

app.listen(config.port, () => {
  const ai = config.aiMode === 'ollama' ? `${config.ollama.models.join(' → ')} via ${config.ollama.host}` : 'offline question bank';
  console.log(`Wigan live form API on http://localhost:${config.port} (AI: ${ai})`);
});
