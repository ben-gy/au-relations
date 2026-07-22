// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/** Plain-language definitions for every piece of treaty/diplomatic jargon in the UI. */
export const GLOSSARY: Record<string, string> = {
  treaty:
    'A formal, legally binding written agreement between countries (or between countries and international organisations) governed by international law.',
  bilateral: 'A treaty between exactly two parties — Australia and one other country.',
  multilateral:
    'A treaty open to three or more parties — often dozens of countries signing a single convention (e.g. the UN Charter).',
  'ATS number':
    'Australian Treaty Series number — the official citation for a treaty that has entered into force for Australia, e.g. [1976] ATS 10.',
  ATNIF:
    'Australian Treaties Not yet In Force — the citation series for treaties Australia has signed but which have not yet entered into force for Australia.',
  'entry into force':
    'The date a treaty becomes legally binding. A treaty can enter into force "generally" (for the world) and separately "for Australia".',
  ratification:
    'The formal act by which a country confirms it is bound by a treaty it has signed — in Australia this happens after tabling in Parliament and JSCOT review.',
  accession:
    'Joining a treaty that other countries have already negotiated and signed — a shortcut to membership without having been an original signatory.',
  'exchange of notes':
    'A treaty made through an exchange of formal diplomatic letters rather than a single signed document — common for practical arrangements like visas or air services.',
  terminated:
    'A treaty that has ceased to be in force — because it expired, was replaced, or a party withdrew from (denounced) it.',
  embassy:
    "Australia's diplomatic mission in the capital of a foreign country, headed by an Ambassador.",
  'high commission':
    'The name used instead of "embassy" for missions between Commonwealth countries — headed by a High Commissioner rather than an Ambassador.',
  consulate:
    'A smaller post focused on consular services (passports, emergencies, visas) and trade, often outside the capital, headed by a Consul-General or Consul.',
  accreditation:
    "When Australia has no resident mission in a country, an Australian embassy in a nearby country is formally 'accredited' to it and covers the relationship from there.",
  JSCOT:
    'The Joint Standing Committee on Treaties — the federal parliamentary committee that reviews all treaty actions before Australia ratifies them.',
  depositary:
    'The country or organisation that holds the official copy of a multilateral treaty and records who has signed, ratified or withdrawn.',
  FTA: 'Free Trade Agreement — a treaty reducing tariffs and trade barriers between the parties. Australia has 19 in force.',
  'shared consular':
    'In a few countries Australia has no consular presence and Canada provides consular services to Australians under a reciprocal sharing agreement (and vice versa).',
  'treaty action':
    'Any formal step in the life of a treaty — signature, ratification, entry into force, amendment, withdrawal or termination.',
  AUSFTA: 'The Australia–United States Free Trade Agreement, in force since 2005.',
  NIA: 'National Interest Analysis — the document tabled in Parliament explaining why entering a treaty is in Australia’s national interest.',
};

/** Wrap glossary terms in the tooltip trigger markup. */
export function glossarySpan(term: string, label?: string): string {
  const key = term.toLowerCase();
  return `<span class="glossary-link" data-term="${key}" role="button" tabindex="0">${label ?? term}<span class="glossary-icon" aria-hidden="true">ℹ</span></span>`;
}

/** One-time wiring of a document-level click handler + tooltip element. */
export function initGlossary(): void {
  const tip = document.createElement('div');
  tip.className = 'glossary-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);

  const hide = () => {
    tip.hidden = true;
  };

  const show = (el: HTMLElement) => {
    const term = el.dataset.term ?? '';
    const def = GLOSSARY[term] ?? GLOSSARY[term.replace(/s$/, '')];
    if (!def) return hide();
    tip.innerHTML = `<strong>${term}</strong><p>${def}</p>`;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const tw = Math.min(320, window.innerWidth - 24);
    tip.style.maxWidth = `${tw}px`;
    let left = r.left + window.scrollX;
    if (left + tw > window.scrollX + window.innerWidth - 12) {
      left = window.scrollX + window.innerWidth - tw - 12;
    }
    tip.style.left = `${Math.max(12, left)}px`;
    tip.style.top = `${r.bottom + window.scrollY + 6}px`;
  };

  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.glossary-link');
    if (target) {
      e.stopPropagation();
      if (tip.hidden) show(target);
      else hide();
    } else {
      hide();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).classList?.contains('glossary-link')) {
      e.preventDefault();
      show(e.target as HTMLElement);
    }
  });
  window.addEventListener('scroll', hide, { passive: true });
}
