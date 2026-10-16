// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Footer, Header } from '../../../client/src/components/Header';
import { Intro } from '../../../client/src/components/Intro';
import { SECTORS } from '../../../shared/sectors.js';

describe('Wigan Council branding', () => {
  it('shows the Wigan Council name, service and prototype label', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Wigan Council home' })).toHaveAttribute('href', 'https://www.wigan.gov.uk/');
    expect(screen.getByText('Jobs & Skills')).toBeInTheDocument();
    expect(screen.getByText('Prototype')).toBeInTheDocument();
  });

  it('uses the Wigan Council colour palette', () => {
    const css = readFileSync(path.resolve(process.cwd(), 'client/src/styles.css'), 'utf8');
    expect(css).toContain('--teal: #005a73');
    expect(css).toContain('--green: #97be10');
  });

  it('explains privacy and AI use in the footer', () => {
    render(<Footer />);
    expect(screen.getByText(/don’t ask for your name/)).toBeInTheDocument();
    expect(screen.getByText(/written by AI/)).toBeInTheDocument();
  });
});

describe('Intro screen', () => {
  it('introduces the questionnaire and lists every in-demand Wigan sector', () => {
    render(<Intro onStart={() => undefined} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Find your future in Wigan' })).toBeInTheDocument();
    const chips = screen.getByRole('list', { name: 'In-demand sectors' });
    for (const s of SECTORS) expect(chips).toHaveTextContent(s.name);
  });

  it('starts when the big button is clicked', async () => {
    const onStart = vi.fn();
    render(<Intro onStart={onStart} />);
    await userEvent.click(screen.getByRole('button', { name: /let’s go/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
