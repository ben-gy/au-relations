// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/** Format a number with locale separators. */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** ISO date (YYYY-MM-DD) → "12 Mar 1985". Returns em-dash for null. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

/** ISO2 country code → flag emoji. Returns empty string when unknown. */
export function flagEmoji(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2 || iso2 === 'EU') {
    return iso2 === 'EU' ? '🇪🇺' : '';
  }
  const base = 0x1f1e6;
  const a = iso2.toUpperCase().charCodeAt(0) - 65;
  const b = iso2.toUpperCase().charCodeAt(1) - 65;
  if (a < 0 || a > 25 || b < 0 || b > 25) return '';
  return String.fromCodePoint(base + a, base + b);
}

/** Country name → URL-friendly slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Debounce a function (trailing edge). */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 300): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Escape a string for safe insertion into innerHTML. */
export function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Ordinal decade label: 1950 → "1950s". */
export function decadeLabel(decade: number): string {
  return `${decade}s`;
}

/** Simple linear scale helper. */
export function scale(v: number, dMin: number, dMax: number, rMin: number, rMax: number): number {
  if (dMax === dMin) return (rMin + rMax) / 2;
  return rMin + ((v - dMin) / (dMax - dMin)) * (rMax - rMin);
}

/** Read/write a localStorage preference, tolerating disabled storage. */
export function pref(key: string): string | null;
export function pref(key: string, value: string): void;
export function pref(key: string, value?: string): string | null | void {
  try {
    if (value === undefined) return localStorage.getItem(`au-relations:${key}`);
    localStorage.setItem(`au-relations:${key}`, value);
  } catch {
    return null;
  }
}

export const STATUS_LABELS: Record<string, string> = {
  'in-force': 'In force',
  terminated: 'Terminated',
  'not-yet-in-force': 'Not yet in force',
  other: 'Other / signed',
};

export const CATEGORY_COLORS: Record<string, string> = {
  'Trade & Economic': '#b07a1e',
  Taxation: '#8a6ee0',
  'Defence & Security': '#b3423a',
  Nuclear: '#d1553f',
  'Extradition & Justice': '#7a5195',
  Aviation: '#3d7ab8',
  'Maritime & Fisheries': '#2a8a9d',
  Space: '#5c5ce0',
  'Science & Technology': '#3a8a5f',
  Environment: '#57862c',
  Health: '#c25585',
  'Migration & Consular': '#c07840',
  'Social Security': '#a3699a',
  'Culture & Education': '#c9a227',
  Communications: '#557dab',
  'Development & Aid': '#4a9a83',
  Labour: '#916a48',
  Other: '#8a8f98',
};

export function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
}

export const REGION_ORDER = [
  'Pacific',
  'Southeast Asia',
  'Northeast Asia',
  'South & Central Asia',
  'Middle East',
  'Europe',
  'Africa',
  'North America',
  'Latin America & Caribbean',
  'Other',
];
