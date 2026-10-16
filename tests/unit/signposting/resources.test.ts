import { describe, expect, it } from 'vitest';
import { RESOURCES, getResource } from '../../../shared/resources.js';

const all = Object.entries(RESOURCES);

describe('signposting resource catalogue', () => {
  it.each(all)('%s is complete and uses a secure link', (key, resource) => {
    expect(resource.id).toBe(key);
    expect(resource.url).toMatch(/^https:\/\/[^\s]+$/);
    expect(resource.title.length).toBeGreaterThan(2);
    expect(resource.provider.length).toBeGreaterThan(2);
    expect(resource.description.length).toBeGreaterThan(20);
  });

  it('has no duplicate links', () => {
    const urls = all.map(([, r]) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('includes core Wigan Council services', () => {
    const council = all.filter(([, r]) => r.url.startsWith('https://www.wigan.gov.uk/')).map(([id]) => id);
    expect(council).toEqual(
      expect.arrayContaining(['councilJobsHub', 'adultLearning', 'inWorkProgression', 'supportedEmployment', 'redundancySupport', 'apprenticeships']),
    );
  });

  it('formats phone numbers as UK numbers', () => {
    for (const [, r] of all) if ('phone' in r && r.phone) expect(r.phone).toMatch(/^0\d{3,4} ?\d{3} ?\d{3,4}$/);
  });

  it('looks resources up by id', () => {
    expect(getResource('nationalCareers').provider).toBe('GOV.UK');
  });
});
