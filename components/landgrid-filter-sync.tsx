'use client';

import { useEffect } from 'react';

type LotMeta = { number: string; owner: string; color: string };

/** Keeps the external LandGrid filter panel and the SVG map in sync. */
export default function LandGridFilterSync() {
  useEffect(() => {
    const root = document.body;
    const statusColors: Record<string, string> = {
      available: 'rgb(22, 163, 74)',
      reserved: 'rgb(202, 138, 4)',
      sold: 'rgb(220, 38, 38)',
      hold: 'rgb(100, 116, 139)',
    };

    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

    const readState = () => {
      const panel = document.querySelector('.lg-filter-panel') || document.querySelector('.lg-left-panel');
      if (!panel) return;

      // landgrid-filters.tsx renders owner rows as .lg-owner.
      // The previous .lg-owner-row selector never matched the real DOM.
      const selectedOwners = Array.from(panel.querySelectorAll<HTMLButtonElement>('.lg-owner'))
        .filter(b => b.classList.contains('active'))
        .map(b => {
          const dot = b.querySelector('.lg-dot');
          const nameNode = Array.from(b.querySelectorAll('span')).find(
            span => !span.classList.contains('lg-dot') && !span.classList.contains('lg-check'),
          );
          return {
            name: normalize(nameNode?.textContent || ''),
            color: dot ? getComputedStyle(dot).backgroundColor : '#2563eb',
          };
        })
        .filter(o => o.name);

      const statusButton = Array.from(panel.querySelectorAll<HTMLButtonElement>('.lg-status'))
        .find(b => b.classList.contains('active'));
      const status = normalize(statusButton?.textContent || '').split(/\s+/)[0] || 'all';
      const query = normalize(panel.querySelector<HTMLInputElement>('.lg-search-wrap input')?.value || '');

      const plotMeta = new Map<string, LotMeta>();
      panel.querySelectorAll<HTMLButtonElement>('.lg-plot').forEach(row => {
        const number = normalize(
          row.querySelector('b')?.textContent?.replace(/^Plot\s+/i, '') || '',
        );
        const spans = Array.from(row.querySelectorAll('span'));
        const details = spans.find(s => s.querySelector('small'))?.querySelector('small')?.textContent || '';
        const parts = details.split(' · ');
        const dot = row.querySelector('.lg-dot');
        if (number) {
          plotMeta.set(number, {
            number,
            owner: normalize(parts[0] || ''),
            color: dot ? getComputedStyle(dot).backgroundColor : '',
          });
        }
      });

      const svg = Array.from(document.querySelectorAll<SVGSVGElement>('.pv-canvas svg')).find(s => s.querySelector('polygon'));
      if (!svg) return;

      svg.querySelectorAll<SVGGElement>('g').forEach(group => {
        const label = normalize(
          Array.from(group.querySelectorAll('text'))
            .find(t => !t.hasAttribute('data-landgrid-yard') && !t.hasAttribute('data-landgrid-yard-label'))
            ?.textContent || '',
        );
        if (!label) return;

        const poly = group.querySelector<SVGPolygonElement>('polygon');
        if (!poly) return;

        const meta = plotMeta.get(label);
        const ownerMatch = meta ? selectedOwners.find(o => o.name === meta.owner) : undefined;
        const searchMatch = !query || label.includes(query) || (meta?.owner || '').includes(query);
        const statusMatch = status === 'all' || statusColors[status] === meta?.color;
        const filteredOut = Boolean(query || status !== 'all') && (!searchMatch || !statusMatch);

        if (ownerMatch) {
          poly.style.setProperty('fill', ownerMatch.color, 'important');
          poly.style.setProperty('fill-opacity', '.88', 'important');
          poly.style.setProperty('stroke', '#fff', 'important');
          poly.style.setProperty('stroke-width', '5', 'important');
          poly.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(15,23,42,.28))', 'important');
        } else {
          poly.style.removeProperty('fill');
          poly.style.setProperty('fill-opacity', filteredOut ? '.12' : '', 'important');
          poly.style.removeProperty('stroke');
          poly.style.removeProperty('stroke-width');
          poly.style.removeProperty('filter');
        }
      });
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(readState);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener('input', schedule, true);
    root.addEventListener('click', schedule, true);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener('input', schedule, true);
      root.removeEventListener('click', schedule, true);
    };
  }, []);

  return null;
}
