import { describe, expect, it } from 'vitest';
import { OLLAMA_CLOUD_HOST, readConfig, toDirectCloudModel } from '../../../server/config.js';

describe('Ollama cloud configuration', () => {
  it('defaults to cloud models through the local Ollama gateway', () => {
    const config = readConfig({});
    expect(config.aiMode).toBe('ollama');
    expect(config.ollama.host).toBe('http://127.0.0.1:11434');
    expect(config.ollama.models).toEqual(['kimi-k2.6:cloud', 'gemma4:31b-cloud']);
    expect(config.ollama.apiKey).toBeUndefined();
    expect(config.questionCount).toBe(8);
  });

  it('calls ollama.com directly when an API key is set, stripping the cloud suffix', () => {
    const config = readConfig({ OLLAMA_API_KEY: ' secret ', OLLAMA_HOST: 'http://ignored:1', OLLAMA_MODEL: 'kimi-k2.6:cloud', OLLAMA_FALLBACK_MODEL: 'gpt-oss:120b-cloud' });
    expect(config.ollama.host).toBe(OLLAMA_CLOUD_HOST);
    expect(config.ollama.apiKey).toBe('secret');
    expect(config.ollama.models).toEqual(['kimi-k2.6', 'gpt-oss:120b']);
  });

  it('strips only a trailing cloud suffix', () => {
    expect(toDirectCloudModel('gemma4:31b-cloud')).toBe('gemma4:31b');
    expect(toDirectCloudModel('deepseek-v4-pro:cloud')).toBe('deepseek-v4-pro');
    expect(toDirectCloudModel('cloudy-model:7b')).toBe('cloudy-model:7b');
  });

  it('de-duplicates identical primary and fallback models', () => {
    expect(readConfig({ OLLAMA_MODEL: 'a:cloud', OLLAMA_FALLBACK_MODEL: 'a:cloud' }).ollama.models).toEqual(['a:cloud']);
  });

  it('supports an offline mode and clamps numeric settings', () => {
    const config = readConfig({ AI_MODE: 'offline', QUESTION_COUNT: '99', PORT: 'abc', OLLAMA_HOST: 'http://box:11434/' });
    expect(config.aiMode).toBe('offline');
    expect(config.questionCount).toBe(12);
    expect(config.port).toBe(8787);
    expect(config.ollama.host).toBe('http://box:11434');
  });
});
