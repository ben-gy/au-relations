import type { AppData } from './../types';
import { esc, flagEmoji, slugify, CATEGORY_COLORS } from './../utils';
import { el, svgEl, hoverTip } from './../dom';
import { realCountries } from './../analysis';

const TOP_N = 28;

export function renderMatrix(container: HTMLElement, data: AppData): void {
  const wrap = el('div');
  wrap.innerHTML = `
    <h2 class="view-title">Subject × country matrix</h2>
    <p class="view-sub">What each relationship is actually made of. Each cell shows how many treaties Australia has with that country on that subject — the darker, the more. Compare Indonesia's security-heavy column with Switzerland's tax-heavy one. Click a country name for detail.</p>`;

  const cats = Object.keys(CATEGORY_COLORS).filter((c) => c !== 'Other');
  const top = realCountries(data.countries)
    .filter((c) => c.bilateral > 0)
    .sort((a, b) => b.bilateral - a.bilateral)
    .slice(0, TOP_N);

  const cellW = 34;
  const cellH = 24;
  const left = 190;
  const topPad = 130;
  const W = left + cats.length * cellW + 20;
  const H = topPad + top.length * cellH + 10;

  let maxCell = 1;
  for (const c of top) for (const cat of cats) maxCell = Math.max(maxCell, c.byCategory[cat] ?? 0);

  const panel = el('div', { class: 'chart-panel', style: 'overflow-x:auto' });
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, style: `min-width:${W * 0.75}px`, role: 'img', 'aria-label': 'Country by subject heatmap' });

  // column headers (rotated)
  cats.forEach((cat, j) => {
    const x = left + j * cellW + cellW / 2;
    const t = svgEl('text', {
      x,
      y: topPad - 8,
      'font-size': 10.5,
      fill: 'var(--text-secondary)',
      transform: `rotate(-45 ${x} ${topPad - 8})`,
    });
    t.textContent = cat;
    svg.appendChild(t);
  });

  top.forEach((c, i) => {
    const y = topPad + i * cellH;
    const label = svgEl('text', { x: left - 8, y: y + cellH / 2 + 4, 'text-anchor': 'end', 'font-size': 11.5, fill: 'var(--accent-primary)', style: 'cursor:pointer' });
    label.textContent = `${c.name}`;
    label.addEventListener('click', () => {
      window.location.hash = `#matrix&country=${slugify(c.name)}`;
    });
    svg.appendChild(label);

    cats.forEach((cat, j) => {
      const n = c.byCategory[cat] ?? 0;
      const intensity = n === 0 ? 0 : 0.15 + 0.85 * Math.sqrt(n / maxCell);
      const rect = svgEl('rect', {
        x: left + j * cellW + 1,
        y: y + 1,
        width: cellW - 2,
        height: cellH - 2,
        rx: 3,
        fill: n === 0 ? 'var(--bg-elevated)' : 'var(--navy)',
        opacity: n === 0 ? 1 : intensity,
      });
      hoverTip(rect, () => `<span class="tt-title">${flagEmoji(c.iso2)} ${esc(c.name)} × ${esc(cat)}</span><br>${n} treaties`);
      svg.appendChild(rect);
      if (n > 0 && n >= maxCell * 0.35) {
        const t = svgEl('text', { x: left + j * cellW + cellW / 2, y: y + cellH / 2 + 4, 'text-anchor': 'middle', 'font-size': 10, fill: '#fff', 'pointer-events': 'none' });
        t.textContent = String(n);
        svg.appendChild(t);
      }
    });
  });

  panel.appendChild(svg);
  panel.appendChild(
    el(
      'div',
      { class: 'legend' },
      `<span class="key">Top ${TOP_N} bilateral treaty partners × ${cats.length} subject categories. Darker = more treaties; numbers shown on the strongest cells.</span>`,
    ),
  );
  wrap.appendChild(panel);
  container.appendChild(wrap);
}
