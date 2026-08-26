'use client';

import dynamic from 'next/dynamic';

const PlotEditor = dynamic(() => import('./plot-editor'), { ssr: false });

export default function PlotEditorShell({ projectSlug }: { projectSlug: string }) {
  return <PlotEditor projectSlug={projectSlug} />;
}
