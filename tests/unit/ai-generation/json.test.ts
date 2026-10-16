import { describe, expect, it } from 'vitest';
import { extractJson } from '../../../server/json.js';

describe('extractJson (robust parsing of model output)', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"ok":true}')).toEqual({ ok: true });
  });

  it('parses JSON inside markdown fences', () => {
    expect(extractJson('```json\n{"ok":true}\n```')).toEqual({ ok: true });
    expect(extractJson('```\n{"ok":1}\n```')).toEqual({ ok: 1 });
  });

  it('finds the JSON object inside surrounding prose', () => {
    expect(extractJson('Sure! Here it is: {"a":{"b":[1,2]}} Hope that helps.')).toEqual({ a: { b: [1, 2] } });
  });

  it('is not fooled by braces and escaped quotes inside strings', () => {
    expect(extractJson('Result: {"label":"Use {curly} \\"quotes\\"","n":1} trailing }')).toEqual({ label: 'Use {curly} "quotes"', n: 1 });
  });

  it('throws when there is no JSON object', () => {
    expect(() => extractJson('I cannot help with that.')).toThrow(/No JSON object/);
    expect(() => extractJson('{"unterminated": true')).toThrow(/Unterminated/);
  });
});
