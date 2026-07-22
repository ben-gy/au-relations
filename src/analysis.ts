// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Country, Stats } from './types';

export interface Insight {
  severity: 'info' | 'good' | 'warn' | 'alert';
  title: string;
  body: string;
  country?: string;
}

const median = (nums: number[]): number => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const realCountries = (countries: Country[]): Country[] =>
  countries.filter((c) => !c.historical && !c.entity && !c.territory);

/** Countries with an FTA but a thin treaty relationship, and vice versa. */
export function computeInsights(countries: Country[], stats: Stats): Insight[] {
  const out: Insight[] = [];
  const real = realCountries(countries);
  const bilats = real.map((c) => c.bilateral).filter((n) => n > 0);
  const med = median(bilats);

  // 1. Top treaty partner
  const top = [...real].sort((a, b) => b.bilateral - a.bilateral)[0];
  if (top) {
    out.push({
      severity: 'info',
      title: `${top.name} is Australia's densest treaty relationship`,
      body: `${top.bilateral} bilateral treaties — ${med ? Math.round(top.bilateral / med) : 0}× the median country's ${med}. The next closest has ${[...real].sort((a, b) => b.bilateral - a.bilateral)[1]?.bilateral ?? 0}.`,
      country: top.name,
    });
  }

  // 2. Busiest decade
  const decadeTotals = new Map<number, number>();
  for (const [year, v] of Object.entries(stats.timeline)) {
    const dec = Math.floor(Number(year) / 10) * 10;
    decadeTotals.set(dec, (decadeTotals.get(dec) ?? 0) + v.B + v.M);
  }
  const busiest = [...decadeTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (busiest) {
    out.push({
      severity: 'info',
      title: `The ${busiest[0]}s were Australia's busiest treaty decade`,
      body: `${busiest[1]} treaties were concluded in that decade — of ${stats.totals.treaties.toLocaleString()} in the database since 1901.`,
    });
  }

  // 3. Countries with no resident mission but big relationships
  const uncovered = real
    .filter((c) => !c.post?.australian && c.bilateral >= Math.max(5, med * 2))
    .sort((a, b) => b.bilateral - a.bilateral)
    .slice(0, 3);
  for (const c of uncovered) {
    out.push({
      severity: 'warn',
      title: `${c.name}: significant treaty relationship, no resident embassy`,
      body: `${c.bilateral} bilateral treaties, but Australia covers ${c.name} from ${c.coveredFrom ?? 'a regional post'}.`,
      country: c.name,
    });
  }

  // 4. FTA partners with thin treaty bases
  const ftaThin = real.filter((c) => c.ftas.length > 0 && c.bilateral > 0 && c.bilateral < med);
  if (ftaThin.length) {
    const names = ftaThin
      .sort((a, b) => a.bilateral - b.bilateral)
      .slice(0, 4)
      .map((c) => `${c.name} (${c.bilateral})`)
      .join(', ');
    out.push({
      severity: 'info',
      title: `${ftaThin.length} FTA partners have below-median treaty ties`,
      body: `Trade agreements don't always follow deep treaty relationships: ${names} all sit below the median of ${med} bilateral treaties.`,
    });
  }

  // 5. Termination rate outliers
  const termOutliers = real
    .filter((c) => c.bilateral >= 10 && c.terminatedBilateral / c.bilateral > 0.3)
    .sort((a, b) => b.terminatedBilateral / b.bilateral - a.terminatedBilateral / a.bilateral)
    .slice(0, 3);
  for (const c of termOutliers) {
    out.push({
      severity: 'alert',
      title: `${Math.round((c.terminatedBilateral / c.bilateral) * 100)}% of treaties with ${c.name} are terminated`,
      body: `${c.terminatedBilateral} of ${c.bilateral} bilateral treaties have been terminated or replaced — a sign of a relationship that has been renegotiated over time.`,
      country: c.name,
    });
  }

  // 6. Dormant relationships: had treaties, none in 30+ years
  const nowYear = 2026;
  const dormant = real
    .filter((c) => c.bilateral >= 5 && c.last && nowYear - c.last.year >= 30)
    .sort((a, b) => (a.last?.year ?? 0) - (b.last?.year ?? 0))
    .slice(0, 3);
  for (const c of dormant) {
    out.push({
      severity: 'warn',
      title: `${c.name}: no new treaty since ${c.last?.year}`,
      body: `A once-active relationship (${c.bilateral} bilateral treaties) with no new bilateral treaty in ${nowYear - (c.last?.year ?? nowYear)} years.`,
      country: c.name,
    });
  }

  // 7. Biggest accreditation hubs
  const hubs = countries
    .filter((c) => c.covers.length >= 5)
    .sort((a, b) => b.covers.length - a.covers.length)
    .slice(0, 3);
  for (const h of hubs) {
    out.push({
      severity: 'good',
      title: `${h.name} is a diplomatic hub covering ${h.covers.length} other places`,
      body: `Australia's mission there is accredited to: ${h.covers.slice(0, 8).join(', ')}${h.covers.length > 8 ? '…' : ''}.`,
      country: h.name,
    });
  }

  // 8. Coverage gaps: no bilateral treaties AND no diplomatic coverage at all
  const gaps = real.filter((c) => c.bilateral === 0 && !c.post && !c.coveredFrom);
  if (gaps.length) {
    out.push({
      severity: 'info',
      title: `${gaps.length} countries have no bilateral treaty and no listed coverage`,
      body: `${gaps
        .slice(0, 6)
        .map((c) => c.name)
        .join(', ')}${gaps.length > 6 ? '…' : ''} — any formal ties run only through multilateral conventions.`,
    });
  }

  // 9. Oldest still-in-force flavour: bilateral vs multilateral balance
  const b = stats.totals.bilateral;
  const m = stats.totals.multilateral;
  out.push({
    severity: 'info',
    title: `Multilateral treaties now outnumber bilateral ${m.toLocaleString()} to ${b.toLocaleString()}`,
    body: 'Australian diplomacy multilateralised after 1945 — conventions with many parties overtook one-to-one agreements as the dominant form of treaty-making.',
  });

  return out;
}

/** Rank hub countries by how many others their Australian mission covers. */
export function accreditationHubs(countries: Country[]): { hub: Country; covers: string[] }[] {
  return countries
    .filter((c) => c.covers.length > 0)
    .sort((a, b) => b.covers.length - a.covers.length)
    .map((c) => ({ hub: c, covers: c.covers }));
}

export { median };
