'use client';

import { useEffect } from 'react';

type LotMeta = { number: string; owner: string; color: string };

/** Keeps the external LandGrid filter panel and the SVG map in sync. */
export default function LandGridFilterSync() {
  useEffect(() => {
    const root = document.body;
    const statusColors: Record<string, string> = {
      available: 'rgb(22, 163, 74)', reserved: 'rgb(202, 138, 4)',
      sold: 'rgb(220, 38, 38)', hold: 'rgb(100, 116, 139)',
    };

    const readState = () => {
      const panel = document.querySelector('.lg-filter-panel');
      if (!panel) return;

      const selectedOwners = Array.from(panel.querySelectorAll<HTMLButtonElement>('.lg-owner-row'))
        .filter(b => b.classList.contains('active'))
        .map(b => ({
          name: (b.querySelector('span:nth-child(2)')?.textContent || '').trim().toLowerCase(),
          color: getComputedStyle(b.querySelector('.lg-owner-dot') as Element | null).backgroundColor || '#2563eb',
        }));
      const statusButton = Array.from(panel.querySelectorAll<HTMLButtonElement>('.lg-status-row'))
        .find(b => getComputedStyle(b).backgroundColor === 'rgb(23, 37, 84)');
      const status = statusButton?.textContent?.trim().split(/\s+/)[0]?.toLowerCase() || 'all';
      const query = (panel.querySelector<HTMLInputElement>('.lg-search')?.value || '').trim().toLowerCase();

      const plotMeta = new Map<string, LotMeta>();
      panel.querySelectorAll<HTMLButtonElement>('.lg-plot-row').forEach(row => {
        const number = (row.querySelector('div > div')?.textContent || '').replace(/^Plot\s+/i, '').trim();
        const meta = (row.querySelector('.meta')?.textContent || '').trim();
        const dot = row.querySelector('span') as Element | null;
        if (number) plotMeta.set(number, { number, owner: meta.split(' · ')[0].toLowerCase(), color: dot ? getComputedStyle(dot).backgroundColor : '' });
      });

      const svg = Array.from(document.querySelectorAll<SVGSVGElement>('.pv-canvas svg')).find(s => s.querySelector('polygon'));
      if (!svg) return;
      svg.querySelectorAll<SVGGElement>('g').forEach(group => {
        const label = Array.from(group.querySelectorAll('text')).find(t => !t.hasAttribute('data-landgrid-yard'))?.textContent?.trim();
        if (!label) return;
        const poly = group.querySelector<SVGPolygonElement>('polygon');
        if (!poly) return;
        const meta = plotMeta.get(label);
        const ownerMatch = selectedOwners.find(o => meta?.owner === o.name);
        const searchMatch = !query || label.toLowerCase().includes(query) || (meta?.owner || '').includes(query);
        const statusMatch = status === 'all' || statusColors[status] === meta?.color;
        const filteredOut = Boolean(query || status !== 'all') && (!searchMatch || !statusMatch);
        poly.style.setProperty('fill', ownerMatch?.color || '');
        poly.style.setProperty('fill-opacity', ownerMatch ? '.88' : filteredOut ? '.12' : '');
        poly.style.setProperty('stroke', ownerMatch ? '#fff' : '');
        poly.style.setProperty('stroke-width', ownerMatch ? '5' : '');
        poly.style.setProperty('filter', ownerMatch ? 'drop-shadow(0 0 6px rgba(15,23,42,.28))' : '');
      });
    };

    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(readState); };
    // Do not observe style attributes: this component changes polygon styles itself.
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener('input', schedule, true);
    root.addEventListener('click', schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      root.removeEventListener('input', schedule, true);
      root.removeEventListener('click', schedule, true);
    };
  }, []);
  return null;
}
