import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Mail,
  Minus,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react';
import { api, type BrandProgress } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
}

export function ProgressPanel({ brand }: Props) {
  const [data, setData] = useState<BrandProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestCopied, setDigestCopied] = useState(false);

  const openDigest = async () => {
    setDigest('');
    setDigestLoading(true);
    setDigestCopied(false);
    try {
      const d = await api.getBrandDigest(brand);
      setDigest(d.markdown);
    } catch (err) {
      setDigest(`Error: ${(err as Error).message}`);
    } finally {
      setDigestLoading(false);
    }
  };

  const copyDigest = async () => {
    if (!digest) return;
    try {
      await navigator.clipboard.writeText(digest);
      setDigestCopied(true);
      setTimeout(() => setDigestCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.getBrandProgress(brand);
      setData(p);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Activity className="text-emerald-600" size={20} />
          <h3 className="font-bold text-slate-900">Progress & Tracking</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openDigest}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5"
          >
            <Mail className="w-3 h-3" /> Weekly digest
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      </div>

      {digest !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <FileText size={14} /> Weekly Digest — {brand}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={copyDigest}
                  disabled={!digest || digestLoading}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {digestCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {digestCopied ? 'Copied' : 'Copy markdown'}
                </button>
                <button
                  onClick={() => setDigest(null)}
                  className="p-1.5 rounded hover:bg-slate-100"
                >
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {digestLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="animate-spin mx-auto mb-2 text-emerald-600" />
                  <p className="text-slate-600 text-xs">Generating digest…</p>
                </div>
              ) : (
                <pre className="font-mono text-[11px] whitespace-pre-wrap text-slate-800 leading-relaxed">
                  {digest}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
      <SectionIntro>
        Compares your <b>oldest</b> vs <b>newest</b> scan across every metric — so you see if the
        fixes you've checked off are actually moving the needle. Re-scan after each major fix to
        record a new data point.
      </SectionIntro>

      {error && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <DeltaCard
              label="Real visibility"
              latest={data.snapshots[0]?.realMentionRate ?? null}
              delta={data.deltas.realMentionRate}
              suffix="%"
              color="emerald"
            />
            <DeltaCard
              label="Brand presence"
              latest={data.snapshots[0]?.brandPresenceScore ?? null}
              delta={data.deltas.brandPresenceScore}
              suffix="/100"
              color="violet"
            />
            <DeltaCard
              label="Audit score"
              latest={data.snapshots[0]?.auditScorePct ?? null}
              delta={data.deltas.auditScorePct}
              suffix="%"
              color="blue"
            />
            <DeltaCard
              label="On-page SEO"
              latest={data.snapshots[0]?.onPageAvgScore ?? null}
              delta={data.deltas.onPageAvgScore}
              suffix="/100"
              color="amber"
            />
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryStat
              label="Actions in flight"
              value={String(data.actionsTotal)}
              icon={<TrendingUp size={14} className="text-slate-500" />}
            />
            <SummaryStat
              label="Actions completed"
              value={String(data.actionsCompleted)}
              icon={<CheckCircle2 size={14} className="text-emerald-600" />}
            />
            <SummaryStat
              label="Completion rate"
              value={data.actionsTotal === 0 ? '—' : `${Math.round((data.actionsCompleted / data.actionsTotal) * 100)}%`}
              icon={<Activity size={14} className="text-violet-600" />}
            />
          </div>

          {data.snapshots.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                Recent scan timeline ({data.snapshots.length})
              </p>
              <div className="space-y-1">
                {data.snapshots.map((s, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 text-xs px-3 py-1.5 rounded bg-slate-50">
                    <span className="text-slate-500">
                      {s.date ? new Date(s.date).toLocaleDateString() : '—'}
                    </span>
                    <span>
                      <b className="text-emerald-700">{s.realMentionRate ?? '—'}%</b>
                      <span className="text-slate-400 ml-1">real</span>
                    </span>
                    <span>
                      <b className="text-amber-700">{s.echoMentionRate ?? '—'}%</b>
                      <span className="text-slate-400 ml-1">echo</span>
                    </span>
                    <span>
                      <b className="text-blue-700">{s.auditScorePct ?? '—'}%</b>
                      <span className="text-slate-400 ml-1">audit</span>
                    </span>
                    <span>
                      <b className="text-violet-700">{s.brandPresenceScore ?? '—'}</b>
                      <span className="text-slate-400 ml-1">presence</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.snapshots.length < 2 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Only {data.snapshots.length} scan recorded so far. Run another scan after applying
              fixes to see deltas.
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DeltaCard({
  label,
  latest,
  delta,
  suffix,
  color,
}: {
  label: string;
  latest: number | null;
  delta: number | null;
  suffix: string;
  color: 'emerald' | 'violet' | 'blue' | 'amber';
}) {
  const colorMap = {
    emerald: 'border-emerald-200 bg-emerald-50',
    violet: 'border-violet-200 bg-violet-50',
    blue: 'border-blue-200 bg-blue-50',
    amber: 'border-amber-200 bg-amber-50',
  } as const;
  return (
    <div className={`border rounded-lg p-3 ${colorMap[color]}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">
        {latest === null ? '—' : `${latest}${suffix}`}
      </p>
      <p className="text-[11px] mt-0.5 inline-flex items-center gap-0.5">
        {delta === null ? (
          <span className="text-slate-400">no prior data</span>
        ) : delta > 0 ? (
          <span className="text-emerald-700 font-semibold">
            <ArrowUpRight className="w-3 h-3 inline" /> +{delta}{suffix}
          </span>
        ) : delta < 0 ? (
          <span className="text-rose-700 font-semibold">
            <ArrowDownRight className="w-3 h-3 inline" /> {delta}{suffix}
          </span>
        ) : (
          <span className="text-slate-500">
            <Minus className="w-3 h-3 inline" /> no change
          </span>
        )}
      </p>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
