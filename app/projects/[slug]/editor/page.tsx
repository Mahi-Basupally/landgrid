import PlotEditor from '@/components/plot-editor-v2';

export default async function ProjectEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PlotEditor projectSlug={slug} />;
}
