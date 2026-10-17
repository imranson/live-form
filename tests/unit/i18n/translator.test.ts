import { describe, expect, it } from 'vitest';
import { languageFromCode } from '../../../server/i18n/language.js';
import { parseTranslations, TRANSLATE_SYSTEM_PROMPT, Translator } from '../../../server/i18n/translator.js';
import { ENGLISH, sourceCatalog } from '../../../shared/i18n.js';
import { fakeTranslate, FakeLlm, silentLogger, translateFromPrompt } from '../../helpers.js';

const polish = languageFromCode('pl')!;
const entries = { title: 'Find your future in Wigan', lede: 'Answer {count} quick questions.' };

describe('Translator', () => {
  it('passes English straight through without calling the model', async () => {
    const llm = new FakeLlm(translateFromPrompt);
    const result = await new Translator(llm, silentLogger).translate(entries, ENGLISH);
    expect(result).toEqual({ messages: entries, complete: true });
    expect(llm.calls).toHaveLength(0);
  });

  it('translates every value and names the target language in the prompt', async () => {
    const llm = new FakeLlm(translateFromPrompt);
    const result = await new Translator(llm, silentLogger).translate(entries, polish);
    expect(result).toEqual({ messages: { title: fakeTranslate(entries.title), lede: fakeTranslate(entries.lede) }, complete: true });
    expect(llm.calls[0].messages[0].content).toBe(TRANSLATE_SYSTEM_PROMPT);
    expect(llm.calls[0].messages[1].content).toContain('into Polish (pl)');
  });

  it('caches by language and source text, so each string is translated once', async () => {
    const llm = new FakeLlm(translateFromPrompt);
    const translator = new Translator(llm, silentLogger);
    await translator.translate(entries, polish);
    const again = await translator.translate({ heading: entries.title }, polish);
    expect(again.messages.heading).toBe(fakeTranslate(entries.title));
    expect(llm.calls).toHaveLength(1);

    await translator.translate(entries, languageFromCode('ro')!);
    expect(llm.calls).toHaveLength(2);
  });

  it('splits large batches into chunks', async () => {
    const llm = new FakeLlm(translateFromPrompt);
    const many = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${i}`, `Text number ${i}`]));
    const result = await new Translator(llm, silentLogger, { chunkSize: 10 }).translate(many, polish);
    expect(llm.calls).toHaveLength(3);
    expect(result.complete).toBe(true);
    expect(result.messages.k24).toBe(fakeTranslate('Text number 24'));
  });

  it('keeps English and reports incomplete when the model output is unusable', async () => {
    const droppedPlaceholder = new FakeLlm(() => ({ '1': 'Znajdź swoją przyszłość', '2': 'Odpowiedz na pytania.' }));
    const result = await new Translator(droppedPlaceholder, silentLogger).translate(entries, polish);
    expect(result).toEqual({ messages: entries, complete: false });
  });

  it('retries strings that failed last time', async () => {
    let fail = true;
    const llm = new FakeLlm((messages) => {
      if (fail) throw new Error('model down');
      return translateFromPrompt(messages);
    });
    const translator = new Translator(llm, silentLogger);
    expect((await translator.translate(entries, polish)).complete).toBe(false);
    fail = false;
    expect(await translator.translate(entries, polish)).toMatchObject({ complete: true, messages: { title: fakeTranslate(entries.title) } });
  });

  it('returns English when there is no model (offline mode)', async () => {
    const translator = new Translator(null, silentLogger);
    expect(translator.available).toBe(false);
    expect(await translator.translate(entries, polish)).toEqual({ messages: entries, complete: false });
  });

  it('shares one catalog translation between concurrent requests', async () => {
    const llm = new FakeLlm(translateFromPrompt);
    const translator = new Translator(llm, silentLogger);
    const [a, b] = await Promise.all([translator.catalog(polish), translator.catalog(polish)]);
    expect(a).toBe(b);
    expect(a.language).toBe(polish);
    expect(a.complete).toBe(true);
    expect(Object.keys(a.messages)).toEqual(Object.keys(sourceCatalog()));
    expect(a.messages['intro.title']).toBe(fakeTranslate('Find your future in Wigan'));
    const calls = llm.calls.length;
    await translator.catalog(polish);
    expect(llm.calls.length).toBe(calls);
  });
});

describe('parseTranslations', () => {
  const sources = ['Question {current} of {total}', 'Find help'];

  it('accepts a faithful translation', () => {
    expect(parseTranslations({ '1': 'Pytanie {current} z {total}', '2': 'Znajdź pomoc' }, sources)).toEqual(['Pytanie {current} z {total}', 'Znajdź pomoc']);
  });

  it.each([
    ['a missing string', { '1': 'Pytanie {current} z {total}' }],
    ['an empty string', { '1': 'Pytanie {current} z {total}', '2': ' ' }],
    ['a lost placeholder', { '1': 'Pytanie {current}', '2': 'Znajdź pomoc' }],
    ['a translated placeholder', { '1': 'Pytanie {bieżące} z {total}', '2': 'Znajdź pomoc' }],
    ['an added link', { '1': 'Pytanie {current} z {total}', '2': 'Znajdź pomoc na www.example.com' }],
    ['a runaway answer', { '1': 'Pytanie {current} z {total}', '2': 'x'.repeat(200) }],
    ['something that is not an object', ['Pytanie', 'Pomoc']],
  ])('rejects %s', (_, data) => {
    expect(() => parseTranslations(data, sources)).toThrow();
  });

  it('rejects a chunk the model mostly echoed back in English, but allows the odd unchanged word', () => {
    const titles = ['HGV / LGV driver', 'Digital & Tech', 'Logistics & Transport', 'Teacher'];
    expect(() => parseTranslations({ '1': 'HGV / LGV driver', '2': 'Digital & Tech', '3': 'Logistics & Transport', '4': 'Nauczyciel' }, titles)).toThrow(/untranslated/);
    expect(parseTranslations({ '1': 'Kierowca HGV / LGV', '2': 'Digital & Tech', '3': 'Logistyka i transport', '4': 'Nauczyciel' }, titles)).toHaveLength(4);
  });
});
