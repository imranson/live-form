import { describe, expect, it } from 'vitest';
import { SECTORS, SECTOR_IDS, getSector, isSectorId } from '../../../shared/sectors.js';

describe('Wigan under-filled sector catalogue', () => {
  it('covers each sector id exactly once, in priority order', () => {
    expect(SECTORS.map((s) => s.id)).toEqual([...SECTOR_IDS]);
  });

  it('includes the sectors Wigan and Greater Manchester flag as hardest to fill', () => {
    expect(SECTOR_IDS).toEqual(
      expect.arrayContaining(['health-social-care', 'construction', 'engineering-manufacturing', 'logistics', 'education-childcare']),
    );
  });

  it.each(SECTORS.map((s) => [s.id, s] as const))('%s has roles with entry routes, evidence and a source', (_id, sector) => {
    expect(sector.roles.length).toBeGreaterThanOrEqual(2);
    for (const role of sector.roles) {
      expect(role.title).not.toHaveLength(0);
      expect(role.entry).not.toHaveLength(0);
    }
    expect(sector.evidence.length).toBeGreaterThan(20);
    expect(sector.evidenceUrl).toMatch(/^https:\/\//);
    expect(sector.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('includes at least one entry-level route per sector so nobody is excluded', () => {
    for (const sector of SECTORS) {
      const entryLevel = sector.roles.some((r) => /no qualifications|entry level|on the job|short course|apprenticeship/i.test(r.entry));
      expect(entryLevel, sector.id).toBe(true);
    }
  });

  it('looks sectors up by id and rejects unknown ids', () => {
    expect(getSector('logistics').name).toBe('Logistics & Transport');
    expect(() => getSector('astronaut' as never)).toThrow(/Unknown sector/);
    expect(isSectorId('digital')).toBe(true);
    expect(isSectorId('astronaut')).toBe(false);
    expect(isSectorId(42)).toBe(false);
  });
});
