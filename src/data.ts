import type { AppData, Country, Stats, Treaty } from './types';

const cache = new Map<string, unknown>();

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const res = await fetch(path, { signal });
  if (!res.ok) throw new Error(`Failed to load ${path} (HTTP ${res.status})`);
  const data = (await res.json()) as T;
  cache.set(path, data);
  return data;
}

export async function loadCore(signal?: AbortSignal): Promise<AppData> {
  const [stats, countriesFile] = await Promise.all([
    fetchJson<Stats>('/data/stats.json', signal),
    fetchJson<{ countries: Country[] }>('/data/countries.json', signal),
  ]);
  const byName = new Map(countriesFile.countries.map((c) => [c.name, c]));
  return { stats, countries: countriesFile.countries, byName };
}

let treatiesPromise: Promise<Treaty[]> | null = null;

/** Lazily load the full treaty corpus (used by the Treaties view and drill-down). */
export function loadTreaties(): Promise<Treaty[]> {
  treatiesPromise ??= fetchJson<{ treaties: Treaty[] }>('/data/treaties.json').then((f) => f.treaties);
  return treatiesPromise;
}

export function loadWorldGeo(): Promise<GeoJSON.FeatureCollection> {
  return fetchJson<GeoJSON.FeatureCollection>('/data/world.geo.json');
}
