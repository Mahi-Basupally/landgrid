import { NextResponse } from 'next/server';
import { getCurrentUser, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { deflateRawSync } from 'zlib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSlug(v: string) { return v.toLowerCase().replace(/[^a-z0-9]/g, ''); }

// Minimal ZIP builder (no external deps)
function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const centralDir: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const compressed = deflateRawSync(file.data, { level: 6 });
    const crc = crc32(file.data);
    const now = new Date();
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);

    // Local file header
    const lh = Buffer.alloc(30 + name.length);
    lh.writeUInt32LE(0x04034b50, 0); // sig
    lh.writeUInt16LE(20, 4);          // version needed
    lh.writeUInt16LE(0, 6);           // flags
    lh.writeUInt16LE(8, 8);           // deflate
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressed.length, 18);
    lh.writeUInt32LE(file.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    name.copy(lh, 30);
    parts.push(lh, compressed);

    // Central directory entry
    const cd = Buffer.alloc(46 + name.length);
    cd.writeUInt32LE(0x02014b50, 0); // sig
    cd.writeUInt16LE(20, 4);          // version made by
    cd.writeUInt16LE(20, 6);          // version needed
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(file.data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk start
    cd.writeUInt16LE(0, 36); // internal attr
    cd.writeUInt32LE(0, 38); // external attr
    cd.writeUInt32LE(offset, 42);
    name.copy(cd, 46);
    centralDir.push(cd);

    offset += lh.length + compressed.length;
  }

  const cdBuf = Buffer.concat(centralDir);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, cdBuf, eocd]);
}

// CRC-32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const db = supabaseAdmin();
    const { data: exact } = await db.from('projects')
      .select('id,slug,name,address,description,is_public,created_at,created_by')
      .eq('slug', slug).maybeSingle();
    let project = exact;
    if (!project) {
      const { data: all } = await db.from('projects').select('id,slug,name,address,description,is_public,created_at,created_by');
      project = (all || []).find((p: any) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
    }
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const isOwner = project.created_by === user.id;
    const role = await getMembership(user.id, project.slug);
    if (!isOwner && role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const [plotsRes, ownersRes, plansRes, membersRes] = await Promise.all([
      db.from('plots').select('*').eq('project_id', project.id),
      db.from('project_owners').select('*').eq('project_id', project.id),
      db.from('project_site_plans').select('*').eq('project_id', project.id),
      db.from('project_members').select('user_id,role').eq('project_id', project.id),
    ]);

    const plots = plotsRes.data || [];
    const owners = ownersRes.data || [];
    const plans = plansRes.data || [];
    const members = membersRes.data || [];

    const files: { name: string; data: Buffer }[] = [];

    files.push({ name: 'project.json', data: Buffer.from(JSON.stringify({ project, exportedAt: new Date().toISOString() }, null, 2)) });
    files.push({ name: 'plots.json', data: Buffer.from(JSON.stringify(plots, null, 2)) });
    files.push({ name: 'owners.json', data: Buffer.from(JSON.stringify(owners, null, 2)) });
    files.push({ name: 'members.json', data: Buffer.from(JSON.stringify(members, null, 2)) });
    files.push({ name: 'plans.json', data: Buffer.from(JSON.stringify(plans.map((p: any) => ({
      id: p.id, plan_type: p.plan_type, name: p.name,
      map_url: p.map_url, drone_url: p.drone_url,
      canvas_width: p.canvas_width, canvas_height: p.canvas_height,
    })), null, 2)) });

    // Download images from storage
    for (const plan of plans as any[]) {
      for (const [kind, urlField] of [['map', 'map_url'], ['drone', 'drone_url']]) {
        const rawUrl: string | null = plan[urlField];
        if (!rawUrl) continue;
        let bucket = 'project-assets', path = '';
        if (rawUrl.startsWith('storage://')) {
          path = decodeURIComponent(rawUrl.slice('storage://'.length).replace(/^\/+/, ''));
        } else if (rawUrl.startsWith('http')) {
          const marker = '/storage/v1/object/';
          const idx = rawUrl.indexOf(marker);
          if (idx >= 0) {
            const rest = rawUrl.slice(idx + marker.length).replace(/^\//, '').split('/');
            if (rest[0] === 'public' || rest[0] === 'authenticated') rest.shift();
            bucket = decodeURIComponent(rest[0]);
            path = decodeURIComponent(rest.slice(1).join('/').split('?')[0]);
          }
        }
        if (!path) continue;
        const { data: blob } = await db.storage.from(bucket).download(path);
        if (!blob) continue;
        const ext = path.split('.').pop() || 'bin';
        files.push({ name: `images/${plan.plan_type}-${kind}.${ext}`, data: Buffer.from(await blob.arrayBuffer()) });
      }
    }

    const readme = `# ${project.name} — LandGrid Export\nExported: ${new Date().toISOString()}\n\nFiles\n- project.json  — project metadata\n- plots.json    — all ${plots.length} plots\n- owners.json   — ${owners.length} owners\n- members.json  — ${members.length} members\n- plans.json    — site plan metadata\n- images/       — map and drone images\n`;
    files.push({ name: 'README.txt', data: Buffer.from(readme) });

    const zip = buildZip(files);
    const filename = `${normalizeSlug(project.name) || slug}-export-${Date.now()}.zip`;

    return new NextResponse(zip, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zip.length),
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Export failed' }, { status: 500 });
  }
}
