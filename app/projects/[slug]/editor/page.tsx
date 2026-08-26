import Link from 'next/link';
import { Settings } from 'lucide-react';
import PlotEditor from '@/components/plot-editor';

export default async function ProjectEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <PlotEditor projectSlug={slug} />
      <Link
        href={`/projects/${encodeURIComponent(slug)}/settings`}
        aria-label="Project settings"
        title="Project settings"
        style={{ position: 'fixed', top: 14, right: 16, zIndex: 100, width: 38, height: 38, display: 'grid', placeItems: 'center', border: '1px solid #dbe2ea', borderRadius: 9, background: 'rgba(255,255,255,.96)', color: '#334155', boxShadow: '0 3px 12px rgba(15,23,42,.10)' }}
      ><Settings size={17} /></Link>
    </div>
  );
}
