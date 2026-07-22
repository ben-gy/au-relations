// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
export interface Treaty {
  id: string;
  title: string;
  type: 'B' | 'M';
  countries: string[];
  subject: string | null;
  category: string;
  place: string | null;
  date: string | null;
  year: number | null;
  eifAu: string | null;
  eifGen: string | null;
  status: 'in-force' | 'terminated' | 'not-yet-in-force' | 'other';
  ats: string | null;
  atnif: string | null;
  link: string | null;
  actions: { date: string | null; action: string }[];
}

export interface Post {
  type: 'embassy' | 'high-commission' | 'consulate' | 'office' | 'other';
  kind: string;
  city: string | null;
  australian: boolean;
  description: string;
}

export interface Country {
  name: string;
  iso2: string | null;
  iso3: string | null;
  region: string;
  lat: number | null;
  lng: number | null;
  historical: boolean;
  entity: boolean;
  territory: boolean;
  successor: string | null;
  bilateral: number;
  multilateral: number;
  inForceBilateral: number;
  terminatedBilateral: number;
  byDecade: Record<string, number>;
  byCategory: Record<string, number>;
  first: { id: string; date: string; year: number; title: string } | null;
  last: { id: string; date: string; year: number; title: string } | null;
  post: Post | null;
  postCount: number;
  coveredFrom: string | null;
  covers: string[];
  sharedConsular: boolean;
  ftas: string[];
  orgs: string[];
}

export interface Fta {
  code: string;
  name: string;
  partners: string[];
  status: 'in-force' | 'under-negotiation';
  since: number | null;
}

export interface OrgSummary {
  code: string;
  name: string;
  kind: string;
  memberCount: number | null;
}

export interface Stats {
  meta: {
    generatedAt: string;
    atdExpected: number;
    atdCollected: number;
    missionEntries: number;
    sources: Record<string, string>;
  };
  totals: {
    treaties: number;
    bilateral: number;
    multilateral: number;
    countries: number;
    residentPosts: number;
    australianPosts: number;
    ftasInForce: number;
  };
  statusTotals: Record<string, number>;
  catTotals: Record<string, number>;
  timeline: Record<string, { B: number; M: number }>;
  ftas: Fta[];
  organisations: OrgSummary[];
}

export interface AppData {
  stats: Stats;
  countries: Country[];
  byName: Map<string, Country>;
}
