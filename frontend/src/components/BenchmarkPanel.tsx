import { useEffect, useState } from 'react';
import { GitCompare, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { api, type BrandBenchmark } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
}

const VERDICT_STYLE: Record<
  BrandBenchmark['metrics'][number]['verdict'],
  { label: string; class: string }
> = {
  leader: { label: 'Leader', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  parity: { label: 'On par', class: 'bg-blue-100 text-blue-700 border-blue-200' },
  behind: { label: 'Behind', class: 'bg-amber-100 text-amber-800 border-amber-200' },
  critical: { label: 'Critical', class: 'bg-rose-100 text-rose-700 border-rose-200' },
  unknown: { label: '—', class: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function BenchmarkPanel({ brand }: Props) {
  const [data, setData] = useState<BrandBenchmark | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getBrandBenchmark(brand));
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
          <GitCompare className="text-blue-600" size={20} />
          <h3 className="font-bold text-slate-900">Competitor Benchmark</h3>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      </div>
      <SectionIntro>
        For every measurable signal, see where you sit vs the <b>strongest competitor</b> and the{' '}
        <b>median</b> of the competitor set. Anything in red = competitor leverage you're losing right now.
      </SectionIntro>

      {error && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {data && data.metrics.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">
          No benchmark data yet — run a Competitor Audit + Brand Presence check first.
        </p>
      )}

      {data && data.metrics.length > 0 && (
        <div className="mt-4 space-y-2">
          {data.metrics.map((m) => {
            const v = VERDICT_STYLE[m.verdict];
            const yourVal = m.yours !== null ? `${m.yours}${m.unit}` : '—';
            const topVal = m.topCompetitor ? `${m.topCompetitor.value}${m.unit}` : '—';
            const medianVal = m.median !== null ? `${m.median}${m.unit}` : '—';
            return (
              <div key={m.key} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${v.class}`}>
                    {v.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Cell
                    label="You"
                    value={yourVal}
                    accent={
                      m.verdict === 'critical'
                        ? 'rose'
                        : m.verdict === 'behind'
                          ? 'amber'
                          : m.verdict === 'leader'
                            ? 'emerald'
                            : 'blue'
                    }
                  />
                  <Cell
                    label={
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Top
                      </span>
                    }
                    value={topVal}
                    sub={m.topCompetitor?.name}
                    accent="slate"
                  />
                  <Cell label="Median" value={medianVal} accent="slate" />
                </div>
                {m.gapVsMedian !== null && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Gap vs median:{' '}
                    <span
                      className={
                        m.gapVsMedian > 0
                          ? 'text-emerald-700 font-semibold'
                          : m.gapVsMedian < 0
                            ? 'text-rose-700 font-semibold'
                            : 'text-slate-600'
                      }
                    >
                      {m.gapVsMedian > 0 ? '+' : ''}
                      {m.gapVsMedian}
                      {m.unit}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Cell({
  label,
  value,
  sub,
  accent,
}: {
  label: React.ReactNode;
  value: string;
  sub?: string;
  accent: 'rose' | 'amber' | 'emerald' | 'blue' | 'slate';
}) {
  const colors = {
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  } as const;
  return (
    <div className={`rounded-md border px-2 py-1.5 ${colors[accent]}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold opacity-70">{label}</p>
      <p className="text-base font-bold">{value}</p>
      {sub && <p className="text-[10px] truncate opacity-70">{sub}</p>}
    </div>
  );
}
