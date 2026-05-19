import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Globe,
  Loader2,
  Zap,
} from 'lucide-react';
import { api, type OnPageSeoReport } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
  domain?: string;
}

const POLL_MS = 4000;
const MAX_POLLS = 60;

export function OnPageSeoPanel({ brand, domain }: Props) {
  const [domainInput, setDomainInput] = useState(domain ?? '');
  const [report, setReport] = useState<OnPageSeoReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listOnPageSeoReports(brand);
        if (!cancelled && list[0] && list[0].status === 'done') {
          setReport(list[0]);
        }
      } catch {
        // first scan — no reports yet
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [brand]);

  const startScan = async () => {
    if (!domainInput.trim()) {
      setError('Enter your site domain');
      return;
    }
    setError(null);
    setLoading(true);
    setReport(null);
    try {
      const { reportId, brandId } = await api.createOnPageSeoScan(
        brand,
        domainInput.trim(),
      );
      let polls = 0;
      pollRef.current = window.setInterval(async () => {
        polls += 1;
        try {
          const r = await api.getOnPageSeoReport(brandId, reportId);
          if (r.status === 'done' || r.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setReport(r);
            setLoading(false);
            if (r.status === 'failed') setError('Scan failed — see backend logs');
          }
        } catch (err) {
          if (polls >= MAX_POLLS) {
            if (pollRef.current) clearInterval(pollRef.current);
            setError((err as Error).message);
            setLoading(false);
          }
        }
        if (polls >= MAX_POLLS && pollRef.current) {
          clearInterval(pollRef.current);
          setError('Scan timed out');
          setLoading(false);
        }
      }, POLL_MS);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Gauge className="text-blue-600" size={20} />
        <h3 className="font-bold text-slate-900">On-Page SEO + Core Web Vitals</h3>
      </div>
      <SectionIntro>
        <b>What it checks:</b> crawls up to 5 pages — title length, meta description, H1 count, canonical, structured data, image alt coverage, word count, internal links — plus runs Google PageSpeed Insights (free) for LCP/CLS/INP and performance score.
      </SectionIntro>
      <div className="mt-4 flex gap-2 items-center">
        <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
          <Globe size={16} className="text-slate-400" />
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="yourbrand.com"
            className="flex-1 outline-none text-sm"
          />
        </div>
        <button
          onClick={startScan}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Scanning…' : 'Run Audit'}
        </button>
      </div>
      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}

      {report && report.status === 'done' && (
        <div className="mt-5 space-y-4">
          <SummaryRow report={report} />
          {report.topIssues && report.topIssues.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Top issues across pages</h4>
              <div className="space-y-1.5">
                {report.topIssues.slice(0, 6).map((i) => (
                  <div key={i.code} className="flex items-center gap-2 text-sm bg-slate-50 rounded px-3 py-2">
                    <SeverityIcon severity={i.severity} />
                    <span className="flex-1">{i.message}</span>
                    <span className="text-xs text-slate-500">{i.count}× pages</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {report.pages && report.pages.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Per-page audits</h4>
              <div className="space-y-3">
                {report.pages.map((p, i) => (
                  <details key={i} className="border rounded-lg p-3">
                    <summary className="cursor-pointer text-sm flex items-center justify-between">
                      <span className="truncate flex-1">{p.url}</span>
                      <ScoreBadge score={p.score} />
                    </summary>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Cell label="Title" value={p.title ? `${p.titleLength} chars` : '— missing'} bad={!p.title} />
                      <Cell label="Meta desc" value={p.metaDescription ? `${p.metaDescriptionLength} chars` : '— missing'} bad={!p.metaDescription} />
                      <Cell label="H1 count" value={String(p.h1Count)} bad={p.h1Count !== 1} />
                      <Cell label="Word count" value={String(p.wordCount)} bad={p.wordCount < 300} />
                      <Cell label="Internal links" value={String(p.internalLinkCount)} bad={p.internalLinkCount < 3} />
                      <Cell label="Image alts" value={`${p.imagesWithAltCount}/${p.imageCount}`} bad={p.imageCount > 0 && p.imagesWithAltCount / p.imageCount < 0.8} />
                      <Cell label="Canonical" value={p.canonical ? '✓' : '—'} bad={!p.canonical} />
                      <Cell label="Structured data" value={p.hasStructuredData ? '✓' : '—'} bad={!p.hasStructuredData} />
                    </div>
                    {p.issues.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs">
                        {p.issues.map((iss, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <SeverityIcon severity={iss.severity} small />
                            <span>{iss.message}{iss.fix && <span className="text-slate-500"> — {iss.fix}</span>}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                ))}
              </div>
            </div>
          )}
          {report.vitals && report.vitals.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Zap size={16} className="text-amber-500" />
                Core Web Vitals (mobile)
              </h4>
              {report.vitals.every((v) => !v.fetched || v.performanceScore === null) && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="font-semibold mb-1">⚠ PageSpeed data unavailable</p>
                  <p>
                    Free PSI quota is 25k/day with a key, much lower without one. Set
                    <code className="mx-1 px-1 py-0.5 bg-amber-100 rounded">GOOGLE_PSI_API_KEY</code>
                    in Railway env vars to lift the limit. Get a free key at{' '}
                    <a
                      href="https://developers.google.com/speed/docs/insights/v5/get-started#APIKey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold"
                    >
                      developers.google.com
                    </a>
                    .
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {report.vitals.map((v, i) => (
                  <div key={i} className="border rounded-lg p-3 text-sm">
                    <p className="truncate text-xs text-slate-500 mb-1">{v.url}</p>
                    {v.fetched ? (
                      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                        <Metric label="Perf" value={v.performanceScore !== null ? `${v.performanceScore}` : '—'} bad={v.performanceScore !== null && v.performanceScore < 50} />
                        <Metric label="LCP" value={v.lcp?.displayValue ?? '—'} />
                        <Metric label="CLS" value={v.cls?.displayValue ?? '—'} />
                        <Metric label="INP" value={v.inp?.displayValue ?? '—'} />
                        <Metric label="TBT" value={v.tbt?.displayValue ?? '—'} />
                        <Metric label="FCP" value={v.fcp?.displayValue ?? '—'} />
                        <Metric label="TTFB" value={v.ttfb?.displayValue ?? '—'} />
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600">PageSpeed unavailable: {v.fetchError}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SummaryRow({ report }: { report: OnPageSeoReport }) {
  const s = report.summary;
  if (!s) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Avg page score" value={`${s.avgScore}/100`} color={s.avgScore >= 70 ? 'green' : s.avgScore >= 50 ? 'amber' : 'red'} />
      <Stat label="Pages audited" value={String(s.pagesAudited)} color="blue" />
      <Stat label="Total issues" value={String(s.totalIssues)} color={s.totalIssues === 0 ? 'green' : 'amber'} />
      <Stat label="Avg performance" value={s.avgPerformance !== null ? `${s.avgPerformance}` : '—'} color={s.avgPerformance !== null && s.avgPerformance >= 70 ? 'green' : 'amber'} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: 'green' | 'amber' | 'red' | 'blue' }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <p className="text-xs">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-100 text-emerald-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded ${color}`}>{score}/100</span>;
}

function SeverityIcon({ severity, small }: { severity: 'critical' | 'high' | 'medium' | 'low'; small?: boolean }) {
  const size = small ? 12 : 14;
  if (severity === 'critical') return <AlertCircle size={size} className="text-red-600 flex-shrink-0" />;
  if (severity === 'high') return <AlertTriangle size={size} className="text-orange-500 flex-shrink-0" />;
  if (severity === 'medium') return <AlertTriangle size={size} className="text-amber-500 flex-shrink-0" />;
  return <CheckCircle2 size={size} className="text-slate-400 flex-shrink-0" />;
}

function Cell({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={`rounded px-2 py-1 ${bad ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-700'}`}>
      <span className="text-slate-500">{label}:</span> <span className="font-medium">{value}</span>
    </div>
  );
}

function Metric({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={`rounded px-2 py-1.5 text-center ${bad ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-700'}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}
