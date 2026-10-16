import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// React Testing Library only auto-cleans with test globals; do it explicitly for DOM test files.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}
