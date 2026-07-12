# Site Plan: Foreign Relations

## Overview
- **Name:** Foreign Relations
- **Repo name:** au-relations
- **Tagline:** How Australia formally relates to every other government on Earth — 4,500+ treaties, the entire diplomatic network, trade agreements and international organisation memberships in one explorer.

## Target Audience
Australians researching Australia's relationship with a specific country — journalists checking what agreements exist with, say, Indonesia before a summit; students and academics in international relations; policy staffers; travellers and migrants wondering about visa/social-security/tax treaties with their country; and trade-exposed businesses checking FTA coverage.

## Value Proposition
The official sources are fragmented and hostile to browsing: the Australian Treaties Database is a search box with 20-results-a-page pagination, the embassy network is a static alphabetical webpage, FTAs live on a separate DFAT section, and organisation memberships aren't compiled anywhere. Nobody can currently answer "what is the full formal relationship between Australia and X?" in one place. This site joins all four datasets per country and makes the whole treaty corpus explorable by time, subject, and geography.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth required? |
|--------|-----|-------------------|-----------------|----------------|
| Australian Treaties Database (DFAT) | https://docs.dfat.gov.au/api/search (POST, JSON) | All 4,522 treaty records: title, type (bilateral/multilateral), countries, subject, done-at date/place, entry-into-force dates, status, treaty actions, ATS/ATNIF numbers, AustLII links | Irregular, roughly monthly-quarterly | No |
| DFAT embassies & consulates list | https://www.dfat.gov.au/about-us/our-locations/missions/Pages/our-embassies-and-consulates-overseas | Resident posts (embassy/high commission/consulate) per country + non-resident accreditation ("see France") | A few times a year | No |
| DFAT FTA status (curated snapshot) | https://www.dfat.gov.au/trade/agreements | Free trade agreements in force / signed / under negotiation, per partner | ~Yearly | No |
| Curated org memberships | DFAT/org websites | Australia's memberships: UN, G20, OECD, WTO, APEC, CPTPP, Commonwealth, PIF, Quad, AUKUS, Five Eyes, IMF, ADB, etc., with co-members | ~Yearly | No |
| World countries GeoJSON | Natural Earth (via public mirror) | Country polygons + ISO codes for the Leaflet choropleth | Static | No |

## Key Features
1. **Country relationship drill-down** — click any country anywhere for the complete formal relationship: every bilateral treaty, treaty subjects, timeline, diplomatic post (or which embassy covers it), FTA status, shared organisations. Hash-linkable (`#country=japan`).
2. **World map** — Leaflet choropleth of bilateral treaty counts, toggleable to diplomatic-post view (resident post vs covered-from), FTA coverage view.
3. **Treaty database** — all 4,522 treaties searchable and filterable by type, subject, status, country, decade; sortable; each row expandable with full detail + AustLII link.
4. **Century timeline** — treaties signed per year 1901–2026, stacked bilateral/multilateral, annotated with eras (Federation, WWII, UN founding, decolonisation, post-Cold-War, China's rise).
5. **Diplomatic network graph** — force-directed hub-and-spoke of the accreditation network: which resident embassy covers which non-resident countries (e.g. Paris also covers Algeria, Monaco…).
6. **Subject × country matrix** — heatmap of top treaty partners against subject categories (trade, defence, taxation, extradition, air services, science…).
7. **Leaderboard** — countries ranked by bilateral treaty count, with per-decade sparklines, FTA badges, post presence.
8. **Auto-insights** — computed findings: densest treaty decade, countries with FTAs but few treaties, terminated treaties, oldest still-in-force agreements, coverage gaps (countries with no treaties AND no post).

## Target Audience (detailed)
Desk researchers on desktop (journalists, students, policy staff) — tech-comfortable, expect a serious civic reference tool. Secondary: general public on mobile checking one country ("does Australia have an embassy in X? a tax treaty?"), often mid-conversation or pre-travel. Both groups need fast lookup by country name and plain-language explanations of treaty jargon (ATS, entry into force, accession).

## Style Direction
**Tone:** professional/civic — an authoritative reference, like a well-designed government portal.
**Colour palette:** light theme; deep navy primary with a gold/ochre accent (diplomatic, Australian — echoes DFAT's own navy/gold without imitating it). Clean whites, slate greys for chrome.
**UI density:** balanced — data-dense tables where needed, but generous headers and readable type; it's a reference work, not a terminal.
**Dark/light theme:** light.
**Reference sites for tone:** treaties.un.org (content), abs.gov.au (clean civic light theme done well).

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite
- **Data strategy:** pipeline — `pipeline/collect.mjs` pulls the full ATD via its JSON search API (year-sliced queries with Id de-dupe because pagination ordering is unstable) and parses the DFAT missions page; `pipeline/aggregate.mjs` joins with curated FTA/orgs/country-metadata into `public/data/`. Source publishes irregularly (~monthly at fastest) → **quarterly cron** (Jan/Apr/Jul/Oct), staggered day/hour.
- **Key libraries:** Leaflet (world choropleth) only. All charts/graphs hand-rolled SVG.

## Layout
Fixed light header (site name, view tabs, country search box, `?` about button). Main content area max-width 1600px. Country drill-down is a slide-in right panel (full-screen sheet on mobile) available from every view. Sticky footer with attribution. Below 768px: tabs collapse to a scrollable strip, panels stack, map gets a shorter viewport.

## Pages/Views
1. Countries (leaderboard — default)
2. Map (Leaflet, 3 modes: treaties / posts / FTAs)
3. Treaties (database table)
4. Timeline (century view)
5. Network (accreditation graph)
6. Matrix (subject × country)
7. Insights (auto-detected findings)
+ Country drill-down slide-in panel (from all views), About modal, glossary tooltips throughout.

## Visualization Strategy
- **Leaderboard table** (countries ranked, sparklines, badges) — the "who matters most" view; default because it's the most immediately newsworthy.
- **Leaflet choropleth** — geographic distribution of treaty intensity + the physical footprint of the diplomatic network; the only view that shows coverage gaps spatially. Three data modes.
- **Sortable treaty table** — the ground-truth: full corpus for verification and deep search. Always include.
- **Timeline (SVG stacked bars)** — how the treaty-making changed over 125 years; bilateral vs multilateral mix shows the multilateralisation of diplomacy post-1945.
- **Force network (SVG, hand-rolled physics)** — accreditation hub-and-spoke reveals structure invisible elsewhere: ~80 resident posts covering ~200 countries; Paris/Nairobi/Port-of-Spain style hubs.
- **Matrix heatmap (SVG)** — which subjects dominate which relationships (e.g. Indonesia: security+borders; Switzerland: tax; US: defence+space). Cross-cutting insight no other view gives.
- **Histogram-style decade distribution inside drill-down** — per-country tempo of engagement.
- **Insight cards** — computed anomalies and superlatives with severity colours.
