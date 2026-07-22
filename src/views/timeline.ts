// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { AppData } from './../types';
import { formatNumber } from './../utils';
import { el, svgEl, hoverTip } from './../dom';
import { glossarySpan } from './../glossary';

const ERAS: { year: number; label: string }[] = [
  { year: 1901, label: 'Federation' },
  { year: 1914, label: 'WWI' },
  { year: 1939, label: 'WWII' },
  { year: 1945, label: 'UN founded' },
  { year: 1973, label: 'UK joins EEC' },
  { year: 1989, label: 'Cold War ends' },
  { year: 2005, label: 'FTA era' },
];

export function renderTimeline(container: HTMLElement, data: AppData): void {
  const wrap = el('div');
  wrap.innerHTML = `
    <h2 class="view-title">125 years of treaty-making</h2>
    <p class="view-sub">Treaties concluded per year since Federation, split ${glossarySpan('bilateral')} vs ${glossarySpan(
      'multilateral',
    )}. The post-war multilateral boom, the 1970s–80s bilateral expansion, and the modern slowdown are all visible. Hover any year for detail.</p>`;

  const years = Object.keys(data.stats.timeline)
    .map(Number)
    .filter((y) => y >= 1900)
    .sort((a, b) => a - b);
  const first = years[0] ?? 1901;
  const last = years[years.length - 1] ?? 2026;

  const W = 1200;
  const H = 420;
  const padL = 46;
  const padB = 46;
  const padT = 30;
  const plotW = W - padL - 12;
  const plotH = H - padT - padB;

  let max = 0;
  for (const y of years) {
    const v = data.stats.timeline[y];
    max = Math.max(max, v.B + v.M);
  }

  const panel = el('div', { class: 'chart-panel' });
  panel.innerHTML = `<div class="chart-title">Treaties per year, ${first}–${last}</div>
    <div class="chart-sub">Stacked: bilateral (navy) below, multilateral (gold) above. Total ${formatNumber(data.stats.totals.treaties)} treaties.</div>`;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Treaties per year stacked bar chart' });

  // y grid
  const step = max > 80 ? 25 : 10;
  for (let v = 0; v <= max; v += step) {
    const y = padT + plotH - (v / max) * plotH;
    svg.appendChild(svgEl('line', { x1: padL, x2: W - 8, y1: y, y2: y, stroke: 'var(--border-subtle)', 'stroke-width': 1 }));
    const t = svgEl('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--text-tertiary)' });
    t.textContent = String(v);
    svg.appendChild(t);
  }

  const span = last - first + 1;
  const bw = Math.max(2, plotW / span - 1.2);
  for (const year of years) {
    const v = data.stats.timeline[year];
    const x = padL + ((year - first) / span) * plotW;
    const hB = (v.B / max) * plotH;
    const hM = (v.M / max) * plotH;
    const g = svgEl('g');
    const rB = svgEl('rect', { x, y: padT + plotH - hB, width: bw, height: Math.max(hB, v.B ? 1 : 0), fill: 'var(--navy)' });
    const rM = svgEl('rect', { x, y: padT + plotH - hB - hM, width: bw, height: Math.max(hM, v.M ? 1 : 0), fill: 'var(--accent-gold)' });
    g.appendChild(rB);
    g.appendChild(rM);
    hoverTip(g, () => `<span class="tt-title">${year}</span><br>${v.B} bilateral · ${v.M} multilateral<br>${v.B + v.M} total`);
    svg.appendChild(g);
  }

  // x axis decade labels
  for (let d = Math.ceil(first / 10) * 10; d <= last; d += 10) {
    const x = padL + ((d - first) / span) * plotW;
    const t = svgEl('text', { x, y: H - padB + 16, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-tertiary)' });
    t.textContent = String(d);
    svg.appendChild(t);
  }

  // era annotations
  for (const era of ERAS) {
    if (era.year < first || era.year > last) continue;
    const x = padL + ((era.year - first) / span) * plotW;
    svg.appendChild(
      svgEl('line', { x1: x, x2: x, y1: padT - 4, y2: padT + plotH, stroke: 'var(--status-bad)', 'stroke-width': 1, 'stroke-dasharray': '3,3', opacity: 0.5 }),
    );
    const t = svgEl('text', { x: x + 3, y: padT + 6, 'font-size': 9.5, fill: 'var(--status-bad)', opacity: 0.85 });
    t.textContent = era.label;
    svg.appendChild(t);
  }

  panel.appendChild(svg);
  panel.appendChild(
    el(
      'div',
      { class: 'legend' },
      `<span class="key"><span class="sw" style="background:var(--navy)"></span>Bilateral</span>
       <span class="key"><span class="sw" style="background:var(--accent-gold)"></span>Multilateral</span>
       <span class="key"><span class="sw" style="background:var(--status-bad);height:2px"></span>Historical marker</span>`,
    ),
  );
  wrap.appendChild(panel);

  // cumulative panel
  const panel2 = el('div', { class: 'chart-panel', style: 'margin-top:var(--space-lg)' });
  panel2.innerHTML = `<div class="chart-title">Cumulative treaty stock</div>
    <div class="chart-sub">Running total of treaties concluded — the slope shows how fast each era added to Australia's treaty book.</div>`;
  const svg2 = svgEl('svg', { viewBox: `0 0 ${W} 260`, role: 'img', 'aria-label': 'Cumulative treaties line chart' });
  let cum = 0;
  const pts: [number, number][] = [];
  for (const y of years) {
    cum += data.stats.timeline[y].B + data.stats.timeline[y].M;
    pts.push([y, cum]);
  }
  const maxC = cum;
  const px = (y: number) => padL + ((y - first) / span) * plotW;
  const py = (v: number) => 18 + (1 - v / maxC) * 200;
  const path = pts.map(([y, v], i) => `${i ? 'L' : 'M'}${px(y).toFixed(1)},${py(v).toFixed(1)}`).join('');
  svg2.appendChild(svgEl('path', { d: `${path}`, fill: 'none', stroke: 'var(--accent-primary)', 'stroke-width': 2.5 }));
  for (let v = 0; v <= maxC; v += 1000) {
    svg2.appendChild(svgEl('line', { x1: padL, x2: W - 8, y1: py(v), y2: py(v), stroke: 'var(--border-subtle)' }));
    const t = svgEl('text', { x: padL - 6, y: py(v) + 3, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--text-tertiary)' });
    t.textContent = formatNumber(v);
    svg2.appendChild(t);
  }
  for (let d = Math.ceil(first / 10) * 10; d <= last; d += 20) {
    const t = svgEl('text', { x: px(d), y: 250, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-tertiary)' });
    t.textContent = String(d);
    svg2.appendChild(t);
  }
  panel2.appendChild(svg2);
  wrap.appendChild(panel2);

  container.appendChild(wrap);
}
