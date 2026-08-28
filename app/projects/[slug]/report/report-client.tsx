'use client';
import { useEffect, useState } from 'react';
import { useHeader } from '@/lib/header-context';
import Link from 'next/link';
import { ArrowLeft, Download, TrendingUp, Users, MapPin, CheckCircle } from 'lucide-react';

type PlotRow = { number: string; status: string; areaSqYd: number | null; areaSqFt: number | null; lengthM: number | null; widthM: number | null; price: number | null; direction: string; section: string };
type OwnerSummary = { id: string; name: string; email: string | null; phone: string | null; totalPlots: number; totalAreaSqYd: number; totalAreaSqFt: number; statusCounts: Record<string, number>; plots: PlotRow[] };
type Stats = { total: number; available: number; reserved: number; sold: number; hold: number; totalAreaSqYd: number; ownersCount: number; unassigned: number };
type Report = { project: { name: string; address: string }; stats: Stats; owners: OwnerSummary[]; unassigned: PlotRow[] };

const STATUS_DOT: Record<string, string> = { available: '#16a34a', reserved: '#ca8a04', sold: '#dc2626', hold: '#64748b' };
const STATUS_BG: Record<string, string>  = { available: '#f0fdf4', reserved: '#fffbeb', sold: '#fef2f2', hold: '#f8fafc' };

function Dot({ status }: { status: string }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: STATUS_DOT[status] || '#334155', flexShrink: 0, marginRight: 5 }} />;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, background: STATUS_BG[status] || '#f8fafc', fontSize: 11, fontWeight: 700, color: STATUS_DOT[status] || '#334155' }}>
      <Dot status={status} />{status}
    </span>
  );
}

