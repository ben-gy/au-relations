// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/** Tiny DOM helpers shared by all views. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  html = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (html) node.innerHTML = html;
  return node;
}

let tooltip: HTMLDivElement | null = null;

/** Singleton hover tooltip for SVG visualizations. */
export function showTooltip(x: number, y: number, html: string): void {
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'viz-tooltip';
    document.body.appendChild(tooltip);
  }
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  const w = tooltip.offsetWidth;
  const left = Math.min(x + 14, window.innerWidth - w - 10);
  const top = Math.min(y + 14, window.innerHeight - tooltip.offsetHeight - 10);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function hideTooltip(): void {
  if (tooltip) tooltip.style.display = 'none';
}

/** Attach hover tooltip behaviour to an element. */
export function hoverTip(node: Element, html: () => string): void {
  node.addEventListener('mousemove', (e) => {
    const me = e as MouseEvent;
    showTooltip(me.clientX, me.clientY, html());
  });
  node.addEventListener('mouseleave', hideTooltip);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}
