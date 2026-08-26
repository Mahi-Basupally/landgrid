import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import PlotEditor from '@/components/plot-editor';

export const dynamic = 'force-dynamic';

export default async function ProjectEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: project } = await supabaseAdmin()
    .from('projects')
    .select('name')
    .eq('slug', slug)
    .maybeSingle();
  const projectName = project?.name || slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <PlotEditor projectSlug={slug} />

      <style>{`
        /* Keep the editor header clean: the canvas Save action is the primary save control. */
        header > div:nth-child(2) {
          position: fixed !important;
          top: 14px !important;
          right: 16px !important;
          z-index: 110 !important;
          gap: 8px !important;
        }
        header > div:nth-child(2) > span {
          position: fixed;
          top: 22px;
          right: 184px;
        }
        header > div:nth-child(2) > button:first-of-type,
        header > div:nth-child(2) > button:last-of-type {
          width: 36px !important;
          height: 36px !important;
        }
        main > div:first-child > button:nth-of-type(5) {
          position: fixed !important;
          top: 14px !important;
          right: 270px !important;
          z-index: 111 !important;
        }
      `}</style>

      <Link
        href="/projects/manage"
        aria-label="Back to projects"
        title="Back to projects"
        style={{
          position: 'fixed',
          top: 14,
          left: 16,
          zIndex: 120,
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

      <div
        style={{
          position: 'fixed',
          top: 14,
          left: 175,
          zIndex: 120,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 850, color: '#182235', whiteSpace: 'nowrap' }}>{projectName}</div>
      </div>
    </div>
  );
}
