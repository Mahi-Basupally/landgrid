'use client';

import dynamic from 'next/dynamic';

const PlotEditor = dynamic(() => import('./plot-editor'), {
  ssr: false,
  loading: () => <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>Loading editor…</div>,
});

export default PlotEditor;
