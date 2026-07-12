import type { AppData, Treaty } from './../types';
import { loadTreaties } from './../data';
import { categoryColor, debounce, esc, formatDate, formatNumber, slugify, STATUS_LABELS, CATEGORY_COLORS } from './../utils';
import { el } from './../dom';
import { glossarySpan } from './../glossary';

const PAGE = 100;

export function renderTreaties(container: HTMLElement, data: AppData): void {
  const wrap = el('div');
  wrap.innerHTML = `
    <h2 class="view-title">Treaty database</h2>
    <p class="view-sub">Every ${glossarySpan('treaty')} action recorded in the DFAT Australian Treaties Database — searchable and filterable. ${glossarySpan(
      'ATS number',
      'ATS',
    )} links open the full treaty text on AustLII.</p>
    <div class="controls">
      <input class="input" id="tq" type="search" placeholder="Search titles, subjects, places…" aria-label="Search treaties" style="min-width:260px" />
      <select class="select" id="ttype" aria-label="Treaty type">
        <option value="">All types</option><option value="B">Bilateral</option><option value="M">Multilateral</option>
      </select>
      <select class="select" id="tstatus" aria-label="Status">
        <option value="">All statuses</option>
        ${Object.entries(STATUS_LABELS)
          .map(([k, v]) => `<option value="${k}">${v}</option>`)
          .join('')}
      </select>
      <select class="select" id="tcat" aria-label="Category">
        <option value="">All categories</option>
        ${Object.keys(CATEGORY_COLORS)
          .map((c) => `<option>${c}</option>`)
          .join('')}
      </select>
      <select class="select" id="tdecade" aria-label="Decade">
        <option value="">All decades</option>
        ${Array.from({ length: 13 }, (_, i) => 1900 + i * 10)
          .map((d) => `<option value="${d}">${d}s</option>`)
          .join('')}
      </select>
      <span id="tcount" class="num" style="color:var(--text-secondary)"></span>
    </div>
    <div id="tbody-wrap" class="loading">Loading ${formatNumber(data.stats.totals.treaties)} treaties…</div>`;
  container.appendChild(wrap);

  const q = wrap.querySelector<HTMLInputElement>('#tq')!;
  const typeSel = wrap.querySelector<HTMLSelectElement>('#ttype')!;
  const statusSel = wrap.querySelector<HTMLSelectElement>('#tstatus')!;
  const catSel = wrap.querySelector<HTMLSelectElement>('#tcat')!;
  const decadeSel = wrap.querySelector<HTMLSelectElement>('#tdecade')!;
  const bodyWrap = wrap.querySelector<HTMLElement>('#tbody-wrap')!;
  const count = wrap.querySelector<HTMLElement>('#tcount')!;

  let all: Treaty[] = [];
  let shown = PAGE;

  function filtered(): Treaty[] {
    const term = q.value.trim().toLowerCase();
    return all.filter((t) => {
      if (typeSel.value && t.type !== typeSel.value) return false;
      if (statusSel.value && t.status !== statusSel.value) return false;
      if (catSel.value && t.category !== catSel.value) return false;
      if (decadeSel.value && (t.year === null || Math.floor(t.year / 10) * 10 !== Number(decadeSel.value))) return false;
      if (term) {
        const hay = `${t.title} ${t.subject ?? ''} ${t.place ?? ''} ${t.countries.join(' ')} ${t.ats ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }

  function draw(): void {
    const list = filtered();
    count.textContent = `${formatNumber(list.length)} match${list.length === 1 ? '' : 'es'}`;
    const page = list.slice(0, shown);
    if (!page.length) {
      bodyWrap.innerHTML = '<div class="empty-state">No treaties match those filters — try clearing the search or widening the decade.</div>';
      return;
    }
    bodyWrap.classList.remove('loading');
    bodyWrap.innerHTML = `
      <div class="table-wrap">
      <table class="data-table" aria-label="Treaties">
        <thead><tr>
          <th scope="col" style="min-width:340px">Treaty</th>
          <th scope="col">Type</th>
          <th scope="col">Category</th>
          <th scope="col">Parties</th>
          <th scope="col">Signed</th>
          <th scope="col">Status</th>
          <th scope="col">Citation</th>
        </tr></thead>
        <tbody>
          ${page
            .map(
              (t) => `<tr>
            <td>${t.link ? `<a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.title)}</a>` : esc(t.title)}</td>
            <td><span class="pill ${t.type.toLowerCase()}">${t.type === 'B' ? 'Bilateral' : 'Multilateral'}</span></td>
            <td><span class="pill cat" style="background:${categoryColor(t.category)}">${esc(t.category)}</span></td>
            <td>${partyCell(t)}</td>
            <td class="num">${formatDate(t.date)}</td>
            <td><span class="pill ${t.status}">${STATUS_LABELS[t.status] ?? t.status}</span></td>
            <td class="num">${esc(t.ats ?? t.atnif ?? '—')}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>
      </div>
      ${list.length > shown ? `<p style="text-align:center;margin-top:var(--space-md)"><button class="btn" id="tmore">Show ${formatNumber(Math.min(PAGE, list.length - shown))} more (${formatNumber(list.length - shown)} remaining)</button></p>` : ''}`;

    bodyWrap.querySelector('#tmore')?.addEventListener('click', () => {
      shown += PAGE;
      draw();
    });
    bodyWrap.querySelectorAll<HTMLButtonElement>('.country-link').forEach((b) => {
      b.addEventListener('click', () => {
        window.location.hash = `#treaties&country=${slugify(b.dataset.c!)}`;
      });
    });
  }

  function partyCell(t: Treaty): string {
    if (t.type === 'M' && t.countries.length > 3) {
      return `${t.countries
        .slice(0, 2)
        .map(link)
        .join(', ')} <span style="color:var(--text-tertiary)">+${t.countries.length - 2} more</span>`;
    }
    return t.countries.map(link).join(', ') || '<span style="color:var(--text-tertiary)">Multilateral</span>';
  }
  const link = (n: string) => `<button class="country-link" data-c="${esc(n)}">${esc(n)}</button>`;

  const redraw = () => {
    shown = PAGE;
    draw();
  };
  q.addEventListener('input', debounce(redraw, 300));
  for (const s of [typeSel, statusSel, catSel, decadeSel]) s.addEventListener('change', redraw);

  void loadTreaties()
    .then((t) => {
      all = [...t].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      draw();
    })
    .catch(() => {
      bodyWrap.classList.remove('loading');
      bodyWrap.innerHTML = '<div class="error-state">Could not load the treaty database. <button class="btn" onclick="location.reload()">Retry</button></div>';
    });
}
