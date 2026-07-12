import type { AppData, Country } from './../types';
import { esc, flagEmoji, pref, slugify, REGION_ORDER } from './../utils';
import { el, svgEl, showTooltip, hideTooltip } from './../dom';
import { glossarySpan } from './../glossary';

interface Node {
  id: string;
  c: Country | null; // null = Australia
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'au' | 'hub' | 'post' | 'covered';
}
interface Link {
  a: number;
  b: number;
  len: number;
}

const KIND_COLORS: Record<Node['kind'], string> = {
  au: '#c9962e',
  hub: '#1e3a5f',
  post: '#4877a3',
  covered: '#b7cbde',
};

export function renderNetwork(container: HTMLElement, data: AppData): () => void {
  const wrap = el('div');
  wrap.innerHTML = `
    <h2 class="view-title">The embassy network</h2>
    <p class="view-sub">How ${data.stats.totals.residentPosts} resident Australian posts cover nearly every country on Earth. Gold = Australia; navy = posts that also cover other countries via ${glossarySpan(
      'accreditation',
    )}; blue = other resident posts; pale = countries covered from elsewhere. Drag to explore, click a node for detail.</p>
    <div class="controls">
      <label>Region
        <select class="select" id="net-region"><option value="">Whole world</option>${REGION_ORDER.filter((r) => r !== 'Other')
          .map((r) => `<option${pref('net-region') === r ? ' selected' : ''}>${r}</option>`)
          .join('')}</select>
      </label>
      <span style="color:var(--text-tertiary);font-size:var(--font-size-sm)">Tip: pick a region to see its hub-and-spoke structure clearly.</span>
    </div>
    <div class="network-wrap chart-panel"><svg id="net-svg" viewBox="0 0 1200 760" role="img" aria-label="Diplomatic accreditation network graph"></svg></div>`;
  container.appendChild(wrap);

  const svg = wrap.querySelector<SVGSVGElement>('#net-svg')!;
  const regionSel = wrap.querySelector<HTMLSelectElement>('#net-region')!;
  let raf = 0;

  function build(): void {
    cancelAnimationFrame(raf);
    svg.innerHTML = '';
    const region = regionSel.value;
    const W = 1200;
    const H = 760;

    const relevant = data.countries.filter(
      (c) => !c.entity && !c.historical && (c.post?.australian || c.coveredFrom) && (!region || c.region === region),
    );
    // ensure hubs referenced by covered countries are present even if out of region
    const names = new Set(relevant.map((c) => c.name));
    for (const c of [...relevant]) {
      if (c.coveredFrom && !names.has(c.coveredFrom)) {
        const hub = data.byName.get(c.coveredFrom);
        if (hub) {
          relevant.push(hub);
          names.add(hub.name);
        }
      }
    }

    const nodes: Node[] = [];
    const idx = new Map<string, number>();
    const add = (c: Country | null, kind: Node['kind'], r: number) => {
      const id = c?.name ?? 'Australia';
      if (idx.has(id)) return idx.get(id)!;
      const i = nodes.length;
      // deterministic spiral seeding (no Math.random → stable layout)
      const angle = i * 2.399963;
      const rad = 30 + 9 * Math.sqrt(i + 1);
      nodes.push({ id, c, x: W / 2 + rad * Math.cos(angle), y: H / 2 + rad * Math.sin(angle), vx: 0, vy: 0, r, kind });
      idx.set(id, i);
      return i;
    };

    const au = add(null, 'au', 22);
    const links: Link[] = [];
    for (const c of relevant) {
      if (c.post?.australian) {
        const kind = c.covers.length > 0 ? 'hub' : 'post';
        const i = add(c, kind, kind === 'hub' ? 8 + Math.min(10, c.covers.length * 1.2) : 6.5);
        links.push({ a: au, b: i, len: 170 });
      }
    }
    for (const c of relevant) {
      if (!c.coveredFrom) continue;
      const hubIdx = idx.get(c.coveredFrom);
      if (hubIdx === undefined) continue;
      const i = add(c, 'covered', 4.5);
      links.push({ a: hubIdx, b: i, len: 55 });
    }

    // --- render elements ---
    const linkEls = links.map((l) => {
      const line = svgEl('line', { class: 'net-link', 'stroke-width': nodes[l.a].kind === 'au' || nodes[l.b].kind === 'au' ? 0.6 : 1.1 });
      svg.appendChild(line);
      return line;
    });
    const nodeEls = nodes.map((n) => {
      const g = svgEl('g', { class: 'net-node' });
      const circle = svgEl('circle', { r: n.r, fill: KIND_COLORS[n.kind] });
      g.appendChild(circle);
      if (n.kind === 'au' || n.kind === 'hub' || (n.kind === 'post' && region)) {
        const label = svgEl('text', { y: -n.r - 3, 'text-anchor': 'middle' });
        label.textContent = n.id;
        g.appendChild(label);
      }
      g.addEventListener('mousemove', (e) => {
        const me = e as MouseEvent;
        if (!n.c) return showTooltip(me.clientX, me.clientY, '<span class="tt-title">Australia</span>');
        const covers = n.c.covers.length ? `<br>Covers ${n.c.covers.length}: ${esc(n.c.covers.slice(0, 6).join(', '))}${n.c.covers.length > 6 ? '…' : ''}` : '';
        const from = n.c.coveredFrom ? `<br>Covered from ${esc(n.c.coveredFrom)}` : '';
        showTooltip(
          me.clientX,
          me.clientY,
          `<span class="tt-title">${flagEmoji(n.c.iso2)} ${esc(n.c.name)}</span><br>${n.c.post?.australian ? esc(n.c.post.kind) : 'No resident post'}${covers}${from}`,
        );
      });
      g.addEventListener('mouseleave', hideTooltip);
      g.addEventListener('click', () => {
        if (n.c) window.location.hash = `#network&country=${slugify(n.c.name)}`;
      });
      svg.appendChild(g);
      return g;
    });

    // --- force simulation ---
    let tick = 0;
    const MAX_TICKS = 320;
    const step = () => {
      const alpha = Math.max(0.02, 1 - tick / MAX_TICKS);
      // repulsion (O(n²) is fine for ~260 nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = (i % 2 ? 1 : -1) * 0.5;
            dy = 0.5;
            d2 = 0.5;
          }
          const f = (900 * alpha) / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // springs
      for (const l of links) {
        const a = nodes[l.a];
        const b = nodes[l.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const f = ((d - l.len) / d) * 0.06 * alpha * 8;
        a.vx += dx * f;
        a.vy += dy * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
      }
      // gravity to centre + integrate
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.004 * alpha;
        n.vy += (H / 2 - n.y) * 0.004 * alpha;
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x = Math.min(W - 20, Math.max(20, n.x + n.vx));
        n.y = Math.min(H - 16, Math.max(24, n.y + n.vy));
      }
      // pin Australia to centre
      nodes[au].x = W / 2;
      nodes[au].y = H / 2;

      links.forEach((l, i) => {
        linkEls[i].setAttribute('x1', String(nodes[l.a].x));
        linkEls[i].setAttribute('y1', String(nodes[l.a].y));
        linkEls[i].setAttribute('x2', String(nodes[l.b].x));
        linkEls[i].setAttribute('y2', String(nodes[l.b].y));
      });
      nodes.forEach((n, i) => {
        nodeEls[i].setAttribute('transform', `translate(${n.x},${n.y})`);
      });
      tick++;
      if (tick < MAX_TICKS) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  regionSel.addEventListener('change', () => {
    pref('net-region', regionSel.value);
    build();
  });
  build();

  const legend = el(
    'div',
    { class: 'legend' },
    `<span class="key"><span class="sw" style="background:${KIND_COLORS.au}"></span>Australia</span>
     <span class="key"><span class="sw" style="background:${KIND_COLORS.hub}"></span>Hub post (covers others)</span>
     <span class="key"><span class="sw" style="background:${KIND_COLORS.post}"></span>Resident post</span>
     <span class="key"><span class="sw" style="background:${KIND_COLORS.covered}"></span>Covered by accreditation</span>`,
  );
  wrap.appendChild(legend);

  return () => cancelAnimationFrame(raf);
}
