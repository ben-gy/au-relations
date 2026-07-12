import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AppData, Country } from './../types';
import { loadWorldGeo } from './../data';
import { esc, flagEmoji, formatNumber, pref, slugify } from './../utils';
import { el } from './../dom';

type Mode = 'treaties' | 'posts' | 'fta';

const TREATY_BUCKETS: [number, string][] = [
  [100, '#14293f'],
  [50, '#1e3a5f'],
  [25, '#2d5580'],
  [10, '#4877a3'],
  [5, '#7ba0c4'],
  [1, '#b7cbde'],
  [0, '#e8eef4'],
];

function treatyColor(n: number): string {
  for (const [min, c] of TREATY_BUCKETS) if (n >= min && (min > 0 || n === 0)) return c;
  return '#e8eef4';
}

const POST_COLORS: Record<string, string> = {
  resident: '#1e5c8f',
  covered: '#9db8d1',
  canadian: '#c9962e',
  none: '#e8eef4',
};

const FTA_COLORS: Record<string, string> = {
  'in-force': '#217a3c',
  'under-negotiation': '#c9962e',
  none: '#e8eef4',
};

function postClass(c: Country | undefined): string {
  if (!c) return 'none';
  if (c.post?.australian) return 'resident';
  if (c.sharedConsular) return 'canadian';
  if (c.coveredFrom) return 'covered';
  return 'none';
}

function ftaClass(c: Country | undefined, data: AppData): string {
  if (!c || !c.ftas.length) return 'none';
  const statuses = data.stats.ftas.filter((f) => c.ftas.includes(f.code)).map((f) => f.status);
  return statuses.includes('in-force') ? 'in-force' : 'under-negotiation';
}

