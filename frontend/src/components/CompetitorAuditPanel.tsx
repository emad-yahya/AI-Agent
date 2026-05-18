import { Bot, Check, ClipboardList, Loader2, Minus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  api,
  type CompetitorAuditScan,
  type ScanResult,
  type SiteAudit,
} from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
  results: ScanResult[];
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 80;

export function CompetitorAuditPanel({ brand, results }: Props) {
  const [brandDomain, setBrandDomain] = useState('');
  const [competitorsInput, setCompetitorsInput] = useState('');
  const [scan, setScan] = useState<CompetitorAuditScan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Pre-populate competitors from current scan's topics
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

  // Auto-load latest historical scan
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listCompetitorAudits(brand);
        if (cancelled) return;
        const done = list.find((s) => s.status === 'done');
        if (done) {
          setScan(done);
          if (done.brandDomain) setBrandDomain(done.brandDomain);
        }
      } catch {
        // no-op
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [brand]);

  const startScan = async () => {
    setError(null);
    if (!brandDomain.trim()) {
      setError('Enter your website domain first');
      return;
    }
    const competitors = competitorsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (competitors.length === 0) {
      setError('Add at least one competitor (name or domain)');
      return;
    }
    setLoading(true);
    try {
      const { scanId, brandId } = await api.createCompetitorAudit(
        brand,
        brandDomain.trim(),
        competitors,
      );
      let polls = 0;
      pollRef.current = window.setInterval(async () => {
        polls += 1;
        try {
          const fresh = await api.getCompetitorAudit(brandId, scanId);
          setScan(fresh);
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
      setError(err instanceof Error ? err.message : 'Failed to start audit');
      setLoading(false);
    }
  };

  const isRunning = loading || scan?.status === 'running';
  const brandAudit = scan?.brandAudit;
  const competitorAudits = scan?.competitorAudits ?? [];
  const allAudits: Array<{ audit: SiteAudit; isYou: boolean }> = brandAudit
    ? [
        { audit: brandAudit, isYou: true },
        ...competitorAudits.map((a) => ({ audit: a, isYou: false })),
      ]
    : competitorAudits.map((a) => ({ audit: a, isYou: false }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <SectionIntro>
        Real audit of your site vs each competitor: schemas (Organization, FAQ,
        Review, Breadcrumb, Article), <code>/llms.txt</code>, sitemap, and
        whether <code>robots.txt</code> allows AI crawlers (GPTBot, ClaudeBot,
        Google-Extended, PerplexityBot). Side-by-side scorecard shows what
        signals you're missing — every gap is a concrete fix.
      </SectionIntro>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-500" />
          Competitor Site Fingerprint
          <span className="text-xs text-gray-400 font-normal">
            — schema + AI-bot access audit
          </span>
        </h3>
        <button
          type="button"
          onClick={startScan}
          disabled={isRunning}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Auditing…
            </>
          ) : scan ? (
            'Re-run audit'
          ) : (
            'Run audit'
          )}
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em] mb-1.5 block">
            Your website
          </label>
          <input
            type="text"
            value={brandDomain}
            onChange={(e) => setBrandDomain(e.target.value)}
            placeholder="e.g. platinumsquare.ae"
            disabled={isRunning}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em] mb-1.5 block">
            Competitors (comma-separated, names or domains)
          </label>
          <input
            type="text"
            value={competitorsInput}
            onChange={(e) => setCompetitorsInput(e.target.value)}
            placeholder="bayut.com, Property Finder, Better Homes"
            disabled={isRunning}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 disabled:bg-slate-50"
          />
        </div>
      </div>

      {isRunning && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Resolving domains via Serper, then fetching homepage + robots.txt + llms.txt + sitemap.xml for each. Takes 30–90s.
        </div>
      )}

      {scan?.status === 'done' && allAudits.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allAudits.map(({ audit, isYou }) => (
              <ScoreCard key={audit.domain} audit={audit} isYou={isYou} />
            ))}
          </div>

          {scan.gapSummary && scan.gapSummary.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                Gap matrix — what you're missing vs competitors
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
                  {scan.gapSummary.map((row) => {
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
                            <span className="text-rose-700 font-semibold">⚠ Priority gap</span>
                          ) : row.yourStatus ? (
                            <span className="text-emerald-700">✓ You have it</span>
                          ) : (
                            <span className="text-slate-400">— optional</span>
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

      {!scan && !isRunning && (
        <p className="text-xs text-slate-500 italic">
          Hit "Run audit" to fetch and compare your site signals against competitors. We auto-fill competitors from your scan's Topics.
        </p>
      )}
    </div>
  );
}

function ScoreCard({ audit, isYou }: { audit: SiteAudit; isYou: boolean }) {
  const pct = Math.round((audit.score / audit.scoreOutOf) * 100);
  const tone =
    pct >= 70 ? 'emerald' : pct >= 40 ? 'amber' : 'rose';
  const borderColor = isYou ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200';
  const headerColor =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-rose-50 text-rose-700';
  const aiBotCount = Object.values(audit.aiBots).filter(Boolean).length;

  return (
    <div className={`border ${borderColor} rounded-lg overflow-hidden`}>
      <div className={`px-3 py-2 ${headerColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold truncate">{audit.domain}</span>
          {isYou && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500 text-white">
              You
            </span>
          )}
        </div>
        <span className="text-sm font-bold flex-shrink-0">
          {audit.score}/{audit.scoreOutOf}
        </span>
      </div>
      <div className="p-3 space-y-2">
        {audit.status === 'unreachable' ? (
          <p className="text-xs text-rose-600 italic">Site unreachable.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {audit.signals.map((s) => (
                <li key={s.key} className="flex items-start gap-1.5 text-[11px]">
                  {s.passed ? (
                    <Check className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Minus className="w-3 h-3 text-slate-300 mt-0.5 flex-shrink-0" />
                  )}
                  <span className={s.passed ? 'text-slate-700' : 'text-slate-400'}>
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 border-t border-slate-100 pt-1.5">
              <Bot className="w-3 h-3" />
              <span>
                AI bots: {aiBotCount}/8 allowed (GPTBot
                {audit.aiBots.GPTBot ? ' ✓' : ' ✗'}, ClaudeBot
                {audit.aiBots.ClaudeBot ? ' ✓' : ' ✗'})
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
