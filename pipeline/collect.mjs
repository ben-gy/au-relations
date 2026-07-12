#!/usr/bin/env node
/**
 * Collects raw data for Foreign Relations:
 *  1. The full Australian Treaties Database (ATD) via its JSON search API.
 *     The API paginates 20/page with UNSTABLE ordering, so we slice queries
 *     by DoneAtDate year and de-duplicate by Id, re-fetching each slice until
 *     the distinct count matches the slice's totalCount.
 *  2. The DFAT "our embassies and consulates overseas" page (resident posts
 *     + non-resident accreditation per country).
 *
 * Outputs raw JSON to pipeline/data/raw/. Run aggregate.mjs afterwards.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = join(here, 'data', 'raw');

const ATD_SEARCH = 'https://docs.dfat.gov.au/api/search';
const MISSIONS_URL =
  'https://www.dfat.gov.au/about-us/our-locations/missions/Pages/our-embassies-and-consulates-overseas';
const UA = 'au-relations-pipeline/1.0 (https://au-relations.benrichardson.dev; open data aggregator)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, body, attempt = 1) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': UA,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 5) throw err;
    await sleep(1500 * attempt);
    return post(url, body, attempt + 1);
  }
}

function searchBody(page, dateStart, dateEnd) {
  const body = { keyword: '', page, facets: {}, dateFilters: {} };
  if (dateStart) body.dateFilters.DoneAtDate = { start: dateStart, end: dateEnd };
  return body;
}

async function collectTreaties() {
  const byId = new Map();

  // How many treaties exist in total?
  const overall = await post(ATD_SEARCH, searchBody(1));
  const expectedTotal = overall.totalCount;
  console.log(`ATD reports ${expectedTotal} treaties total`);

  const thisYear = new Date().getUTCFullYear();
  for (let year = 1900; year <= thisYear + 1; year++) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const first = await post(ATD_SEARCH, searchBody(1, start, end));
    const sliceTotal = first.totalCount;
    if (sliceTotal === 0) continue;

    const slice = new Map();
    for (const r of first.results) slice.set(r.Id, r);

    // Ordering is unstable, so loop over pages repeatedly until the slice
    // is complete (small slices converge in 1-2 rounds).
    let rounds = 0;
    while (slice.size < sliceTotal && rounds < 12) {
      rounds++;
      for (let page = 1; page <= first.totalPages && slice.size < sliceTotal; page++) {
        if (rounds === 1 && page === 1) continue; // already have it
        const d = await post(ATD_SEARCH, searchBody(page, start, end));
        for (const r of d.results) slice.set(r.Id, r);
        await sleep(120);
      }
    }
    if (slice.size < sliceTotal) {
      console.warn(`  ${year}: INCOMPLETE ${slice.size}/${sliceTotal} after ${rounds} rounds`);
    }
    for (const [id, r] of slice) byId.set(id, r);
    console.log(`  ${year}: ${slice.size}/${sliceTotal} (running total ${byId.size})`);
    await sleep(120);
  }

  // Catch-all for records with no/odd DoneAtDate: sample unfiltered pages
  // (random ordering works in our favour) until nothing new appears.
  let stale = 0;
  let attempts = 0;
  while (byId.size < expectedTotal && stale < 30 && attempts < 400) {
    attempts++;
    const page = 1 + (attempts % overall.totalPages);
    const d = await post(ATD_SEARCH, searchBody(page));
    let added = 0;
    for (const r of d.results) {
      if (!byId.has(r.Id)) {
        byId.set(r.Id, r);
        added++;
      }
    }
    stale = added === 0 ? stale + 1 : 0;
    await sleep(120);
  }

  console.log(`Collected ${byId.size}/${expectedTotal} treaties`);
  return {
    fetchedAt: new Date().toISOString(),
    expectedTotal,
    collected: byId.size,
    treaties: [...byId.values()],
  };
}

/** Parse the DFAT missions page into per-country diplomatic coverage. */
export function parseMissions(html) {
  const entries = [];
  // Country sections are <h3 id="a">A</h3><ul class="links">...</ul>
  const sectionRe = /<h3 id="[a-z]">[A-Z]<\/h3>\s*<ul class="links">([\s\S]*?)<\/ul>/g;
  let m;
  while ((m = sectionRe.exec(html))) {
    const liRe = /<li>([\s\S]*?)<\/li>/g;
    let li;
    while ((li = liRe.exec(m[1]))) {
      const item = li[1];
      const nameMatch = item.match(/<strong>([^<]+)<\/strong>/);
      if (!nameMatch) continue;
      const name = decode(nameMatch[1]).trim();

      const text = decode(item.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      // The post description is a parenthesised phrase AFTER the country name
      // (the name itself can contain parens, e.g. "China (People's Republic of)"),
      // and at least one entry has a missing closing paren, so accept end-of-string.
      // Annotation parens like "(North Korea)" are skipped by requiring post-like words.
      const rest = item.slice(item.indexOf('</strong>') + '</strong>'.length);
      const restText = decode(rest.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      const POST_RE = /embassy|high commission|consulate|mission|office|delegation|representative/i;
      let post = null;
      for (const pm of restText.matchAll(/\(([^)]*)(?:\)|$)/g)) {
        if (POST_RE.test(pm[1])) {
          post = pm[1].trim();
          break;
        }
      }

      // "- see X" / "- see also X" → the country whose resident mission covers this one
      const seeMatch = item.match(/-\s*see(?:\s+also)?\s+<a[^>]*>([^<]+)<\/a>/i);
      const seeAlso = seeMatch ? decode(seeMatch[1]).trim() : null;

      entries.push({
        country: name,
        post, // e.g. "Australian Embassy - Buenos Aires" | "Canadian Embassy - Algiers" | null
        sharedConsular: text.trimStart().startsWith('*'), // * = consular services by Canada etc.
        coveredFrom: seeAlso, // country name whose Australian mission is accredited here
      });
    }
  }
  return entries;
}

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&rsquo;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

async function fetchMissionsHtml() {
  // dfat.gov.au sits behind a WAF that tarpits non-browser user agents,
  // so present browser-like headers and retry patiently.
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(MISSIONS_URL, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-AU,en;q=0.9',
        },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`missions page HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      console.warn(`missions fetch attempt ${attempt} failed: ${err.message ?? err}`);
      await sleep(5000 * attempt);
    }
  }
  throw lastErr;
}

async function collectMissions() {
  const html = await fetchMissionsHtml();
  const entries = parseMissions(html);
  console.log(`Parsed ${entries.length} country coverage entries from DFAT missions page`);
  if (entries.length < 150) {
    throw new Error(`missions parse suspiciously small (${entries.length}) — page layout changed?`);
  }
  return { fetchedAt: new Date().toISOString(), entries };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const only = process.argv[2]; // optional: --treaties | --missions
  await mkdir(rawDir, { recursive: true });
  if (only !== '--missions') {
    const treaties = await collectTreaties();
    await writeFile(join(rawDir, 'treaties-raw.json'), JSON.stringify(treaties));
  }
  if (only !== '--treaties') {
    const missions = await collectMissions();
    await writeFile(join(rawDir, 'missions-raw.json'), JSON.stringify(missions, null, 1));
  }
  console.log('collect.mjs done');
}
