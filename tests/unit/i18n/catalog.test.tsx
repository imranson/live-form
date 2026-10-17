// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intro } from '../../../client/src/components/Intro';
import { ApiError } from '../../../client/src/api';
import { I18nProvider, useI18n } from '../../../client/src/i18n';
import { BADGES, LEVELS } from '../../../shared/game.js';
import { CATALOG_VERSION, format, localizeSector, placeholdersOf, sourceCatalog, UI_MESSAGES } from '../../../shared/i18n.js';
import { getSector, SECTORS } from '../../../shared/sectors.js';
import type { TranslationResponse } from '../../../shared/types.js';
import { fakeTranslate } from '../../helpers.js';

describe('English source catalog', () => {
  const catalog = sourceCatalog();

  it('covers every sector, badge and level shown in the UI', () => {
    for (const s of SECTORS) {
      expect(catalog[`sector.${s.id}.name`]).toBe(s.name);
      expect(catalog[`sector.${s.id}.blurb`]).toBe(s.blurb);
      s.roles.forEach((r, i) => expect(catalog[`sector.${s.id}.role${i}.entry`]).toBe(r.entry));
    }
    for (const b of Object.values(BADGES)) expect(catalog[`badge.${b.id}.name`]).toBe(b.name);
    for (const l of LEVELS) expect(catalog[`level.${l.number}`]).toBe(l.name);
    expect(catalog['intro.title']).toBe(UI_MESSAGES['intro.title']);
  });

  it('fills placeholders and leaves unknown ones alone', () => {
    expect(format('Question {current} of {total}', { current: 2, total: 8 })).toBe('Question 2 of 8');
    expect(format('Hi {name}')).toBe('Hi {name}');
    expect(placeholdersOf('Level {level} · {name} · {xp} XP')).toEqual(['level', 'name', 'xp']);
  });

  it('localises sectors from a translated catalog, falling back to English', () => {
    const sector = getSector('construction');
    const translated = localizeSector(sector, { 'sector.construction.name': 'Budownictwo' });
    expect(translated).toMatchObject({ id: 'construction', name: 'Budownictwo', blurb: sector.blurb, color: sector.color });
  });
});

const polishTranslation = (): TranslationResponse => ({
  language: { code: 'pl', name: 'Polish', nativeName: 'Polski', dir: 'ltr' },
  messages: Object.fromEntries(Object.entries(sourceCatalog()).map(([k, v]) => [k, fakeTranslate(v)])),
  complete: true,
});

describe('language picker on the start screen', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  function Harness({ translate }: { translate: (input: string) => Promise<TranslationResponse> }) {
    const { setTranslation } = useI18n();
    return <Intro onStart={() => undefined} onTranslate={async (input) => setTranslation(await translate(input))} />;
  }

  it('translates the whole start screen into the language typed', async () => {
    const user = userEvent.setup();
    const translate = vi.fn(async () => polishTranslation());
    render(
      <I18nProvider>
        <Harness translate={translate} />
      </I18nProvider>,
    );

    await user.type(screen.getByLabelText(/Language/), 'Polski');
    await user.click(screen.getByRole('button', { name: 'Translate' }));

    expect(translate).toHaveBeenCalledWith('Polski');
    expect(await screen.findByRole('heading', { level: 1, name: fakeTranslate('Find your future in Wigan') })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: fakeTranslate('In-demand sectors') })).toHaveTextContent(fakeTranslate('Health & Social Care'));
    expect(screen.getByText(fakeTranslate(UI_MESSAGES['language.notice']), { exact: false })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pl');

    // Remembered for next time, and one click gets back to English.
    expect(localStorage.getItem('live-form:translation')).toContain('"code":"pl"');
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Find your future in Wigan' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en-GB');
    expect(localStorage.getItem('live-form:translation')).toBeNull();
  });

  it('switches the page to right-to-left for languages like Urdu', async () => {
    const user = userEvent.setup();
    const urdu = { ...polishTranslation(), language: { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl' as const } };
    render(
      <I18nProvider>
        <Harness translate={async () => urdu} />
      </I18nProvider>,
    );
    await user.type(screen.getByLabelText(/Language/), 'اردو');
    await user.click(screen.getByRole('button', { name: 'Translate' }));
    await screen.findByRole('heading', { level: 1, name: fakeTranslate('Find your future in Wigan') });
    expect(document.documentElement.dir).toBe('rtl');
  });

  it.each([
    [422, UI_MESSAGES['language.errorUnknown']],
    [400, UI_MESSAGES['language.errorInvalid']],
    [503, UI_MESSAGES['language.errorUnavailable']],
  ])('explains a %i from the server', async (status, message) => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Harness translate={async () => Promise.reject(new ApiError(status, 'nope'))} />
      </I18nProvider>,
    );
    await user.type(screen.getByLabelText(/Language/), 'Blah');
    await user.click(screen.getByRole('button', { name: 'Translate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('heading', { level: 1, name: 'Find your future in Wigan' })).toBeInTheDocument();
  });

  it('restores a saved translation on reload, unless the English text has changed since', () => {
    const save = (version: string) => localStorage.setItem('live-form:translation', JSON.stringify({ version, translation: polishTranslation() }));
    const title = () => {
      const { unmount } = render(
        <I18nProvider>
          <Intro onStart={() => undefined} />
        </I18nProvider>,
      );
      const text = screen.getByRole('heading', { level: 1 }).textContent;
      unmount();
      return text;
    };

    save(CATALOG_VERSION);
    expect(title()).toBe(fakeTranslate('Find your future in Wigan'));
    save('stale');
    expect(title()).toBe('Find your future in Wigan');
  });
});
