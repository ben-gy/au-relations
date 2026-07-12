# Foreign Relations

**How Australia formally relates to every other government on Earth — 4,500+ treaties, the entire diplomatic network, trade agreements and international organisation memberships in one explorer.**

🔗 **Live:** [https://au-relations.benrichardson.dev](https://au-relations.benrichardson.dev)

## What is this?

The official record of Australia's external relationships is scattered across sources that are hostile to browsing: the DFAT Australian Treaties Database is a search box that pages 20 results at a time, the overseas missions network is a static alphabetical webpage, free trade agreements live in a separate section of dfat.gov.au, and organisation memberships aren't compiled anywhere at all.

Foreign Relations joins all of it, per country. It holds every treaty action in the Australian Treaties Database (4,500+ records back to 1901), the complete network of Australian embassies, high commissions and consulates — including which resident embassy covers each country that has none — all 19 free trade agreements in force, and Australia's memberships of selective bodies like the G20, OECD, APEC, the Commonwealth, the Pacific Islands Forum, the Quad and AUKUS.

The result answers a question no single official source can: *what is the full formal relationship between Australia and country X?* — every treaty, its subject and status, the diplomatic presence, the trade agreement, and the shared memberships, in one click.

## Who is this for?

Journalists checking what agreements exist with a country before a summit or dispute; international relations students and researchers exploring how Australia's treaty-making changed over 125 years; policy staffers needing the treaty base of a bilateral relationship; and travellers or migrants checking whether Australia has an embassy, a tax treaty or a social security agreement with their country.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| [DFAT Australian Treaties Database](https://www.dfat.gov.au/international-relations/treaties/australian-treaties-database) | All treaty records: parties, subjects, dates, status, treaty actions, AustLII links | Irregular (~monthly at fastest) |
| [DFAT embassies & consulates list](https://www.dfat.gov.au/about-us/our-locations/missions/Pages/our-embassies-and-consulates-overseas) | Resident posts per country + non-resident accreditation | A few times a year |
| [DFAT trade agreements](https://www.dfat.gov.au/trade/agreements) (curated) | FTAs in force and under negotiation | ~Yearly |
| Curated membership lists | G20, OECD, APEC, Commonwealth, PIF, EAS, Quad, AUKUS, Five Eyes, IPEF | ~Yearly |
| Natural Earth (via world.geo.json) | Country boundaries for the map | Static |

## Features

- **Countries leaderboard** — every country ranked by bilateral treaty depth, with per-decade sparklines, in-force/terminated counts, diplomatic presence and FTA badges
- **World map** — Leaflet choropleth switchable between treaty intensity, diplomatic footprint (resident / covered / Canadian consular sharing) and FTA coverage
- **Country drill-down** — hash-linkable slide-in panel with the complete relationship: stats, posts, FTAs, shared memberships, decade chart, top subjects, and the full bilateral treaty list
- **Treaty database** — all 4,500+ treaties searchable and filterable by type, status, subject category and decade, with AustLII full-text links
- **Timeline** — 125 years of treaty-making, stacked bilateral/multilateral with historical era markers, plus a cumulative treaty-stock curve
- **Embassy network** — force-directed graph of the accreditation system: how ~120 resident posts cover nearly 200 countries, with regional filtering
- **Subject matrix** — heatmap of top partners × 17 subject categories showing what each relationship is made of
- **Auto-insights** — computed findings: densest relationships, dormant ones, termination-rate outliers, diplomatic hubs, coverage gaps
- **Glossary everywhere** — click-to-explain tooltips for treaty jargon (ATS, entry into force, accession, high commission vs embassy…), plus an About panel

## Tech Stack

- **Runtime:** Vanilla TypeScript
- **Build:** Vite 6
- **Testing:** Vitest (56 tests)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** GitHub Actions pipeline (quarterly cron) → static JSON
- **Libraries:** Leaflet (map). All other visualisations are hand-rolled SVG.

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build
npm run preview
```

## How it works

`pipeline/collect.mjs` pulls the full treaties database from the ATD's JSON search API. The API paginates 20 records at a time with unstable ordering, so the collector slices queries by signature year and de-duplicates by record Id until each slice is complete. It also fetches and parses the DFAT missions page (resident posts and "see X" accreditation referrals).

`pipeline/aggregate.mjs` normalises ~280 country-name variants against a curated metadata table (ISO codes, regions, historical states like the USSR), auto-categorises treaty subjects into 17 groups, joins in the curated FTA and organisation-membership data, and writes three JSON files to `public/data/`: the trimmed treaty corpus, per-country aggregates, and global stats.

A GitHub Actions workflow re-runs the pipeline quarterly (the sources publish irregularly) and commits any changes; the site itself is a static Vite build that loads the JSON at runtime — country aggregates up front, the full treaty corpus lazily.

## License

MIT
