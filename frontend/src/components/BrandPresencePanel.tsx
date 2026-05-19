import {
  BookOpen,
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Minus,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  api,
  type BrandPresenceCheck,
  type BrandPresenceReport,
  type ScanResult,
} from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
  results: ScanResult[];
}

const POLL_INTERVAL_MS = 3500;
const MAX_POLLS = 60;

export function BrandPresencePanel({ brand, results }: Props) {
  const [competitorsInput, setCompetitorsInput] = useState('');
  const [report, setReport] = useState<BrandPresenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Pre-fill competitors from scan topics
  useEffect(() => {
    if (competitorsInput) return;
    const competitors = Array.from(
      new Set(
        results
          .flatMap((r) => r.topics ?? [])
          .filter((t) => t.toLowerCase() !== brand.toLowerCase()),
      ),
    ).slice(0, 5);
    if (competitors.length > 0) setCompetitorsInput(competitors.join(', '));
  }, [results, brand, competitorsInput]);

  // Auto-load latest
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listBrandPresenceReports(brand);
        if (cancelled) return;
        const done = list.find((r) => r.status === 'done');
        if (done) setReport(done);
      } catch {
        // no-op
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [brand]);

  const startCheck = async () => {
    setError(null);
    const competitors = competitorsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (competitors.length === 0) {
      setError('Add at least one competitor brand name');
      return;
    }
    setLoading(true);
    try {
      const { reportId, brandId } = await api.createBrandPresenceCheck(
        brand,
        competitors,
      );
      let polls = 0;
      pollRef.current = window.setInterval(async () => {
        polls += 1;
        try {
          const fresh = await api.getBrandPresenceReport(brandId, reportId);
          setReport(fresh);
          if (fresh.status !== 'running' || polls > MAX_POLLS) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            setLoading(false);
          }
        } catch {
          // transient
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start check');
      setLoading(false);
    }
  };

  const isRunning = loading || report?.status === 'running';
  const brandCheck = report?.brandCheck;
  const competitorChecks = report?.competitorChecks ?? [];
  const allChecks: Array<{ check: BrandPresenceCheck; isYou: boolean }> = brandCheck
    ? [
        { check: brandCheck, isYou: true },
        ...competitorChecks.map((c) => ({ check: c, isYou: false })),
      ]
    : competitorChecks.map((c) => ({ check: c, isYou: false }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <SectionIntro>
        Real-data check of two high-leverage AI signals: <b>Google Knowledge
        Panel</b> (Gemini relies on it heavily) and <b>Wikipedia article</b>
        (heavily weighted in ChatGPT's training data). Missing both while
        competitors have them = direct visibility gap.
      </SectionIntro>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-500" />
          Brand Presence Check
          <span className="text-xs text-gray-400 font-normal">
            — Knowledge Panel + Wikipedia
          </span>
        </h3>
        <button
          type="button"
          onClick={startCheck}
          disabled={isRunning}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Checking…
            </>
          ) : report ? (
            'Re-run check'
          ) : (
            'Run check'
          )}
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em] mb-1.5 block">
          Competitors (brand names, comma-separated)
        </label>
        <input
          type="text"
          value={competitorsInput}
          onChange={(e) => setCompetitorsInput(e.target.value)}
          placeholder="Bayut, Property Finder, Better Homes"
          disabled={isRunning}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 disabled:bg-slate-50"
        />
      </div>

      {isRunning && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Querying Google + Wikipedia for each brand. Takes ~20–30s.
        </div>
      )}

      {report?.status === 'done' && allChecks.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allChecks.map(({ check, isYou }) => (
              <PresenceCard key={check.name} check={check} isYou={isYou} />
            ))}
          </div>

          {report.gapSummary && report.gapSummary.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                Presence gap — what you're missing vs competitors
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50/60 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Signal</th>
                    <th className="text-center px-3 py-2 font-semibold text-slate-600 w-20">You</th>
                    <th className="text-center px-3 py-2 font-semibold text-slate-600 w-32">Competitors</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.gapSummary.map((row) => {
                    const isGap = !row.yourStatus && row.competitorsWithIt > 0;
                    return (
                      <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50/40">
                        <td className="px-3 py-2 text-slate-700">{row.label}</td>
                        <td className="text-center px-3 py-2">
                          {row.yourStatus ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 inline-block" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-rose-500 inline-block" />
                          )}
                        </td>
                        <td className="text-center px-3 py-2 text-slate-600">
                          {row.competitorsWithIt}/{row.totalCompetitors}
                        </td>
                        <td className="px-3 py-2">
                          {isGap ? (
                            <span className="text-rose-700 font-semibold">⚠ Critical GEO gap</span>
                          ) : row.yourStatus ? (
                            <span className="text-emerald-700">✓ You have it</span>
                          ) : (
                            <span className="text-slate-400">— no one has it</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!report && !isRunning && (
        <p className="text-xs text-slate-500 italic">
          Hit "Run check" to see which competitors have Knowledge Panels and Wikipedia pages — these are the two strongest AI-recognition signals.
        </p>
      )}
    </div>
  );
}

function PresenceCard({
  check,
  isYou,
}: {
  check: BrandPresenceCheck;
  isYou: boolean;
}) {
  const pct = Math.round((check.presenceScore / 2) * 100);
  const tone = pct === 100 ? 'emerald' : pct === 50 ? 'amber' : 'rose';
  const borderColor = isYou ? 'border-cyan-300 ring-2 ring-cyan-100' : 'border-slate-200';
  const headerColor =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-rose-50 text-rose-700';

  return (
    <div className={`border ${borderColor} rounded-lg overflow-hidden`}>
      <div className={`px-3 py-2 ${headerColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold truncate">{check.name}</span>
          {isYou && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500 text-white">
              You
            </span>
          )}
        </div>
        <span className="text-sm font-bold flex-shrink-0">{check.presenceScore}/2</span>
      </div>
      <div className="p-3 space-y-2 text-[11px]">
        <div className="flex items-start gap-1.5">
          {check.hasKnowledgePanel ? (
            <Check className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
          ) : (
            <Minus className="w-3 h-3 text-slate-300 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <span className={check.hasKnowledgePanel ? 'text-slate-700 font-medium' : 'text-slate-400'}>
              Knowledge Panel
            </span>
            {check.knowledgePanelTitle && (
              <div className="text-slate-500 truncate">{check.knowledgePanelTitle}</div>
            )}
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          {check.hasWikipedia ? (
            <Check className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
          ) : (
            <Minus className="w-3 h-3 text-slate-300 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <span className={check.hasWikipedia ? 'text-slate-700 font-medium' : 'text-slate-400'}>
              Wikipedia
            </span>
            {check.wikipediaUrl && (
              <a
                href={check.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-700 hover:text-cyan-800 inline-flex items-center gap-1 ml-1"
              >
                <BookOpen className="w-2.5 h-2.5" />
                Open
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
