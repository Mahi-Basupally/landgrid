import LotEditor from '@/components/lot-editor';

export default async function ProjectEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LotEditor projectSlug={slug} />;
}
