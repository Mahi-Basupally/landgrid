'use client';

import { useEffect, useRef } from 'react';

export default function LandGridFilterDebug() {
  const attempts = useRef<Record<string, number>>({});
  const last = useRef<Record<string, number>>({});

  useEffect(() => {
    const root = document.querySelector('.lg-left-panel');
    if (!root) {
      console.warn('[LandGrid Debug] .lg-left-panel not found');
      return;
    }

    const pendingOwnerClicks = new WeakMap<Element, number>();
    const ownerClickSeen = new WeakSet<Element>();

    const labelFor = (el: Element) => {
      const owner = el.closest('.lg-owner')?.textContent?.trim();
      if (owner) return `Owner: ${owner}`;
      const status = el.closest('.lg-status')?.textContent?.trim();
      if (status) return `Status: ${status}`;
      if (el.closest('.lg-heading')) return `Section: ${el.closest('.lg-heading')?.textContent?.trim()}`;
      const plot = el.closest('.lg-plot')?.textContent?.trim();
      if (plot) return `Plot: ${plot}`;
      if (el.closest('.lg-search-wrap')) return 'Free Search';
      return el.tagName;
    };

    const pointerDown = (event: Event) => {
      const pointerEvent = event as PointerEvent;
      const target = pointerEvent.target;
      if (!(target instanceof Element)) return;
      const label = labelFor(target);
      attempts.current[label] = (attempts.current[label] || 0) + 1;
      const now = performance.now();
      const delta = last.current[label] == null ? null : Math.round(now - last.current[label]);
      last.current[label] = now;

      // Owner rows are rendered by landgrid-filters.tsx as .lg-owner.
      // Keep the fallback aligned with the real DOM class so it can recover
      // from browsers/components that suppress the React click handler.
      const ownerRow = target.closest('.lg-owner') as HTMLButtonElement | null;
      if (ownerRow && pointerEvent.button === 0) {
        ownerClickSeen.delete(ownerRow);
        const oldTimer = pendingOwnerClicks.get(ownerRow);
        if (oldTimer) window.clearTimeout(oldTimer);

        const timer = window.setTimeout(() => {
          pendingOwnerClicks.delete(ownerRow);
          if (ownerClickSeen.has(ownerRow)) return;
          ownerRow.click();
          console.info('[LandGrid Debug] OWNER CLICK FALLBACK', {
            label,
            owner: ownerRow.textContent?.trim(),
          });
        }, 80);
        pendingOwnerClicks.set(ownerRow, timer);
      }

      console.info('[LandGrid Debug] POINTERDOWN', {
        label,
        attempt: attempts.current[label],
        pointerType: pointerEvent.pointerType,
        button: pointerEvent.button,
        deltaMs: delta,
        defaultPrevented: pointerEvent.defaultPrevented,
        target: target.outerHTML.slice(0, 180),
      });
    };

    const clickCapture = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target;
      if (!(target instanceof Element)) return;
      const ownerRow = target.closest('.lg-owner');
      if (ownerRow) {
        ownerClickSeen.add(ownerRow);
        const timer = pendingOwnerClicks.get(ownerRow);
        if (timer) window.clearTimeout(timer);
        pendingOwnerClicks.delete(ownerRow);
      }
      const label = labelFor(target);
      console.info('[LandGrid Debug] CLICK CAPTURE', {
        label,
        defaultPrevented: mouseEvent.defaultPrevented,
        target: target.outerHTML.slice(0, 180),
      });
    };

    const clickBubble = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target;
      if (!(target instanceof Element)) return;
      const label = labelFor(target);
      console.info('[LandGrid Debug] CLICK BUBBLE', {
        label,
        defaultPrevented: mouseEvent.defaultPrevented,
      });
    };

    root.addEventListener('pointerdown', pointerDown, true);
    root.addEventListener('click', clickCapture, true);
    root.addEventListener('click', clickBubble, false);

    console.info('[LandGrid Debug] READY', { project: window.location.pathname });

    return () => {
      root.removeEventListener('pointerdown', pointerDown, true);
      root.removeEventListener('click', clickCapture, true);
      root.removeEventListener('click', clickBubble, false);
    };
  }, []);

  return null;
}
