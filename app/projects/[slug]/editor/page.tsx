import PlotEditor from '@/components/plot-editor';

export default async function ProjectEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PlotEditor projectSlug={slug} />;
}
