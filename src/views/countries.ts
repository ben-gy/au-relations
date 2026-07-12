import type { AppData, Country } from './../types';
import { esc, flagEmoji, formatNumber, pref, slugify, REGION_ORDER } from './../utils';
import { el, svgEl, hoverTip } from './../dom';
import { glossarySpan } from './../glossary';
import { realCountries } from './../analysis';

type SortKey = 'bilateral' | 'terminated' | 'latest' | 'name' | 'inForce';

function sparkline(c: Country): SVGSVGElement {
  const svg = svgEl('svg', { class: 'spark', width: 90, height: 20, viewBox: '0 0 90 20' });
  const decades: [number, number][] = [];
  for (let d = 1900; d <= 2020; d += 10) decades.push([d, c.byDecade[d] ?? 0]);
  const max = Math.max(1, ...decades.map((x) => x[1]));
  decades.forEach(([d, n], i) => {
    const h = Math.max(n > 0 ? 2 : 0.5, (n / max) * 18);
    const rect = svgEl('rect', { x: i * 7, y: 19 - h, width: 5.5, height: h, rx: 1 });
    if (n > 0) hoverTip(rect, () => `<span class="tt-title">${d}s</span><br>${n} treaties`);
    svg.appendChild(rect);
  });
  return svg;
}

export function renderCountries(container: HTMLElement, data: AppData): void {
  const wrap = el('div');
  wrap.innerHTML = `
    <h2 class="view-title">Countries</h2>
    <p class="view-sub">Every country ranked by the depth of its formal relationship with Australia — ${glossarySpan('bilateral')} treaties, diplomatic presence, and trade agreements. Click any country for the full picture. (${glossarySpan(
      'multilateral',
    )} conventions don't list their member countries in the source database, so counts here are bilateral.)</p>`;

  const s = data.stats.totals;
  wrap.appendChild(
    el(
      'div',
      { class: 'stat-strip' },
      `
    <div class="stat-card"><div class="v">${formatNumber(s.treaties)}</div><div class="l">treaties since 1901</div></div>
    <div class="stat-card"><div class="v">${formatNumber(s.bilateral)}</div><div class="l">bilateral treaties</div></div>
    <div class="stat-card"><div class="v">${formatNumber(s.countries)}</div><div class="l">countries &amp; economies</div></div>
    <div class="stat-card"><div class="v">${formatNumber(s.australianPosts)}</div><div class="l">posts in ${formatNumber(s.residentPosts)} countries</div></div>
    <div class="stat-card"><div class="v">${formatNumber(s.ftasInForce)}</div><div class="l">trade agreements in force</div></div>`,
    ),
  );

  const controls = el('div', { class: 'controls' });
  controls.innerHTML = `
    <label>Region
      <select class="select" id="lb-region"><option value="">All regions</option>${REGION_ORDER.filter((r) => r !== 'Other')
        .map((r) => `<option>${r}</option>`)
        .join('')}</select>
    </label>
    <label><input type="checkbox" id="lb-historical" /> include former states &amp; territories</label>`;
  wrap.appendChild(controls);

  const tableWrap = el('div', { class: 'table-wrap' });
  wrap.appendChild(tableWrap);
  container.appendChild(wrap);

  let sortKey = (pref('lb-sort') as SortKey) || 'bilateral';
  let sortDir = -1;

  const regionSel = controls.querySelector<HTMLSelectElement>('#lb-region')!;
  const histCb = controls.querySelector<HTMLInputElement>('#lb-historical')!;
  regionSel.addEventListener('change', draw);
  histCb.addEventListener('change', draw);

  function rows(): Country[] {
    let list = histCb.checked
      ? data.countries.filter((c) => !c.entity)
      : realCountries(data.countries);
    if (regionSel.value) list = list.filter((c) => c.region === regionSel.value);
    const get = (c: Country): number | string =>
      sortKey === 'terminated'
        ? c.terminatedBilateral
        : sortKey === 'name'
          ? c.name
          : sortKey === 'inForce'
            ? c.inForceBilateral
            : sortKey === 'latest'
              ? (c.last?.year ?? 0)
              : c[sortKey];
    return [...list].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (typeof va === 'string') return sortDir * va.localeCompare(vb as string);
      return sortDir * ((va as number) - (vb as number));
    });
  }

  function header(label: string, key: SortKey, right = true): string {
    const arrow = sortKey === key ? `<span class="arrow">${sortDir < 0 ? '▼' : '▲'}</span>` : '';
    return `<th class="sortable ${right ? 'r' : ''}" data-key="${key}" scope="col">${label} ${arrow}</th>`;
  }

  function draw(): void {
    const list = rows();
    tableWrap.innerHTML = `
    <table class="data-table" aria-label="Countries ranked by treaty relationship">
      <thead><tr>
        <th class="r">#</th>
        ${header('Country', 'name', false)}
        ${header('Bilateral treaties', 'bilateral')}
        ${header('In force', 'inForce')}
        ${header('Terminated', 'terminated')}
        ${header('Latest treaty', 'latest')}
        <th>Activity by decade</th>
        <th>Presence</th>
        <th>FTA</th>
      </tr></thead>
      <tbody></tbody>
    </table>`;
    const tbody = tableWrap.querySelector('tbody')!;
    list.forEach((c, i) => {
      const tr = el('tr');
      const primary = c.post?.australian
        ? c.post.type === 'high-commission'
          ? '🏛 High Commission'
          : c.post.type === 'consulate'
            ? '🏢 Consulate'
            : c.post.type === 'office'
              ? '🏢 Office'
              : '🏛 Embassy'
        : null;
      const presence = primary
        ? `${primary}${c.postCount > 1 ? ` <span style="color:var(--text-tertiary)">+${c.postCount - 1}</span>` : ''}`
        : c.coveredFrom
          ? `via ${esc(c.coveredFrom)}`
          : c.historical
            ? 'former state'
            : '—';
      tr.innerHTML = `
        <td class="r num">${i + 1}</td>
        <td><button class="country-link" data-c="${esc(c.name)}"><span class="flag">${flagEmoji(c.iso2)}</span>${esc(c.name)}</button></td>
        <td class="r num">${formatNumber(c.bilateral)}</td>
        <td class="r num">${formatNumber(c.inForceBilateral)}</td>
        <td class="r num">${formatNumber(c.terminatedBilateral)}</td>
        <td class="r num">${c.last?.year ?? '—'}</td>
        <td class="spark-cell"></td>
        <td>${presence}</td>
        <td>${c.ftas.length ? `<span class="pill fta">${c.ftas.filter((f) => f !== 'A-EUFTA' && f !== 'AI-CECA').join(', ') || '—'}</span>` : '—'}</td>`;
      tr.querySelector('.spark-cell')!.appendChild(sparkline(c));
      tr.querySelector<HTMLButtonElement>('.country-link')!.addEventListener('click', () => {
        window.location.hash = `#countries&country=${slugify(c.name)}`;
      });
      tbody.appendChild(tr);
    });
    tableWrap.querySelectorAll<HTMLTableCellElement>('th.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.key as SortKey;
        if (key === sortKey) sortDir *= -1;
        else {
          sortKey = key;
          sortDir = key === 'name' ? 1 : -1;
        }
        pref('lb-sort', sortKey);
        draw();
      });
    });
  }
  draw();
}
