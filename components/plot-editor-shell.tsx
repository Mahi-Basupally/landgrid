'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, LogOut, Settings } from 'lucide-react';
import { signOut } from '@/lib/signout';
import styles from './plot-editor-shell.module.css';

const PlotEditor = dynamic(() => import('./plot-editor'), { ssr: false });

export default function PlotEditorShell({ projectSlug }: { projectSlug: string }) {
  const [projectName, setProjectName] = useState('LandGrid');

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load project');
        return data;
      })
      .then((data) => {
        if (active && data.project?.name) setProjectName(String(data.project.name));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [projectSlug]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.leftActions}>
          <span className={styles.saved} title="Changes are saved automatically">
            <Check size={15} strokeWidth={2.5} />
            All changes saved
          </span>
          <Link href={`/projects/${encodeURIComponent(projectSlug)}/manage`} className={styles.action}>
            <ArrowLeft size={16} />
            Back
          </Link>
          <Link href={`/projects/${encodeURIComponent(projectSlug)}/settings`} className={styles.action}>
            <Settings size={16} />
            Settings
          </Link>
          <button type="button" className={styles.action} onClick={() => void signOut()}>
            <LogOut size={16} />
            Log out
          </button>
        </div>
        <div className={styles.title} title={projectName}>{projectName}</div>
        <div className={styles.rightSpacer} />
      </header>
      <div className={styles.editorArea}>
        <PlotEditor projectSlug={projectSlug} />
      </div>
    </div>
  );
}
