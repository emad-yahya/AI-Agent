import { ExternalLink, Loader2, Target, TrendingDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, type CompetitorGap, type ListicleGapScan, type ScanResult } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
  category: string;
  results: ScanResult[];
}

const POLL_INTERVAL_MS = 3500;
const MAX_POLLS = 80;

export function ListicleGapPanel({ brand, category, results }: Props) {
  const [scan, setScan] = useState<ListicleGapScan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Pre-fetch latest historical scan for this brand on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listListicleGapScans(brand);
        if (cancelled) return;
        const done = list.find((s) => s.status === 'done');
        if (done) setScan(done);
      } catch {
        // no-op — brand has no listicle scans yet
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [brand]);

  const competitors = Array.from(
    new Set(
      results
        .flatMap((r) => r.topics ?? [])
        .filter((t) => t.toLowerCase() !== brand.toLowerCase()),
    ),
  ).slice(0, 10);

  const startScan = async () => {
    setError(null);
    setLoading(true);
    try {
      const { scanId, brandId } = await api.createListicleGapScan(
        brand,
        category,
        competitors,
      );
      let polls = 0;
      pollRef.current = window.setInterval(async () => {
        polls += 1;
        try {
          const fresh = await api.getListicleGapScan(brandId, scanId);
          setScan(fresh);
          if (fresh.status !== 'running' || polls > MAX_POLLS) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            setLoading(false);
          }
        } catch {
          // transient — keep polling until max
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
      setLoading(false);
    }
  };

  const isRunning = loading || scan?.status === 'running';
  const gaps: CompetitorGap[] = scan?.competitorGaps ?? [];
  const topGaps = gaps.slice(0, 8);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <SectionIntro>
        Real article-level data. We search Google for "best {category}" style
        queries and scrape the top results to find <b>exactly which articles
        mention your competitors but not you</b>. This is the targeted PR /
        guest-post / outreach list — no LLM guessing, just verifiable URLs.
      </SectionIntro>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Target className="w-4 h-4 text-orange-500" />
          Listicle Gap Finder
          <span className="text-xs text-gray-400 font-normal">
            — articles where competitors win and you're missing
          </span>
        </h3>
        <button
          type="button"
          onClick={startScan}
          disabled={isRunning}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Scanning…
            </>
          ) : scan ? (
            'Re-run scan'
          ) : (
            'Run gap scan'
          )}
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {isRunning && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Querying Google, scraping ~50 articles, checking each for brand mentions. Takes 1–2 minutes.
        </div>
      )}

      {!scan && !isRunning && (
        <div className="text-xs text-slate-500 italic">
          Hit "Run gap scan" to discover real articles where {brand} should appear. Uses competitors detected in this scan.
        </div>
      )}

      {scan?.status === 'done' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Articles scanned" value={scan.totalArticles ?? 0} />
            <Stat
              label="Mention you"
              value={`${scan.brandMentionedCount ?? 0} (${scan.brandCoveragePercent ?? 0}%)`}
              tone={
                (scan.brandCoveragePercent ?? 0) >= 30
                  ? 'good'
                  : (scan.brandCoveragePercent ?? 0) >= 10
                    ? 'warn'
                    : 'bad'
              }
            />
            <Stat label="Competitors tracked" value={scan.competitors.length} />
          </div>

          {topGaps.length === 0 && (
            <p className="text-xs text-slate-500 italic">
              No competitor gaps found — either competitors are not mentioned in the scraped articles, or scan returned zero results.
            </p>
          )}

          <div className="space-y-3">
            {topGaps.map((gap) => (
              <details
                key={gap.competitor}
                className="border border-slate-200 rounded-lg overflow-hidden group"
              >
                <summary className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50/60 list-none">
                  <TrendingDown className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-800 truncate flex-1">
                    {gap.competitor}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">
                    {gap.gapArticles} gap{gap.gapArticles === 1 ? '' : 's'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {gap.brandAlsoMentioned}/{gap.totalArticles} articles also mention you
                  </span>
                </summary>
                <div className="bg-slate-50/50 border-t border-slate-200 px-3 py-2 space-y-1.5">
                  {gap.sampleArticles.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No sample articles captured.</p>
                  ) : (
                    gap.sampleArticles.map((a) => (
                      <a
                        key={a.url}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-slate-700 hover:text-orange-700 group/link"
                      >
                        <span className="font-medium text-slate-500 flex-shrink-0">{a.domain}</span>
                        <span className="truncate flex-1">{a.title || '(no title)'}</span>
                        <ExternalLink className="w-3 h-3 opacity-50 group-hover/link:opacity-100" />
                      </a>
                    ))
                  )}
                </div>
              </details>
            ))}
          </div>

          {scan.queries && scan.queries.length > 0 && (
            <details className="text-[11px] text-slate-400">
              <summary className="cursor-pointer hover:text-slate-600">
                Search queries used ({scan.queries.length})
              </summary>
              <ul className="mt-1.5 space-y-0.5 pl-3">
                {scan.queries.map((q) => (
                  <li key={q}>• {q}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
      : tone === 'warn'
        ? 'text-amber-700 bg-amber-50 border-amber-100'
        : tone === 'bad'
          ? 'text-rose-700 bg-rose-50 border-rose-100'
          : 'text-slate-700 bg-slate-50 border-slate-100';
  return (
    <div className={`rounded-lg border px-3 py-2 ${color}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}