export default function ReportClient({ slug, projectName }: { slug: string; projectName: string }) {
  const { setState } = useHeader();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'owners' | 'unassigned'>('owners');

  useEffect(() => {
    setState({ projectName });
    fetch(`/api/projects/${encodeURIComponent(slug)}/report`, { cache: 'no-store' })
      .then(r => r.json()).then(setReport).finally(() => setLoading(false));
  }, [slug, projectName]);

  function toggleOwner(id: string) {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function exportCSV() {
    if (!report) return;
    const rows = [['Owner', 'Email', 'Phone', 'Plot', 'Status', 'Area (sq.yd)', 'Area (sq.ft)', 'Length (m)', 'Width (m)', 'Price', 'Direction']];
    for (const o of report.owners) {
      for (const p of o.plots) {
        rows.push([o.name, o.email || '', o.phone || '', p.number, p.status, String(p.areaSqYd || ''), String(p.areaSqFt || ''), String(p.lengthM || ''), String(p.widthM || ''), String(p.price || ''), p.direction || '']);
      }
    }
    for (const p of report.unassigned) {
      rows.push(['Unassigned', '', '', p.number, p.status, String(p.areaSqYd || ''), String(p.areaSqFt || ''), '', '', String(p.price || ''), '']);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${slug}-owners-report.csv`; a.click();
  }

  const s = { card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05)' } as React.CSSProperties };

  if (loading) return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b', fontSize: 14 }}>Loading report…</div>;
  if (!report) return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#b91c1c' }}>Failed to load report.</div>;

  const { stats, owners, unassigned } = report;

  return (
    <div style={{ minHeight: '100%', background: '#f4f6f9', fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif', color: '#182235' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href={`/projects/${slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #dbe2ea', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, color: '#243047', textDecoration: 'none' }}>
            <ArrowLeft size={13} /> Map View
          </Link>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>OWNERS REPORT</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#172033' }}>{report.project.name}</div>
          </div>
        </div>
        <button onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #172554', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 800, color: '#172554', background: '#fff', cursor: 'pointer' }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 60px' }}>
        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { icon: <MapPin size={16} color="#172554" />, label: 'Total Plots', value: stats.total, bg: '#eef2ff' },
            { icon: <Users size={16} color="#0369a1" />, label: 'Owners', value: stats.ownersCount, bg: '#f0f9ff' },
            { icon: <CheckCircle size={16} color="#16a34a" />, label: 'Available', value: stats.available, bg: '#f0fdf4' },
            { icon: <TrendingUp size={16} color="#dc2626" />, label: 'Sold', value: stats.sold, bg: '#fef2f2' },
            { icon: <span style={{ fontSize: 14 }}>⏸</span>, label: 'Reserved', value: stats.reserved, bg: '#fffbeb' },
            { icon: <span style={{ fontSize: 14 }}>🔒</span>, label: 'Hold', value: stats.hold, bg: '#f8fafc' },
            { icon: <span style={{ fontSize: 14 }}>📐</span>, label: 'Total Area', value: `${stats.totalAreaSqYd.toLocaleString()} yd²`, bg: '#faf5ff' },
            { icon: <span style={{ fontSize: 14 }}>❓</span>, label: 'Unassigned', value: stats.unassigned, bg: '#fff7ed' },
          ].map(({ icon, label, value, bg }) => (
            <div key={label} style={{ ...s.card, background: bg, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <div style={{ flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 2 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
          {[['owners', `Owners (${owners.length})`], ['unassigned', `Unassigned (${unassigned.length})`]].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} style={{ padding: '8px 16px', border: 'none', borderBottom: activeTab === tab ? '2px solid #172554' : '2px solid transparent', background: 'none', fontSize: 13, fontWeight: 800, color: activeTab === tab ? '#172554' : '#64748b', cursor: 'pointer', marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

        {/* Owners tab */}
        {activeTab === 'owners' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {owners.length === 0 && <div style={{ ...s.card, color: '#64748b', textAlign: 'center', padding: 32 }}>No owners assigned yet.</div>}
            {owners.map(owner => {
              const isOpen = expanded.has(owner.id);
              return (
                <div key={owner.id} style={s.card}>
                  {/* Owner header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }} onClick={() => toggleOwner(owner.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 999, background: '#172554', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 15, flexShrink: 0 }}>
                        {owner.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{owner.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {owner.email && <span>✉ {owner.email}</span>}
                          {owner.phone && <span>📞 {owner.phone}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Summary chips */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#172554' }}>{owner.totalPlots}</div>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>plots</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{owner.totalAreaSqYd.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>sq.yd</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {Object.entries(owner.statusCounts).map(([st, cnt]) => (
                          <span key={st} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, background: STATUS_BG[st] || '#f8fafc', fontSize: 11, fontWeight: 700, color: STATUS_DOT[st] || '#334155' }}>
                            <Dot status={st} />{cnt}
                          </span>
                        ))}
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: 18, userSelect: 'none' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Plot table */}
                  {isOpen && (
                    <div style={{ marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 12, overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            {['Plot', 'Status', 'Length', 'Width', 'Area (sq.yd)', 'Area (sq.ft)', 'Price', 'Direction'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 900, color: '#94a3b8', letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {owner.plots.map((p, i) => (
                            <tr key={p.number} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 800 }}>#{p.number}</td>
                              <td style={{ padding: '8px 10px' }}><StatusBadge status={p.status} /></td>
                              <td style={{ padding: '8px 10px', color: '#475569' }}>{p.lengthM ? `${p.lengthM}m` : '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#475569' }}>{p.widthM ? `${p.widthM}m` : '—'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700 }}>{p.areaSqYd ?? '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>{p.areaSqFt ?? '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#172554', fontWeight: 700 }}>{p.price ? `₹${p.price}` : '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>{p.direction || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        {owner.totalPlots > 1 && (
                          <tfoot>
                            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                              <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 800, fontSize: 12 }}>Total ({owner.totalPlots} plots)</td>
                              <td style={{ padding: '8px 10px', fontWeight: 900, color: '#172554' }}>{owner.totalAreaSqYd.toLocaleString()}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700, color: '#475569' }}>{owner.totalAreaSqFt.toLocaleString()}</td>
                              <td colSpan={2} />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unassigned tab */}
        {activeTab === 'unassigned' && (
          <div style={s.card}>
            {unassigned.length === 0
              ? <div style={{ color: '#64748b', textAlign: 'center', padding: 32 }}>All plots are assigned to owners.</div>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {['Plot', 'Status', 'Area (sq.yd)', 'Area (sq.ft)', 'Price'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 900, color: '#94a3b8', letterSpacing: .5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {unassigned.sort((a, b) => Number(a.number) - Number(b.number)).map((p, i) => (
                        <tr key={p.number} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 800 }}>#{p.number}</td>
                          <td style={{ padding: '8px 10px' }}><StatusBadge status={p.status} /></td>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{p.areaSqYd ?? '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{p.areaSqFt ?? '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#172554', fontWeight: 700 }}>{p.price ? `₹${p.price}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
