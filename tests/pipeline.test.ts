import { describe, expect, it } from 'vitest';
// The pipeline modules are plain ESM (.mjs) — vitest can import them directly.
import { categorise, deriveStatus, trimTreaty, parsePost } from '../pipeline/aggregate.mjs';
import { parseMissions } from '../pipeline/collect.mjs';

describe('categorise', () => {
  it('classifies taxation treaties', () => {
    expect(categorise('Taxation - Double Taxation', 'Agreement for the avoidance of double taxation')).toBe('Taxation');
  });
  it('classifies air services treaties', () => {
    expect(categorise('Air Services', 'Agreement relating to Air Services')).toBe('Aviation');
  });
  it('classifies extradition', () => {
    expect(categorise('Extradition', 'Treaty on Extradition')).toBe('Extradition & Justice');
  });
  it('falls back to Other for the unknown', () => {
    expect(categorise('Zorbing', 'Agreement on competitive zorbing')).toBe('Other');
  });
  it('uses the title when subject is null', () => {
    expect(categorise(null, 'Convention on nuclear safety')).toBe('Nuclear');
  });
});

describe('deriveStatus', () => {
  it('marks terminated when a termination action exists', () => {
    expect(
      deriveStatus({ TreatyActions: [{ Action: 'Terminated', Date: '1999-01-01' }], EntryIntoForceForAustraliaDate: '1980-01-01' }),
    ).toBe('terminated');
  });
  it('marks in-force when an EIF date exists', () => {
    expect(deriveStatus({ TreatyActions: [], EntryIntoForceForAustraliaDate: '1980-01-01' })).toBe('in-force');
  });
  it('marks not-yet-in-force from ATNIF number', () => {
    expect(deriveStatus({ TreatyActions: [], AtnifNumber: '[2024] ATNIF 3' })).toBe('not-yet-in-force');
  });
  it('falls back to other', () => {
    expect(deriveStatus({ TreatyActions: [] })).toBe('other');
  });
});

describe('trimTreaty', () => {
  const raw = {
    Id: '1022',
    Title: 'Exchange of Notes with Turkey regarding Visas',
    AgreementType: 'Bilateral',
    Countries: ['Turkey'],
    Subject: 'Visas',
    DoneAtPlace: 'Ankara',
    DoneAtDate: '1956-04-10T00:00:00Z',
    EntryIntoForceForAustraliaDate: '1956-05-10T00:00:00Z',
    AtsNumber: '[1956] ATS 9',
    AtsLink: 'https://example.org/ats',
    TreatyActions: [{ Date: '1999-06-04T00:00:00Z', Action: 'Terminated' }],
  };
  it('trims to the compact site model', () => {
    const t = trimTreaty(raw);
    expect(t.id).toBe('1022');
    expect(t.type).toBe('B');
    expect(t.year).toBe(1956);
    expect(t.date).toBe('1956-04-10');
    expect(t.status).toBe('terminated');
    expect(t.category).toBe('Migration & Consular');
    expect(t.actions).toEqual([{ date: '1999-06-04', action: 'Terminated' }]);
  });
  it('handles missing fields gracefully', () => {
    const t = trimTreaty({ Id: 'x', Title: 't', AgreementType: 'Multilateral' });
    expect(t.type).toBe('M');
    expect(t.year).toBeNull();
    expect(t.countries).toEqual([]);
    expect(t.link).toBeNull();
  });
});

describe('parsePost', () => {
  it('parses an embassy description', () => {
    expect(parsePost('Australian Embassy - Buenos Aires')).toEqual({
      type: 'embassy',
      kind: 'Australian Embassy',
      city: 'Buenos Aires',
      australian: true,
      description: 'Australian Embassy - Buenos Aires',
    });
  });
  it('parses a high commission', () => {
    const p = parsePost('Australian High Commission - Dhaka');
    expect(p?.type).toBe('high-commission');
  });
  it('recognises non-Australian posts', () => {
    const p = parsePost('Canadian Embassy - Algiers');
    expect(p?.australian).toBe(false);
  });
  it('returns null for null input', () => {
    expect(parsePost(null)).toBeNull();
  });
});

describe('parseMissions', () => {
  const html = `
    <h3 id="a">A</h3><ul class="links">
      <li><strong>Afghanistan</strong></li>
      <li><strong>Albania</strong> - see <a href="/x" title="Australian Embassy, Italy">Italy</a></li>
      <li><a href="/y">* <strong>Algeria</strong> (Canadian Embassy - Algiers)</a> - see also <a href="/z">France</a></li>
      <li><a href="/w" title="Australian Embassy, Argentina"><strong>Argentina</strong> (Australian Embassy - Buenos Aires)</a></li>
    </ul>
    <h3 id="b">B</h3><ul class="links">
      <li><strong>Bangladesh</strong> (Australian High Commission - Dhaka)</li>
    </ul>
    <h3 id="c">C</h3><ul class="links">
      <li><a href="/c"><strong>China (People's Republic of)</strong> (Australian Embassy - Beijing)</a></li>
      <li><strong>Korea, Democratic People's Republic of</strong> (North Korea) - see <a href="/k">Korea, Republic of</a></li>
    </ul>
    <h3 id="s">S</h3><ul class="links">
      <li><a href="/s"><strong>Singapore</strong> (Australian High Commission - Singapore</a></li>
    </ul>`;

  it('parses every list item into an entry', () => {
    expect(parseMissions(html)).toHaveLength(8);
  });
  it('skips name parens and finds the post parens', () => {
    const cn = parseMissions(html).find((e) => e.country.startsWith('China'));
    expect(cn?.post).toBe('Australian Embassy - Beijing');
  });
  it('ignores annotation parens that are not posts', () => {
    const nk = parseMissions(html).find((e) => e.country.startsWith('Korea, Democratic'));
    expect(nk?.post).toBeNull();
    expect(nk?.coveredFrom).toBe('Korea, Republic of');
  });
  it('tolerates a missing closing paren (Singapore typo)', () => {
    const sg = parseMissions(html).find((e) => e.country === 'Singapore');
    expect(sg?.post).toBe('Australian High Commission - Singapore');
  });
  it('captures resident posts', () => {
    const arg = parseMissions(html).find((e) => e.country === 'Argentina');
    expect(arg?.post).toBe('Australian Embassy - Buenos Aires');
    expect(arg?.coveredFrom).toBeNull();
  });
  it('captures accreditation referrals', () => {
    const alb = parseMissions(html).find((e) => e.country === 'Albania');
    expect(alb?.coveredFrom).toBe('Italy');
    expect(alb?.post).toBeNull();
  });
  it('flags shared consular entries and keeps their referral', () => {
    const alg = parseMissions(html).find((e) => e.country === 'Algeria');
    expect(alg?.sharedConsular).toBe(true);
    expect(alg?.post).toBe('Canadian Embassy - Algiers');
    expect(alg?.coveredFrom).toBe('France');
  });
  it('leaves countries with no coverage empty', () => {
    const afg = parseMissions(html).find((e) => e.country === 'Afghanistan');
    expect(afg?.post).toBeNull();
    expect(afg?.coveredFrom).toBeNull();
  });
});
