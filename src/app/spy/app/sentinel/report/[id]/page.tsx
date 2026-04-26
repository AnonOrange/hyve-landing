'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Audit = {
  id: string;
  user_email: string;
  tier: string;
  status: string;
  scan_completed_at: string | null;
  agreement_signed_name: string;
};

type Asset = {
  id: string;
  asset_type: string;
  identifier: string;
  display_label: string | null;
};

type Finding = {
  id: string;
  asset_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  vendor: string;
  exposure_type: string;
  port: number;
  endpoint_path: string;
  signature: string;
  remediation_title: string;
  remediation_steps: string[];
};

const SEVERITY_META: Record<string, { color: string; rank: number }> = {
  critical: { color: '#FF2D2D', rank: 0 },
  high:     { color: '#F59E0B', rank: 1 },
  medium:   { color: '#FBBF24', rank: 2 },
  low:      { color: '#22D3EE', rank: 3 },
};

export default function ReportPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<{ audit: Audit; assets: Asset[]; findings: Finding[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/spy/sentinel/report/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setData(j); })
      .catch((e) => setError(String(e)));
  }, [id]);

  if (error) return <div className="p-6 text-sm text-[#FF2D2D]">{error}</div>;
  if (!data) return <div className="p-6 text-xs text-[#94A3B8]">Loading report…</div>;

  const { audit, assets, findings } = data;
  const sortedFindings = [...findings].sort((a, b) => (SEVERITY_META[a.severity]?.rank ?? 9) - (SEVERITY_META[b.severity]?.rank ?? 9));
  const counts = findings.reduce<Record<string, number>>((acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {});
  const assetById: Record<string, Asset> = {};
  for (const a of assets) assetById[a.id] = a;

  return (
    <main className="min-h-screen bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div className="border-b border-[#0D2235] px-4 py-3">
        <div className="font-mono text-[10px] tracking-[0.4em] text-[#A855F7]">SENTINEL · AUDIT REPORT</div>
        <div className="text-base font-black text-white">{audit.tier.toUpperCase()} Audit</div>
        <div className="mt-1 font-mono text-[10px] text-[#64748B]">
          Signed by: {audit.agreement_signed_name} · Completed {audit.scan_completed_at ? new Date(audit.scan_completed_at).toLocaleString() : 'pending'}
        </div>
      </div>

      {/* Severity summary */}
      <section className="mx-auto max-w-3xl px-4 pt-6">
        <div className="mb-3 font-mono text-[10px] tracking-widest text-[#94A3B8]">SUMMARY</div>
        <div className="grid grid-cols-4 gap-2">
          {(['critical','high','medium','low'] as const).map((s) => (
            <div key={s} className="rounded border bg-black/30 p-3 text-center" style={{ borderColor: SEVERITY_META[s].color }}>
              <div className="text-2xl font-black text-white">{counts[s] || 0}</div>
              <div className="font-mono text-[9px] tracking-widest" style={{ color: SEVERITY_META[s].color }}>{s.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 font-mono text-[11px] text-[#94A3B8]">
          {findings.length} finding{findings.length === 1 ? '' : 's'} across {assets.length} asset{assets.length === 1 ? '' : 's'}.
          {findings.length === 0 && ' No exposures found — your assets look secure from external probing.'}
        </div>
      </section>

      {/* Findings list */}
      <section className="mx-auto max-w-3xl px-4 py-6">
        {sortedFindings.length === 0 ? (
          <div className="rounded border border-[#22C55E] bg-[#22C55E]/10 p-8 text-center">
            <div className="mb-2 text-4xl">✓</div>
            <div className="text-base font-bold text-white">All clear</div>
            <div className="mt-1 text-xs text-[#94A3B8]">No exposures detected on the assets you registered.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedFindings.map((f) => {
              const asset = assetById[f.asset_id];
              const sev = SEVERITY_META[f.severity];
              return (
                <div key={f.id} className="rounded border-2 bg-black/20 p-5" style={{ borderColor: sev.color }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded px-2 py-0.5 text-[9px] font-black tracking-widest text-white" style={{ background: sev.color }}>
                      {f.severity.toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] text-[#94A3B8]">port {f.port} · {f.endpoint_path}</span>
                  </div>
                  <div className="mb-1 text-base font-bold text-white">{f.remediation_title}</div>
                  <div className="mb-1 font-mono text-[10px] text-[#94A3B8]">
                    Asset: <span className="text-[#E2E8F0]">{asset?.display_label || asset?.identifier || '?'}</span> ({asset?.asset_type})
                  </div>
                  <div className="mb-3 font-mono text-[10px] text-[#64748B]">Signature: {f.signature}</div>
                  <div className="mb-2 font-mono text-[10px] tracking-widest text-[#A855F7]">REMEDIATION</div>
                  <ol className="list-decimal space-y-1.5 pl-5 text-[11px] leading-relaxed text-[#E2E8F0]">
                    {f.remediation_steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-8 font-mono text-[10px] text-[#64748B]">
        Report generated for audit {audit.id}. Save this URL — your audit and findings are stored for 90 days for your records.
      </div>
    </main>
  );
}
