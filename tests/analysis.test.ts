import { describe, expect, it } from 'vitest';
import { accreditationHubs, computeInsights, median, realCountries } from '../src/analysis';
import type { Country, Stats } from '../src/types';

function mkCountry(over: Partial<Country>): Country {
  return {
    name: 'Testland',
    iso2: 'TL',
    iso3: 'TST',
    region: 'Europe',
    lat: 0,
    lng: 0,
    historical: false,
    entity: false,
    territory: false,
    successor: null,
    bilateral: 0,
    multilateral: 0,
    inForceBilateral: 0,
    terminatedBilateral: 0,
    byDecade: {},
    byCategory: {},
    first: null,
    last: null,
    post: null,
    postCount: 0,
    coveredFrom: null,
    covers: [],
    sharedConsular: false,
    ftas: [],
    orgs: [],
    ...over,
  };
}

const baseStats: Stats = {
  meta: { generatedAt: '2026-07-13T00:00:00Z', atdExpected: 10, atdCollected: 10, missionEntries: 5, sources: {} },
  totals: { treaties: 10, bilateral: 6, multilateral: 4, countries: 3, residentPosts: 2, ftasInForce: 1 },
  statusTotals: {},
  catTotals: {},
  timeline: { 1950: { B: 2, M: 1 }, 1990: { B: 4, M: 3 } },
  ftas: [],
  organisations: [],
};

describe('median', () => {
  it('returns middle of odd-length list', () => {
    expect(median([1, 9, 5])).toBe(5);
  });
  it('averages middle two of even-length list', () => {
    expect(median([1, 3, 5, 9])).toBe(4);
  });
  it('returns 0 for empty list', () => {
    expect(median([])).toBe(0);
  });
});

describe('realCountries', () => {
  it('excludes historical, entity and territory rows', () => {
    const list = [
      mkCountry({ name: 'A' }),
      mkCountry({ name: 'USSR', historical: true }),
      mkCountry({ name: 'Intl', entity: true }),
      mkCountry({ name: 'Bermuda', territory: true }),
    ];
    expect(realCountries(list).map((c) => c.name)).toEqual(['A']);
  });
});

describe('computeInsights', () => {
  const countries = [
    mkCountry({ name: 'Bigland', bilateral: 100, inForceBilateral: 90, last: { id: '1', date: '2020-01-01', year: 2020, title: 't' } }),
    mkCountry({ name: 'Midland', bilateral: 10, last: { id: '2', date: '2019-01-01', year: 2019, title: 't' } }),
    mkCountry({ name: 'Smallland', bilateral: 2 }),
    mkCountry({ name: 'Dormantia', bilateral: 8, last: { id: '3', date: '1980-05-01', year: 1980, title: 'old' } }),
    mkCountry({ name: 'Hubland', covers: ['A', 'B', 'C', 'D', 'E', 'F'], post: { type: 'embassy', kind: 'Australian Embassy', city: 'X', australian: true, description: 'd' } }),
    mkCountry({ name: 'Churnland', bilateral: 12, terminatedBilateral: 6 }),
  ];

  it('identifies the top treaty partner', () => {
    const out = computeInsights(countries, baseStats);
    expect(out.some((i) => i.title.includes('Bigland'))).toBe(true);
  });

  it('flags dormant relationships older than 30 years', () => {
    const out = computeInsights(countries, baseStats);
    const dormant = out.find((i) => i.title.includes('Dormantia'));
    expect(dormant).toBeDefined();
    expect(dormant!.title).toContain('1980');
  });

  it('flags high termination rates', () => {
    const out = computeInsights(countries, baseStats);
    const churn = out.find((i) => i.title.includes('Churnland'));
    expect(churn).toBeDefined();
    expect(churn!.severity).toBe('alert');
  });

  it('reports accreditation hubs covering 5+ places', () => {
    const out = computeInsights(countries, baseStats);
    expect(out.some((i) => i.title.includes('Hubland'))).toBe(true);
  });

  it('finds the busiest decade from the timeline', () => {
    const out = computeInsights(countries, baseStats);
    const busiest = out.find((i) => i.title.includes('busiest treaty decade'));
    expect(busiest).toBeDefined();
    expect(busiest!.title).toContain('1990s');
  });

  it('handles an empty world without crashing', () => {
    expect(() => computeInsights([], baseStats)).not.toThrow();
  });
});

describe('accreditationHubs', () => {
  it('ranks hubs by coverage size', () => {
    const list = [
      mkCountry({ name: 'A', covers: ['x'] }),
      mkCountry({ name: 'B', covers: ['x', 'y', 'z'] }),
      mkCountry({ name: 'C' }),
    ];
    const hubs = accreditationHubs(list);
    expect(hubs.map((h) => h.hub.name)).toEqual(['B', 'A']);
  });
});
