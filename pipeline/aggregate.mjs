#!/usr/bin/env node
/**
 * Aggregates raw pipeline data into the JSON files the site loads:
 *   public/data/treaties.json  — trimmed full treaty corpus
 *   public/data/countries.json — per-country relationship aggregates
 *   public/data/stats.json     — global stats, timeline, matrix, meta
 * Joins the ATD treaty dump with the DFAT missions parse and the curated
 * FTA / organisation / country-metadata files.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = join(here, 'data', 'raw');
const outDir = join(here, '..', 'public', 'data');

const loadJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

/** Subject string → broad category. Order matters: first match wins. */
export const CATEGORY_RULES = [
  ['Taxation', /tax|fiscal evasion|double taxation/i],
  ['Trade & Economic', /trade|commerce|economic|tariff|customs|investment|wheat|wool|sugar|meat|commodit|market|bank|finan|monetary|debts?\b/i],
  ['Defence & Security', /defence|defense|military|armed forces|security|status of forces|weapons|arms|disarmament|mutual assistance in criminal|war graves|peacekeeping/i],
  ['Nuclear', /nuclear|atomic|safeguards|uranium/i],
  ['Extradition & Justice', /extradition|criminal|judicial|legal proceedings|prisoners|justice|corruption|drugs|narcotic/i],
  ['Aviation', /air services|aviation|aircraft|carriage by air/i],
  ['Maritime & Fisheries', /maritime|shipping|sea\b|seabed|fish|whal|boundar|continental shelf|law of the sea|navigation/i],
  ['Space', /space|satellite|moon|celestial/i],
  ['Science & Technology', /scien|technolog|research|antarct|meteorolog/i],
  ['Environment', /environment|climate|pollution|ozone|biodiversity|conservation|nature|wetlands|desertification|hazardous waste/i],
  ['Health', /health|medical|sanitary|epidemi|tobacco/i],
  ['Migration & Consular', /migration|visa|consular|passport|residence|entry|refugee|nationality|citizenship/i],
  ['Social Security', /social security|pension|superannuation/i],
  ['Culture & Education', /cultur|education|film|heritage|sport|copyright|intellectual property/i],
  ['Communications', /telecommunication|postal|telegraph|radio|broadcast|communication/i],
  ['Development & Aid', /development|aid|assistance|loan|grant|cooperation agreement/i],
  ['Labour', /labour|labor|employment|working/i],
];

export function categorise(subject, title = '') {
  const text = `${subject ?? ''} ${title}`;
  for (const [cat, re] of CATEGORY_RULES) if (re.test(text)) return cat;
  return 'Other';
}

export function deriveStatus(t) {
  const actions = (t.TreatyActions ?? []).map((a) => a.Action?.toLowerCase() ?? '');
  if (actions.some((a) => a.includes('terminat') || a.includes('withdraw') || a.includes('denounc'))) {
    return 'terminated';
  }
  if (t.EntryIntoForceForAustraliaDate || t.EntryIntoForceGenerallyDate) return 'in-force';
  if (t.AtnifNumber) return 'not-yet-in-force';
  return 'other';
}

const dateOnly = (iso) => (iso ? iso.slice(0, 10) : null);
const yearOf = (iso) => (iso ? Number(iso.slice(0, 4)) : null);

export function trimTreaty(t) {
  const date = dateOnly(t.DoneAtDate);
  return {
    id: t.Id,
    title: t.Title,
    type: t.AgreementType === 'Bilateral' ? 'B' : 'M',
    countries: t.Countries ?? [],
    subject: t.Subject ?? null,
    category: categorise(t.Subject, t.Title),
    place: t.DoneAtPlace ?? null,
    date,
    year: yearOf(t.DoneAtDate),
    eifAu: dateOnly(t.EntryIntoForceForAustraliaDate),
    eifGen: dateOnly(t.EntryIntoForceGenerallyDate),
    status: deriveStatus(t),
    ats: t.AtsNumber ?? null,
    atnif: t.AtnifNumber ?? null,
    link: t.AtsLink ?? t.TreatyLink ?? t.AtnifLink ?? null,
    actions: (t.TreatyActions ?? [])
      .filter((a) => a.Action)
      .map((a) => ({ date: dateOnly(a.Date), action: a.Action })),
  };
}

/** Parse a post description like "Australian Embassy - Buenos Aires". */
export function parsePost(desc) {
  if (!desc) return null;
  const m = desc.match(/^(.*?)\s*[-–]\s*(.+)$/);
  const kind = (m ? m[1] : desc).trim();
  const city = m ? m[2].trim() : null;
  let type = 'other';
  const k = kind.toLowerCase();
  if (k.includes('high commission')) type = 'high-commission';
  else if (k.includes('embassy')) type = 'embassy';
  else if (k.includes('consulate')) type = 'consulate';
  else if (k.includes('representative') || k.includes('office')) type = 'office';
  const australian = k.startsWith('australian');
  return { type, kind, city, australian, description: desc };
}

