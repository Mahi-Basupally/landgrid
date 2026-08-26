import PlotEditorShell from '@/components/plot-editor-shell';

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PlotEditorShell projectSlug={slug} />;
}
