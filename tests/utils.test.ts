import { describe, expect, it, vi } from 'vitest';
import { debounce, decadeLabel, esc, flagEmoji, formatDate, formatNumber, scale, slugify } from '../src/utils';

describe('formatNumber', () => {
  it('formats thousands with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
  it('handles negative numbers', () => {
    expect(formatNumber(-1234)).toBe('-1,234');
  });
  it('handles decimals when requested', () => {
    expect(formatNumber(1234.567, 2)).toBe('1,234.57');
  });
});

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('1976-03-12')).toBe('12 Mar 1976');
  });
  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });
  it('returns em-dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });
  it('passes through malformed strings', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('flagEmoji', () => {
  it('returns the Australian flag for AU', () => {
    expect(flagEmoji('AU')).toBe('🇦🇺');
  });
  it('returns the EU flag for EU', () => {
    expect(flagEmoji('EU')).toBe('🇪🇺');
  });
  it('returns empty string for null', () => {
    expect(flagEmoji(null)).toBe('');
  });
  it('returns empty string for junk', () => {
    expect(flagEmoji('1!')).toBe('');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('New Zealand')).toBe('new-zealand');
  });
  it('strips diacritics', () => {
    expect(slugify('Türkiye')).toBe('turkiye');
  });
  it('handles punctuation-heavy names', () => {
    expect(slugify("Korea, Democratic People's Republic of")).toBe('korea-democratic-people-s-republic-of');
  });
  it('handles ampersands', () => {
    expect(slugify('Wallis & Futuna')).toBe('wallis-futuna');
  });
});

describe('esc', () => {
  it('escapes HTML entities', () => {
    expect(esc('<a b="c">&')).toBe('&lt;a b=&quot;c&quot;&gt;&amp;');
  });
  it('returns empty string for null', () => {
    expect(esc(null)).toBe('');
  });
});

describe('scale', () => {
  it('maps linearly between ranges', () => {
    expect(scale(5, 0, 10, 0, 100)).toBe(50);
  });
  it('handles degenerate domain', () => {
    expect(scale(5, 5, 5, 0, 100)).toBe(50);
  });
});

describe('decadeLabel', () => {
  it('appends s', () => {
    expect(decadeLabel(1950)).toBe('1950s');
  });
});

describe('debounce', () => {
  it('collapses rapid calls into one trailing call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    d(3);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(120);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
    vi.useRealTimers();
  });
});
