'use client';

import { useRef, useState } from 'react';

type Props = {
  slug: string;
  kind: 'master-plan' | 'drone' | 'media' | 'section';
  accept: string;
  currentUrl?: string | null;
};

export default function ProjectAssetUpload({ slug, kind, accept, currentUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState(currentUrl || '');

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      const response = await fetch(`/api/projects/${encodeURIComponent(slug)}/assets`, {
        method: 'POST',
        body: form,
        credentials: 'same-origin',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      setUploadedUrl(data.url || '');
      // The upload API persists master-plan and drone URLs directly in Supabase.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="button secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : uploadedUrl ? 'Replace file' : 'Upload file'}
        </button>
        {uploadedUrl && <span style={{ fontSize: 13, color: 'var(--muted, #6b7280)' }}>File uploaded</span>}
      </div>
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {error && <small style={{ color: '#b91c1c' }}>{error}</small>}
    </div>
  );
}
