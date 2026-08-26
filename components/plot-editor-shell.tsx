'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import AppHeader from './app-header';
import styles from './plot-editor-shell.module.css';
const PlotEditor = dynamic(() => import('./plot-editor'), { ssr: false });
export default function PlotEditorShell({ projectSlug }: { projectSlug: string }) {
  const [projectName, setProjectName] = useState('');
  useEffect(() => { let active = true; fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Unable to load project'); return d; }).then(d => { if (active && d.project?.name) setProjectName(String(d.project.name)); }).catch(() => undefined); return () => { active = false; }; }, [projectSlug]);
  return <div className={styles.plotEditorPage}><AppHeader projectName={projectName} pageHeading="Map & Manage" showSave /><div className={styles.plotEditorArea}><PlotEditor projectSlug={projectSlug} /></div></div>;
}
