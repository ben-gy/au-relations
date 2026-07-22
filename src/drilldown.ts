// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { AppData, Country, Treaty } from './types';
import { loadTreaties } from './data';
import { categoryColor, decadeLabel, esc, flagEmoji, formatDate, formatNumber, slugify } from './utils';
import { el, svgEl, hoverTip } from './dom';
import { glossarySpan } from './glossary';

let panel: HTMLElement | null = null;
let backdrop: HTMLElement | null = null;
let openFor: string | null = null;

export function closeDrilldown(): void {
  panel?.remove();
  backdrop?.remove();
  panel = null;
  backdrop = null;
  openFor = null;
}

function dropCountryFromHash(): void {
  const h = window.location.hash.replace(/^#/, '').split('&').filter((p) => !p.startsWith('country='));
  window.location.hash = `#${h.join('&')}`;
}

/** Switch drill-down to another country (keeps current view). */
function go(name: string): void {
  const h = window.location.hash.replace(/^#/, '').split('&').filter((p) => !p.startsWith('country='));
  h.push(`country=${slugify(name)}`);
  window.location.hash = `#${h.join('&')}`;
}

export function openDrilldown(country: Country, data: AppData): void {
  if (openFor === country.name) return;
  closeDrilldown();
  openFor = country.name;

  backdrop = el('div', { class: 'drill-backdrop' });
  backdrop.addEventListener('click', dropCountryFromHash);
  document.body.appendChild(backdrop);

  panel = el('aside', { class: 'drill-panel', role: 'dialog', 'aria-label': `${country.name} relationship details` });
  document.body.appendChild(panel);
  document.addEventListener('keydown', escClose);
  render(country, data);
}

function escClose(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    document.removeEventListener('keydown', escClose);
    dropCountryFromHash();
  }
}

function decadeChart(c: Country): SVGSVGElement {
  const decades = Object.entries(c.byDecade)
    .map(([d, n]) => [Number(d), n] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const W = 480;
  const H = 90;
  const pad = 4;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H + 18}`, role: 'img', 'aria-label': 'Treaties per decade' });
  if (!decades.length) return svg;
  const max = Math.max(...decades.map((d) => d[1]));
  const span = (decades[decades.length - 1][0] - decades[0][0]) / 10 + 1;
  const bw = Math.min(34, (W - pad * 2) / span - 3);
  for (const [dec, n] of decades) {
    const i = (dec - decades[0][0]) / 10;
    const h = Math.max(2, (n / max) * H);
    const x = pad + i * ((W - pad * 2) / span);
    const rect = svgEl('rect', { x, y: H - h, width: bw, height: h, rx: 2, fill: 'var(--accent-primary)', opacity: 0.8 });
    hoverTip(rect, () => `<span class="tt-title">${decadeLabel(dec)}</span><br>${n} treaties`);
    svg.appendChild(rect);
    if (dec % 20 === 0) {
      const t = svgEl('text', { x: x + bw / 2, y: H + 13, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--text-tertiary)' });
      t.textContent = `${dec}s`;
      svg.appendChild(t);
    }
  }
  return svg;
}

function render(c: Country, data: AppData): void {
  if (!panel) return;
  const flag = flagEmoji(c.iso2);

  const postHtml = c.post
    ? c.post.australian
      ? `Australia has a resident ${glossarySpan(
          c.post.type === 'high-commission' ? 'high commission' : c.post.type,
          c.post.kind,
        )}${c.post.city ? ` in <strong>${esc(c.post.city)}</strong>` : ''}${
          c.postCount > 1 ? ` plus ${c.postCount - 1} other post${c.postCount > 2 ? 's' : ''}` : ''
        }.`
      : `${esc(c.post.description)} provides services${c.sharedConsular ? ` (${glossarySpan('shared consular', 'shared consular arrangement')} with Canada)` : ''}.`
    : c.coveredFrom
      ? `No resident Australian mission — covered by ${glossarySpan('accreditation')} from the Australian mission in <button class="country-link" data-go="${esc(c.coveredFrom)}">${esc(c.coveredFrom)}</button>.`
      : c.historical
        ? 'Former state — shown for historical treaty attribution.'
        : 'No resident Australian mission listed.';

  const ftaList = data.stats.ftas.filter((f) => c.ftas.includes(f.code));
  const orgList = data.stats.organisations.filter((o) => c.orgs.includes(o.code));

  panel.innerHTML = `
    <div class="drill-head">
      <span class="flag" aria-hidden="true">${flag}</span>
      <div>
        <h2>${esc(c.name)}</h2>
        <div class="region">${esc(c.region)}${c.historical ? ' · former state' : ''}${c.territory ? ' · territory' : ''}${
          c.successor ? ` · successor: ${esc(c.successor)}` : ''
        }</div>
      </div>
      <button class="drill-close" aria-label="Close panel">×</button>
    </div>
    <div class="drill-stats">
      <div class="stat-card"><div class="v num">${formatNumber(c.bilateral)}</div><div class="l">${glossarySpan('bilateral')} treaties</div></div>
      <div class="stat-card"><div class="v num">${formatNumber(c.inForceBilateral)}</div><div class="l">in force</div></div>
      <div class="stat-card"><div class="v num">${formatNumber(c.terminatedBilateral)}</div><div class="l">${glossarySpan('terminated')}</div></div>
      <div class="stat-card"><div class="v num">${c.postCount || '0'}</div><div class="l">Australian posts</div></div>
    </div>

    <div class="drill-section"><h3>Diplomatic presence</h3><p class="note">${postHtml}</p>
      ${c.covers.length ? `<p class="note">The Australian mission here also covers: ${c.covers.map((n) => `<button class="country-link" data-go="${esc(n)}">${esc(n)}</button>`).join(', ')}.</p>` : ''}
    </div>

    <div class="drill-section"><h3>Trade agreements</h3>
      ${
        ftaList.length
          ? `<div class="badge-row">${ftaList
              .map(
                (f) =>
                  `<span class="pill fta" title="${esc(f.name)}">${esc(f.code)}${f.status === 'under-negotiation' ? ' (negotiating)' : ''}</span>`,
              )
              .join('')}</div>`
          : `<p class="note">No ${glossarySpan('FTA', 'free trade agreement')} with Australia.</p>`
      }
    </div>

    <div class="drill-section"><h3>Shared memberships</h3>
      ${
        orgList.length
          ? `<div class="badge-row">${orgList.map((o) => `<span class="pill org" title="${esc(o.name)}">${esc(o.code)}</span>`).join('')}</div>`
          : '<p class="note">No selective organisations in common (both are UN/WTO members like nearly all states).</p>'
      }
    </div>

    <div class="drill-section"><h3>Treaty activity by decade</h3><div id="drill-decades"></div></div>

    <div class="drill-section"><h3>Top treaty subjects</h3>
      <div class="badge-row">${Object.entries(c.byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([cat, n]) => `<span class="pill cat" style="background:${categoryColor(cat)}">${esc(cat)} · ${n}</span>`)
        .join('')}</div>
    </div>

    ${
      c.first
        ? `<div class="drill-section"><h3>First &amp; latest</h3>
      <p class="note"><strong>${c.first.year}:</strong> ${esc(c.first.title)}</p>
      ${c.last && c.last.id !== c.first.id ? `<p class="note"><strong>${c.last.year}:</strong> ${esc(c.last.title)}</p>` : ''}</div>`
        : ''
    }

    <div class="drill-section"><h3>Bilateral treaties (${formatNumber(c.bilateral)})</h3>
      <div id="drill-treaties" class="loading">Loading treaties…</div>
    </div>`;

  panel.querySelector('.drill-close')!.addEventListener('click', dropCountryFromHash);
  panel.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => {
    b.addEventListener('click', () => go(b.dataset.go!));
  });
  panel.querySelector('#drill-decades')!.appendChild(decadeChart(c));

  void loadTreaties()
    .then((all) => {
      if (!panel || openFor !== c.name) return;
      const mine = all
        .filter((t) => t.type === 'B' && t.countries.includes(c.name))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      const target = panel.querySelector('#drill-treaties')!;
      target.classList.remove('loading');
      if (!mine.length) {
        target.innerHTML =
          '<p class="note">No bilateral treaties recorded — any formal ties run through multilateral conventions, which the source database does not attribute to individual member countries.</p>';
        return;
      }
      target.innerHTML = `<ul class="treaty-list">${mine.map(treatyRow).join('')}</ul>`;
    })
    .catch(() => {
      const target = panel?.querySelector('#drill-treaties');
      if (target) target.innerHTML = '<p class="note">Could not load the treaty list.</p>';
    });
}

function treatyRow(t: Treaty): string {
  return `<li>
    <div class="t-title">${t.link ? `<a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.title)}</a>` : esc(t.title)}</div>
    <div class="t-meta">
      <span class="pill ${t.status}">${esc(statusLabel(t.status))}</span>
      <span class="pill cat" style="background:${categoryColor(t.category)}">${esc(t.category)}</span>
      <span>${formatDate(t.date)}</span>
      ${t.ats ? `<span class="num">${esc(t.ats)}</span>` : ''}
    </div>
  </li>`;
}

function statusLabel(s: string): string {
  return { 'in-force': 'In force', terminated: 'Terminated', 'not-yet-in-force': 'Not yet in force', other: 'Signed/other' }[s] ?? s;
}
