import {redirect} from 'next/navigation';
export default async function Embed({params}:{params:Promise<{slug:string}>}){const {slug}=await params; redirect(`/projects/${slug}`)}