async function main() {
  const [treatiesRaw, missionsRaw, ftas, orgs, metaFile] = await Promise.all([
    loadJson(join(rawDir, 'treaties-raw.json')),
    loadJson(join(rawDir, 'missions-raw.json')),
    loadJson(join(here, 'data', 'ftas.json')),
    loadJson(join(here, 'data', 'organisations.json')),
    loadJson(join(here, 'data', 'country-meta.json')),
  ]);

  // ---- country name resolution ----
  const canon = new Map(); // lowercased alias -> canonical meta entry
  for (const c of metaFile.countries) {
    canon.set(c.name.toLowerCase(), c);
    for (const a of c.aliases ?? []) canon.set(a.toLowerCase(), c);
  }
  const normalise = (name) => name.replace(/^\*+\s*/, '').replace(/\s+/g, ' ').trim();
  const unmatched = new Map();
  const resolve = (name) => {
    const hit = canon.get(normalise(name).toLowerCase());
    if (!hit) unmatched.set(name, (unmatched.get(name) ?? 0) + 1);
    return hit ?? null;
  };

  // A few treaty records cram several parties into one string.
  const SPLIT_RULES = {
    'indonesia/netherlands': ['Indonesia', 'Netherlands'],
    'germany & greece': ['Germany', 'Greece'],
    'iceland liechtenstein norway': ['Iceland', 'Liechtenstein', 'Norway'],
    // Draft Extradition Treaty with Tunisia (Id 3886) has Countries: "N/A - see below"
    'n/a - see below': ['Tunisia'],
  };
  // Non-country rows on the missions page (regional consulate notes, UN mission etc.)
  const IGNORE = new Set(
    [
      'N/A - see below',
      '(Australian Consulates in the Caribbean)',
      'Caribbean, The',
      'Lisbon',
      'Bengaluru',
      'USA, New York',
    ].map((s) => s.toLowerCase()),
  );
  const expand = (name) => SPLIT_RULES[normalise(name).toLowerCase()] ?? [name];

  // ---- treaties ----
  const treaties = treatiesRaw.treaties.map(trimTreaty);
  treaties.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  // canonicalise country names inside treaties so the site joins cleanly
  for (const t of treaties) {
    t.countries = [...new Set(t.countries.flatMap(expand).map((n) => resolve(n)?.name ?? normalise(n)))];
  }

  // ---- per-country aggregates ----
  const countries = new Map(); // canonical name -> aggregate
  const ensure = (name) => {
    if (!countries.has(name)) {
      const meta = canon.get(name.toLowerCase()) ?? null;
      countries.set(name, {
        name,
        iso2: meta?.iso2 ?? null,
        iso3: meta?.iso3 ?? null,
        region: meta?.region ?? 'Other',
        lat: meta?.lat ?? null,
        lng: meta?.lng ?? null,
        historical: meta?.historical ?? false,
        entity: meta?.entity ?? false,
        territory: meta?.territory ?? false,
        successor: meta?.successor ?? null,
        bilateral: 0,
        multilateral: 0,
        inForceBilateral: 0,
        terminatedBilateral: 0,
        byDecade: {},
        byCategory: {},
        first: null,
        last: null,
        post: null,
        postCount: 0,
        coveredFrom: null,
        covers: [],
        sharedConsular: false,
        ftas: [],
        orgs: [],
      });
    }
    return countries.get(name);
  };

  for (const t of treaties) {
    for (const name of t.countries) {
      const c = ensure(name);
      if (t.type === 'B') {
        c.bilateral++;
        if (t.status === 'in-force') c.inForceBilateral++;
        if (t.status === 'terminated') c.terminatedBilateral++;
      } else {
        c.multilateral++;
      }
      if (t.year) {
        const dec = Math.floor(t.year / 10) * 10;
        c.byDecade[dec] = (c.byDecade[dec] ?? 0) + 1;
      }
      c.byCategory[t.category] = (c.byCategory[t.category] ?? 0) + 1;
      if (t.year) {
        if (!c.first || t.date < c.first.date) c.first = { id: t.id, date: t.date, year: t.year, title: t.title };
        if (!c.last || t.date > c.last.date) c.last = { id: t.id, date: t.date, year: t.year, title: t.title };
      }
    }
  }

  // ---- diplomatic posts ----
  // Countries can list several posts (embassy + consulates + delegations);
  // keep the highest-ranking as the primary and count the rest.
  const POST_RANK = { embassy: 4, 'high-commission': 4, office: 2, consulate: 1, other: 0 };
  for (const e of missionsRaw.entries) {
    if (IGNORE.has(normalise(e.country).toLowerCase())) continue;
    const meta = resolve(e.country);
    const name = meta?.name ?? normalise(e.country);
    const c = ensure(name);
    const post = parsePost(e.post);
    if (post?.australian) c.postCount++;
    const better =
      post &&
      (!c.post ||
        (post.australian && !c.post.australian) ||
        (post.australian === c.post.australian && POST_RANK[post.type] > POST_RANK[c.post.type]));
    if (better) c.post = post;
    c.sharedConsular = c.sharedConsular || e.sharedConsular;
    if (e.coveredFrom && !c.coveredFrom) {
      // a couple of "see X" referrals name a city rather than a country
      const CITY_FIX = { lisbon: 'Portugal', 'usa, new york': 'United States of America' };
      const target = CITY_FIX[normalise(e.coveredFrom).toLowerCase()] ?? e.coveredFrom;
      const covMeta = resolve(target);
      c.coveredFrom = covMeta?.name ?? normalise(target);
    }
  }
  // A country with a resident Australian post isn't "covered from" anywhere —
  // the referral rows on the page are consular notes, not accreditation.
  for (const c of countries.values()) {
    if (c.post?.australian && (c.post.type === 'embassy' || c.post.type === 'high-commission')) {
      c.coveredFrom = null;
    }
  }
  // reverse edges: which countries does each resident post cover
  for (const c of countries.values()) {
    if (c.coveredFrom) {
      const hub = ensure(c.coveredFrom);
      hub.covers.push(c.name);
    }
  }
  for (const c of countries.values()) c.covers.sort();

  // ---- FTAs & organisations ----
  for (const fta of ftas.agreements) {
    for (const p of fta.partners) {
      const meta = resolve(p);
      ensure(meta?.name ?? p).ftas.push(fta.code);
    }
  }
  for (const org of orgs.organisations) {
    for (const m of org.members ?? []) {
      const meta = resolve(m);
      ensure(meta?.name ?? m).orgs.push(org.code);
    }
  }

  // ---- global stats ----
  const timeline = {};
  for (const t of treaties) {
    if (!t.year) continue;
    timeline[t.year] ??= { B: 0, M: 0 };
    timeline[t.year][t.type]++;
  }

  const catTotals = {};
  for (const t of treaties) catTotals[t.category] = (catTotals[t.category] ?? 0) + 1;

  const statusTotals = {};
  for (const t of treaties) statusTotals[t.status] = (statusTotals[t.status] ?? 0) + 1;

  const stats = {
    meta: {
      generatedAt: new Date().toISOString(),
      atdExpected: treatiesRaw.expectedTotal,
      atdCollected: treatiesRaw.collected,
      missionEntries: missionsRaw.entries.length,
      sources: {
        atd: 'https://www.dfat.gov.au/international-relations/treaties/australian-treaties-database',
        missions: 'https://www.dfat.gov.au/about-us/our-locations/missions/Pages/our-embassies-and-consulates-overseas',
        ftas: 'https://www.dfat.gov.au/trade/agreements',
      },
    },
    totals: {
      treaties: treaties.length,
      bilateral: treaties.filter((t) => t.type === 'B').length,
      multilateral: treaties.filter((t) => t.type === 'M').length,
      countries: [...countries.values()].filter((c) => !c.historical && !c.entity && !c.territory).length,
      residentPosts: [...countries.values()].filter((c) => c.post?.australian).length,
      australianPosts: [...countries.values()].reduce((sum, c) => sum + c.postCount, 0),
      ftasInForce: ftas.agreements.filter((a) => a.status === 'in-force').length,
    },
    statusTotals,
    catTotals,
    timeline,
    ftas: ftas.agreements,
    organisations: orgs.organisations.map((o) => ({
      code: o.code,
      name: o.name,
      kind: o.kind,
      memberCount: o.members ? o.members.length + 1 : null, // +1 = Australia
    })),
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'treaties.json'), JSON.stringify({ treaties }));
  await writeFile(
    join(outDir, 'countries.json'),
    JSON.stringify({ countries: [...countries.values()].sort((a, b) => b.bilateral - a.bilateral) }),
  );
  await writeFile(join(outDir, 'stats.json'), JSON.stringify(stats));

  console.log(`treaties.json: ${treaties.length} treaties`);
  console.log(`countries.json: ${countries.size} entities`);
  if (unmatched.size) {
    console.log('UNMATCHED country names (add aliases to country-meta.json):');
    for (const [n, count] of [...unmatched.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}× ${JSON.stringify(n)}`);
    }
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();
