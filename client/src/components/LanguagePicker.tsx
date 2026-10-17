import { useState, type FormEvent } from 'react';
import type { UiKey } from '../../../shared/i18n.js';
import { ApiError } from '../api';
import { useI18n } from '../i18n';

// Wigan's most common community languages, each written in its own script. Residents can type any other.
const SUGGESTIONS = ['English', 'Polski', 'Română', 'اردو', 'العربية', 'Português', 'Lietuvių', 'Українська', 'বাংলা', '中文', 'Kurdî', 'فارسی', 'Soomaali', 'Español', 'Français', 'Türkçe', 'Magyar', 'Slovenčina'];

function errorKey(err: unknown): UiKey {
  if (!(err instanceof ApiError)) return 'error.generic';
  if (err.status === 0) return 'error.offline';
  if (err.status === 400) return 'language.errorInvalid';
  if (err.status === 422) return 'language.errorUnknown';
  if (err.status === 503) return 'language.errorUnavailable';
  return 'error.generic';
}

export function LanguagePicker({ onTranslate }: { onTranslate: (language: string) => Promise<void> }) {
  const { t, english, complete, language, setTranslation } = useI18n();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UiKey | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = value.trim();
    if (!input || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onTranslate(input);
      setValue('');
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="language" onSubmit={submit} aria-busy={busy}>
      <label className="language__label" htmlFor="language-input">
        <span aria-hidden="true">🌐</span> {t('language.label')}
        {!english && <span lang="en"> · Language</span>}
      </label>
      <div className="language__row">
        <input
          id="language-input"
          className="language__input"
          list="language-suggestions"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={english ? 'Polski, اردو, Română…' : `${language.nativeName}, English…`}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
        />
        <button type="submit" className="btn btn--secondary language__submit" disabled={busy || !value.trim()}>
          {t('language.submit')}
        </button>
      </div>
      <datalist id="language-suggestions">
        {SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p className="language__status" role="status" aria-live="polite">
        {busy && t('language.working')}
      </p>
      {error && (
        <p className="language__error" role="alert">
          {t(error)}
        </p>
      )}
      {!english && (
        <p className="language__notice fine-print">
          {t('language.notice')} {!complete && t('language.partial')}{' '}
          <button type="button" className="link-button" lang="en" onClick={() => setTranslation(null)}>
            English
          </button>
        </p>
      )}
    </form>
  );
}
