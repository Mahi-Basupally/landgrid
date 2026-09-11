'use client';

/**
 * Legacy filter/map bridge intentionally disabled.
 * Filter state and map highlighting are now owned by LandGridFilters.
 * Keeping this component as a no-op prevents old document-level listeners
 * and MutationObservers from fighting React state and DOM reconciliation.
 */
export default function LandGridFilterSync() {
  return null;
}
