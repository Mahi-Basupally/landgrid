import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="editor-shell" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {children}
      <style>{`
        .editor-shell a[href="/projects/manage"] { display: none !important; }
        html body .editor-shell header > div:nth-child(2) {
          position: fixed !important;
          top: 14px !important;
          right: 16px !important;
          z-index: 110 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        html body .editor-shell header > div:nth-child(2) > span {
          position: static !important;
          white-space: nowrap !important;
          order: 1 !important;
        }
        html body .editor-shell header > div:nth-child(2) > button:first-of-type { order: 2 !important; }
        html body .editor-shell header > div:nth-child(2) > button:last-of-type { order: 4 !important; }
        .editor-back-projects {
          position: fixed;
          top: 14px;
          right: 156px;
          z-index: 121;
          height: 38px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #dbe2ea;
          border-radius: 9px;
          background: rgba(255,255,255,.98);
          color: #334155;
          box-shadow: 0 3px 12px rgba(15,23,42,.10);
          text-decoration: none;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
      `}</style>
      <Link className="editor-back-projects" href="/projects" aria-label="Back to projects">
        <ArrowLeft size={16} /> Back to Projects
      </Link>
    </div>
  );
}
