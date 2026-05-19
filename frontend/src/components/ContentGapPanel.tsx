import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react';
import { api, type ContentGapReport, type ScanResult } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
  domain?: string;
  results?: ScanResult[];
}

const POLL_MS = 3500;
const MAX_POLLS = 80;

export function ContentGapPanel({ brand, domain, results }: Props) {
  const [domainInput, setDomainInput] = useState(domain ?? '');
  const [queriesInput, setQueriesInput] = useState('');
  const [competitorsInput, setCompetitorsInput] = useState('');
  const [country, setCountry] = useState('us');
  const [report, setReport] = useState<ContentGapReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Pre-fill queries from AI scan results' prompts
  useEffect(() => {
    if (queriesInput || !results || results.length === 0) return;
    const prompts = Array.from(
      new Set(results.map((r) => r.prompt).filter(Boolean)),
    ).slice(0, 8);
    if (prompts.length > 0) setQueriesInput(prompts.join('\n'));
  }, [results, queriesInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listContentGapReports(brand);
        if (!cancelled && list[0] && list[0].status === 'done') setReport(list[0]);
      } catch {
        // none yet
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [brand]);

  const start = async () => {
    const queries = queriesInput.split('\n').map((q) => q.trim()).filter(Boolean);
    if (!domainInput.trim() || queries.length === 0) {
      setError('Domain + at least one query required');
      return;
    }
    const competitorDomains = competitorsInput
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    setError(null);
    setLoading(true);
    setReport(null);
    try {
      const { reportId, brandId } = await api.createContentGapScan({
        brand,
        domain: domainInput.trim(),
        queries,
        competitorDomains,
        country,
      });
      let polls = 0;
      pollRef.current = window.setInterval(async () => {
        polls += 1;
        try {
          const r = await api.getContentGapReport(brandId, reportId);
          if (r.status === 'done' || r.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setReport(r);
            setLoading(false);
            if (r.status === 'failed') setError('Scan failed');
          }
        } catch {
          /* keep polling */
        }
        if (polls >= MAX_POLLS && pollRef.current) {
          clearInterval(pollRef.current);
          setError('Timed out');
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
        <Target className="text-violet-600" size={20} />
        <h3 className="font-bold text-slate-900">Content Gap Finder</h3>
      </div>
      <SectionIntro>
        <b>How it works:</b> for each query you list, we ask Google directly — which competitors rank, where you rank (if at all), People Also Ask suggestions, and an opportunity score (0–100) based on real SERP data. No LLM guesswork.
      </SectionIntro>

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder="Your domain (yourbrand.com)"
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={queriesInput}
          onChange={(e) => setQueriesInput(e.target.value)}
          placeholder="One query per line (e.g. 'best CRM for small business')"
          rows={5}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={competitorsInput}
            onChange={(e) => setCompetitorsInput(e.target.value)}
            placeholder="Competitor domains (optional, comma-sep)"
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="us">United States</option>
            <option value="ae">UAE</option>
            <option value="sa">Saudi Arabia</option>
            <option value="gb">UK</option>
            <option value="de">Germany</option>
            <option value="fr">France</option>
            <option value="in">India</option>
          </select>
        </div>
        <button
          onClick={start}
          disabled={loading}
          className="w-full bg-violet-600 text-white py-2.5 rounded-lg font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Scanning queries…' : 'Find Gaps'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      {report && report.status === 'done' && report.items && (
        <div className="mt-5 space-y-4">
          {report.summary && (
            <div className="grid grid-cols-4 gap-3 text-sm">
              <Box label="Queries" value={String(report.summary.totalQueries)} color="blue" />
              <Box label="You rank" value={String(report.summary.brandHasPageCount)} color="green" />
              <Box label="Gaps" value={String(report.summary.gapCount)} color="amber" />
              <Box label="Avg opportunity" value={`${report.summary.avgOpportunity}`} color="violet" />
            </div>
          )}
          <div className="space-y-2">
            {report.items
              .sort((a, b) => b.opportunityScore - a.opportunityScore)
              .map((it, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Search size={14} className="text-slate-400" />
                        <p className="font-medium text-sm text-slate-800">{it.query}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {it.brandHasPage ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 size={12} /> You rank #{it.brandPosition}
                          </span>
                        ) : (
                          <span className="text-red-600">No page found</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          it.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                          it.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{it.difficulty}</span>
                        <span className="text-violet-600 flex items-center gap-1">
                          <TrendingUp size={12} /> {it.opportunityScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  {it.competitorsRanking.length > 0 && (
                    <div className="mt-2 text-xs space-y-0.5">
                      <p className="text-slate-500">Competitors ranking:</p>
                      {it.competitorsRanking.slice(0, 3).map((c, ci) => (
                        <div key={ci} className="flex items-center gap-1.5">
                          <span className="text-slate-400">#{c.position}</span>
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5 truncate">
                            {c.domain} <ExternalLink size={10} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                  {it.paa && it.paa.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-slate-500">People Also Ask ({it.paa.length})</summary>
                      <ul className="mt-1 pl-4 list-disc text-slate-600 space-y-0.5">
                        {it.paa.map((q, qi) => <li key={qi}>{q}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Box({ label, value, color }: { label: string; value: string; color: 'blue' | 'green' | 'amber' | 'violet' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  return (
    <div className={`border rounded-lg p-3 ${colors[color]}`}>
      <p className="text-xs">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
