import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PlotEditor from '@/components/plot-editor';

export default async function ProjectEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <PlotEditor projectSlug={slug} />
      <Link
        href="/projects/manage"
        aria-label="Back to projects"
        title="Back to projects"
        style={{
          position: 'fixed',
          top: 14,
          left: 16,
          zIndex: 100,
          height: 38,
          padding: '0 12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          border: '1px solid #dbe2ea',
          borderRadius: 9,
          background: 'rgba(255,255,255,.96)',
          color: '#334155',
          boxShadow: '0 3px 12px rgba(15,23,42,.10)',
          textDecoration: 'none',
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        <ArrowLeft size={16} /> Back to Projects
      </Link>
    </div>
  );
}