export function renderMap(container: HTMLElement, data: AppData): () => void {
  const wrap = el('div');
  wrap.innerHTML = `
    <h2 class="view-title">World map</h2>
    <p class="view-sub">The geography of Australia's formal relationships. Switch between treaty intensity, the diplomatic footprint, and trade-agreement coverage. Click a country for detail.</p>`;
  const controls = el('div', { class: 'controls', role: 'radiogroup', 'aria-label': 'Map mode' });
  const modes: [Mode, string][] = [
    ['treaties', 'Bilateral treaties'],
    ['posts', 'Diplomatic posts'],
    ['fta', 'Trade agreements'],
  ];
  for (const [m, label] of modes) {
    const b = el('button', { class: 'btn', 'data-mode': m, type: 'button' }, label);
    controls.appendChild(b);
  }
  wrap.appendChild(controls);
  wrap.appendChild(el('div', { id: 'map-container', role: 'application', 'aria-label': 'World map' }));
  container.appendChild(wrap);

  let mode: Mode = (pref('map-mode') as Mode) || 'treaties';

  const byIso3 = new Map<string, Country>();
  for (const c of data.countries) if (c.iso3) byIso3.set(c.iso3, c);

  const map = L.map('map-container', {
    center: [15, 10],
    zoom: 2,
    minZoom: 1,
    maxZoom: 7,
    worldCopyJump: true,
    attributionControl: false,
  });
  L.control.attribution({ prefix: false }).addAttribution('Boundaries: Natural Earth').addTo(map);

  let geoLayer: L.GeoJSON | null = null;
  const legend = new L.Control({ position: 'bottomleft' });
  let legendDiv: HTMLElement | null = null;
  legend.onAdd = () => {
    legendDiv = L.DomUtil.create('div', 'map-legend');
    drawLegend();
    return legendDiv;
  };
  legend.addTo(map);

  function drawLegend(): void {
    if (!legendDiv) return;
    if (mode === 'treaties') {
      legendDiv.innerHTML =
        '<strong>Bilateral treaties</strong><br>' +
        TREATY_BUCKETS.map(([min, c], i) => {
          const next = i === 0 ? '+' : `–${TREATY_BUCKETS[i - 1][0] - 1}`;
          return `<span class="sw" style="background:${c}"></span>${min}${min === 0 ? '' : next}`;
        })
          .reverse()
          .join('<br>');
    } else if (mode === 'posts') {
      legendDiv.innerHTML = `<strong>Diplomatic presence</strong><br>
        <span class="sw" style="background:${POST_COLORS.resident}"></span>Resident Australian post<br>
        <span class="sw" style="background:${POST_COLORS.covered}"></span>Covered from another country<br>
        <span class="sw" style="background:${POST_COLORS.canadian}"></span>Canadian consular sharing<br>
        <span class="sw" style="background:${POST_COLORS.none}"></span>No listed coverage`;
    } else {
      legendDiv.innerHTML = `<strong>Trade agreements</strong><br>
        <span class="sw" style="background:${FTA_COLORS['in-force']}"></span>FTA in force<br>
        <span class="sw" style="background:${FTA_COLORS['under-negotiation']}"></span>Under negotiation only<br>
        <span class="sw" style="background:${FTA_COLORS.none}"></span>No FTA`;
    }
  }

  function styleFor(iso3: string): L.PathOptions {
    const c = byIso3.get(iso3);
    let fill = '#e8eef4';
    if (iso3 === 'AUS') fill = '#c9962e';
    else if (mode === 'treaties') fill = treatyColor(c?.bilateral ?? 0);
    else if (mode === 'posts') fill = POST_COLORS[postClass(c)];
    else fill = FTA_COLORS[ftaClass(c, data)];
    return { fillColor: fill, fillOpacity: 0.92, color: '#ffffff', weight: 0.7 };
  }

  function tooltipHtml(iso3: string, fallback: string): string {
    if (iso3 === 'AUS') return '<strong>Australia</strong>';
    const c = byIso3.get(iso3);
    if (!c) return `<strong>${esc(fallback)}</strong><br>No recorded relationship data`;
    const post = c.post?.australian
      ? `Resident ${c.post.kind}${c.post.city ? ` (${c.post.city})` : ''}`
      : c.coveredFrom
        ? `Covered from ${c.coveredFrom}`
        : 'No resident post';
    return `<strong>${flagEmoji(c.iso2)} ${esc(c.name)}</strong><br>
      ${formatNumber(c.bilateral)} bilateral treaties<br>
      ${esc(post)}${c.ftas.length ? `<br>FTA: ${c.ftas.join(', ')}` : ''}`;
  }

  const updateStyles = () => {
    geoLayer?.eachLayer((layer) => {
      const f = (layer as L.Path & { feature?: GeoJSON.Feature }).feature;
      const iso3 = (f?.id as string) ?? '';
      (layer as L.Path).setStyle(styleFor(iso3));
    });
    drawLegend();
  };

  const setMode = (m: Mode) => {
    mode = m;
    pref('map-mode', m);
    controls.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.classList.toggle('primary', b.dataset.mode === m);
    });
    updateStyles();
  };
  controls.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.addEventListener('click', () => setMode(b.dataset.mode as Mode));
  });

  void loadWorldGeo()
    .then((geo) => {
      geoLayer = L.geoJSON(geo, {
        style: (f) => styleFor((f?.id as string) ?? ''),
        onEachFeature: (feature, layer) => {
          const iso3 = (feature.id as string) ?? '';
          const name = (feature.properties as { name?: string })?.name ?? iso3;
          layer.bindTooltip(() => tooltipHtml(iso3, name), { sticky: true });
          layer.on('click', () => {
            const c = byIso3.get(iso3);
            if (c) window.location.hash = `#map&country=${slugify(c.name)}`;
          });
          layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 2, color: '#c9962e' }));
          layer.on('mouseout', () => (layer as L.Path).setStyle({ weight: 0.7, color: '#ffffff' }));
        },
      }).addTo(map);
      setMode(mode);
    })
    .catch(() => {
      const mc = document.getElementById('map-container');
      if (mc) mc.innerHTML = '<div class="error-state">Could not load the map boundaries. <button class="btn" onclick="location.reload()">Retry</button></div>';
    });

  setMode(mode);
  return () => map.remove();
}
