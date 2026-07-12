import './style.css';
import { loadCore } from './data';
import type { AppData } from './types';
import { initGlossary } from './glossary';
import { debounce, esc, flagEmoji, formatDate, pref, slugify } from './utils';
import { el } from './dom';
import { openAbout } from './about';
import { openDrilldown, closeDrilldown } from './drilldown';
import { renderCountries } from './views/countries';
import { renderMap } from './views/map';
import { renderTreaties } from './views/treaties';
import { renderTimeline } from './views/timeline';
import { renderNetwork } from './views/network';
import { renderMatrix } from './views/matrix';
import { renderInsights } from './views/insights';

type ViewRenderer = (container: HTMLElement, data: AppData) => void | (() => void);

const VIEWS: { id: string; label: string; render: ViewRenderer }[] = [
  { id: 'countries', label: 'Countries', render: renderCountries },
  { id: 'map', label: 'World map', render: renderMap },
  { id: 'treaties', label: 'Treaty database', render: renderTreaties },
  { id: 'timeline', label: 'Timeline', render: renderTimeline },
  { id: 'network', label: 'Embassy network', render: renderNetwork },
  { id: 'matrix', label: 'Subject matrix', render: renderMatrix },
  { id: 'insights', label: 'Insights', render: renderInsights },
];

let data: AppData | null = null;
let cleanup: (() => void) | null = null;
let currentView = '';

function parseHash(): { view: string; country: string | null } {
  const h = window.location.hash.replace(/^#/, '');
  const parts = h.split('&');
  let view = '';
  let country: string | null = null;
  for (const p of parts) {
    if (p.startsWith('country=')) country = decodeURIComponent(p.slice(8));
    else if (p) view = p;
  }
  if (!VIEWS.some((v) => v.id === view)) view = '';
  return { view, country };
}

export function setHash(view: string, countrySlug?: string | null): void {
  const parts = [view || currentView || 'countries'];
  if (countrySlug) parts.push(`country=${countrySlug}`);
  const next = `#${parts.join('&')}`;
  if (window.location.hash !== next) window.location.hash = next;
}

function route(): void {
  if (!data) return;
  const { view, country } = parseHash();
  const target = view || pref('view') || 'countries';

  if (target !== currentView) {
    currentView = target;
    pref('view', target);
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === target);
    });
    const container = document.getElementById('view-root')!;
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    container.innerHTML = '';
    const def = VIEWS.find((v) => v.id === target)!;
    const result = def.render(container, data);
    if (typeof result === 'function') cleanup = result;
  }

  if (country) {
    const c = data.countries.find((x) => slugify(x.name) === country);
    if (c) openDrilldown(c, data);
  } else {
    closeDrilldown();
  }
}

function buildShell(root: HTMLElement, appData: AppData): void {
  const header = el('header', { class: 'site-header', role: 'banner' });
  const inner = el('div', { class: 'header-inner' });

  const brand = el(
    'a',
    { class: 'brand', href: '#countries', 'aria-label': 'Foreign Relations home' },
    `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="12" fill="#1e3a5f"/><circle cx="32" cy="32" r="20" fill="none" stroke="#e8b34b" stroke-width="2.5"/><ellipse cx="32" cy="32" rx="9" ry="20" fill="none" stroke="#e8b34b" stroke-width="2"/><line x1="12" y1="32" x2="52" y2="32" stroke="#e8b34b" stroke-width="2"/></svg>
     <span><span class="brand-name">Foreign Relations</span><span class="brand-sub">Australia's treaties, embassies &amp; agreements</span></span>`,
  );
  inner.appendChild(brand);

  // country quick-search
  const search = el('div', { class: 'country-search', role: 'search' });
  search.innerHTML = `<span class="search-icon" aria-hidden="true">⌕</span>
    <input type="search" placeholder="Find a country…" aria-label="Find a country" autocomplete="off" />`;
  const resultsBox = el('div', { class: 'search-results', role: 'listbox' });
  resultsBox.style.display = 'none';
  search.appendChild(resultsBox);
  const input = search.querySelector('input')!;
  const closeResults = () => {
    resultsBox.style.display = 'none';
  };
  const runSearch = () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 1) return closeResults();
    const hits = appData.countries
      .filter((c) => !c.entity && c.name.toLowerCase().includes(q))
      .slice(0, 12);
    resultsBox.innerHTML = '';
    if (!hits.length) {
      resultsBox.innerHTML = `<button disabled>No countries match "${esc(q)}"</button>`;
    }
    for (const c of hits) {
      const b = el(
        'button',
        { type: 'button' },
        `<span class="flag">${flagEmoji(c.iso2)}</span> ${esc(c.name)} <span class="muted num">${c.bilateral} treaties</span>`,
      );
      b.addEventListener('click', () => {
        input.value = '';
        closeResults();
        setHash(currentView, slugify(c.name));
      });
      resultsBox.appendChild(b);
    }
    resultsBox.style.display = 'block';
  };
  input.addEventListener('input', debounce(runSearch, 250));
  input.addEventListener('focus', runSearch);
  document.addEventListener('click', (e) => {
    if (!search.contains(e.target as Node)) closeResults();
  });
  inner.appendChild(search);

  const aboutBtn = el('button', { class: 'about-btn', 'aria-label': 'About this site', title: 'About this site' }, '?');
  aboutBtn.addEventListener('click', () => openAbout(appData));
  inner.appendChild(aboutBtn);
  header.appendChild(inner);

  const tabs = el('nav', { class: 'view-tabs', 'aria-label': 'Views' });
  const tabsInner = el('div', { class: 'tabs-inner' });
  for (const v of VIEWS) {
    const b = el('button', { class: 'tab-btn', 'data-view': v.id, type: 'button' }, v.label);
    b.addEventListener('click', () => setHash(v.id));
    tabsInner.appendChild(b);
  }
  tabs.appendChild(tabsInner);
  header.appendChild(tabs);
  root.appendChild(header);

  const main = el('main', { class: 'main-content' });
  main.appendChild(el('div', { id: 'view-root' }));
  root.appendChild(main);

  const gen = formatDate(appData.stats.meta.generatedAt.slice(0, 10));
  const footer = el(
    'footer',
    { class: 'site-footer', role: 'contentinfo' },
    `<div class="footer-inner">
      <div>Built by <a href="https://benrichardson.dev/">benrichardson.dev</a> · <a href="https://sites.benrichardson.dev" target="_blank" rel="noopener">more tools &amp; sites</a></div>
      <div class="footer-sources">Data: DFAT Australian Treaties Database, DFAT overseas missions list, and DFAT trade-agreement pages. Not an official DFAT product; verify treaty status against the <a href="https://www.dfat.gov.au/international-relations/treaties/australian-treaties-database" target="_blank" rel="noopener">official database</a> before relying on it. Data refreshed ${gen}.</div>
    </div>`,
  );
  root.appendChild(footer);
}

async function init(): Promise<void> {
  const root = document.getElementById('app')!;
  root.innerHTML = '<div class="loading">Loading Australia’s foreign relations…</div>';
  try {
    data = await loadCore();
  } catch (err) {
    root.innerHTML = `<div class="error-state">
      <p><strong>Could not load the data.</strong></p>
      <p>${esc(err instanceof Error ? err.message : String(err))}</p>
      <p><button class="btn primary" onclick="location.reload()">Retry</button></p>
    </div>`;
    return;
  }
  root.innerHTML = '';
  buildShell(root, data);
  initGlossary();
  window.addEventListener('hashchange', route);
  route();
}

void init();
