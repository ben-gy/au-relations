// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { AppData } from './types';
import { formatDate, formatNumber } from './utils';
import { el } from './dom';

export function openAbout(data: AppData): void {
  const m = data.stats.meta;
  const backdrop = el('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'About this site' });
  const modal = el(
    'div',
    { class: 'modal' },
    `
    <button class="modal-close" aria-label="Close">×</button>
    <h2>About Foreign Relations</h2>
    <p>This site maps how Australia formally relates to every other government on Earth: every treaty Australia has ever signed, the entire overseas diplomatic network, free trade agreements, and memberships of international organisations — joined into one explorer, per country.</p>

    <h3>Where the data comes from</h3>
    <ul>
      <li><strong>Treaties</strong> — the official DFAT <a href="${m.sources.atd}" target="_blank" rel="noopener">Australian Treaties Database</a>: ${formatNumber(m.atdCollected)} of ${formatNumber(m.atdExpected)} records, including title, parties, subject, signature and entry-into-force dates, status and treaty actions.</li>
      <li><strong>Diplomatic network</strong> — DFAT's <a href="${m.sources.missions}" target="_blank" rel="noopener">list of embassies and consulates overseas</a> (${formatNumber(m.missionEntries)} country entries), including which resident embassy covers countries without one.</li>
      <li><strong>Trade agreements</strong> — curated from DFAT's <a href="${m.sources.ftas}" target="_blank" rel="noopener">trade agreements pages</a>.</li>
      <li><strong>Organisation memberships</strong> — curated from official membership lists (G20, OECD, APEC, Commonwealth, Pacific Islands Forum, Quad, AUKUS and more).</li>
    </ul>

    <h3>How often it updates</h3>
    <p>An automated pipeline re-collects the treaty database and missions list <strong>quarterly</strong> (the sources publish irregularly, roughly monthly at their fastest). This copy was generated on ${formatDate(m.generatedAt.slice(0, 10))}.</p>

    <h3>Reading the numbers</h3>
    <ul>
      <li><strong>Bilateral</strong> treaties are between Australia and exactly one other party; <strong>multilateral</strong> treaties (conventions) can have dozens of parties — a country "shares" a multilateral treaty with Australia if both are listed parties in the database.</li>
      <li>Treaty <strong>status</strong> is derived from database fields: a treaty is shown as terminated if a termination/withdrawal action is recorded; "in force" means an entry-into-force date exists and no termination is recorded.</li>
      <li>Some old treaties are attributed to former states (USSR, Czechoslovakia, Yugoslavia…). These appear as separate historical entries rather than being re-assigned to successor states.</li>
    </ul>

    <h3>Caveats</h3>
    <ul>
      <li>This is an independent, unofficial visualisation — always verify against the official DFAT database before relying on treaty status.</li>
      <li>Subject categories are assigned automatically from the treaty's subject/title text and are indicative, not official.</li>
      <li>A handful of database records lack dates or party details; they are included where possible.</li>
    </ul>
  `,
  );
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  modal.querySelector('.modal-close')!.addEventListener('click', close);
}
