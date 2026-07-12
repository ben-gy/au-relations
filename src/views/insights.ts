import type { AppData } from './../types';
import { computeInsights } from './../analysis';
import { esc, slugify } from './../utils';
import { el } from './../dom';

export function renderInsights(container: HTMLElement, data: AppData): void {
  const wrap = el('div');
  wrap.innerHTML = `
    <h2 class="view-title">Insights</h2>
    <p class="view-sub">Findings computed automatically from the data — superlatives, anomalies and gaps in Australia's web of formal relationships. Click a card to open the country it concerns.</p>`;

  const grid = el('div', { class: 'insight-grid' });
  for (const ins of computeInsights(data.countries, data.stats)) {
    const card = el(
      'div',
      { class: `insight-card ${ins.severity}`, ...(ins.country ? { style: 'cursor:pointer', role: 'button', tabindex: '0' } : {}) },
      `<h4>${esc(ins.title)}</h4><p>${esc(ins.body)}</p>`,
    );
    if (ins.country) {
      const open = () => {
        window.location.hash = `#insights&country=${slugify(ins.country!)}`;
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    }
    grid.appendChild(card);
  }
  wrap.appendChild(grid);
  container.appendChild(wrap);
}
