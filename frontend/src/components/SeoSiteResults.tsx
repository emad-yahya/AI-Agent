import { useEffect, useRef, useState } from 'react';
import { api, type SeoSiteScan, type SeoResult, type SerpFeature, type SeoAnomaly } from '../api/client';
import { Loader2, CheckCircle2, XCircle, Trophy, Sparkles, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { SeoExportButtons } from './SeoExportButtons';
import { Hint, SectionIntro } from './Hint';
import { formatFirestoreDate } from '../lib/firestoreDate';

interface Props {
  siteId: string;
  scanId: string;
  brand: string;
  domain: string;
}

const FEATURE_LABEL: Record<SerpFeature, string> = {
  featured_snippet: 'Featured Snippet',
  people_also_ask: 'People Also Ask',
  knowledge_panel: 'Knowledge Panel',
  images: 'Images',
  video: 'Video',
  shopping: 'Shopping',
  local_pack: 'Local Pack',
  ads_top: 'Ads (top)',
  ads_bottom: 'Ads (bottom)',
};

function PositionBadge({ position }: { position: number | null }) {
  if (position === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <XCircle className="w-3 h-3" /> Not in top 10
      </span>
    );
  }
  const color =
    position <= 3 ? 'bg-green-100 text-green-700' :
    position <= 5 ? 'bg-yellow-100 text-yellow-700' :
    'bg-orange-100 text-orange-700';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <CheckCircle2 className="w-3 h-3" /> #{position}
    </span>
  );
}

function AnomalyBanner({ anomalies }: { anomalies: SeoAnomaly[] }) {
  const high = anomalies.filter((a) => a.severity === 'high');
  const medium = anomalies.filter((a) => a.severity === 'medium');
  const positive = anomalies.filter((a) => a.severity === 'info');

  const tone =
    high.length > 0 ? 'red' : medium.length > 0 ? 'amber' : 'emerald';
  const styles: Record<string, string> = {
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  const Icon =
    tone === 'emerald' ? TrendingUp : tone === 'red' ? AlertTriangle : TrendingDown;

  return (
    <div className={`rounded-xl border p-4 ${styles[tone]}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="w-5 h-5 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="text-sm font-medium">
            {tone === 'red'
              ? 'Critical SEO changes vs last scan'
              : tone === 'amber'
                ? 'SEO changes vs last scan'
                : 'Positive SEO changes vs last scan'}
          </div>
          <ul className="text-xs space-y-1">
            {[...high, ...medium, ...positive].map((a, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span>• {a.message}</span>
                {a.keywords && a.keywords.length > 0 && (
                  <span className="ml-3 text-[11px] opacity-75">
                    keywords: {a.keywords.join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stage({
  label,
  done,
  active,
  detail,
  progress,
}: {
  label: string;
  done: boolean;
  active: boolean;
  detail: string;
  progress?: number;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : active ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${done ? 'text-gray-500' : active ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
          {label}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{detail}</div>
        {progress !== undefined && (
          <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string;
  value: string;
  hint?: string;
  tooltip?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400 flex items-center gap-1">
        {label}
        {tooltip && <Hint text={tooltip} />}
      </div>
      <div className="text-2xl font-semibold text-gray-800 mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function ResultRow({ result }: { result: SeoResult }) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 align-top">
      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">{result.keyword}</td>
      <td className="px-4 py-3">
        <PositionBadge position={result.position} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
        {result.title ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm">
        {(result.topCompetitors ?? []).slice(0, 3).map((c) => (
          <div key={c.url} className="text-xs text-gray-500 truncate max-w-[200px]">
            #{c.position} · {c.domain}
          </div>
        ))}
      </td>
      <td className="px-4 py-3 text-xs">
        {(result.serpFeatures ?? []).length === 0 ? (
          <span className="text-gray-400">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {(result.serpFeatures ?? []).map((f) => (
              <span key={f} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">
                {FEATURE_LABEL[f]}
              </span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

export function SeoSiteResults({ siteId, scanId, brand, domain }: Props) {
  const [scan, setScan] = useState<SeoSiteScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await api.getSeoSiteScan(siteId, scanId);
        setScan(data);
        if (data.status === 'done' || data.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load results');
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    };

    void poll();
    intervalRef.current = setInterval(() => void poll(), 2500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [siteId, scanId]);

  if (error) {
    return <div className="text-sm text-red-400 py-4">{error}</div>;
  }

  if (!scan || scan.status === 'running') {
    const done = scan?.results?.length ?? 0;
    const total = scan?.keywords?.length ?? 0;
    const stage1Done = total > 0;
    const stage2Done = stage1Done && done >= total;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <div>
            <h3 className="text-sm font-medium text-gray-800">Running SEO scan for {brand}</h3>
            <p className="text-xs text-gray-400">Target market: Google {scan?.country?.toUpperCase() ?? '...'}</p>
          </div>
        </div>

        <div className="space-y-3">
          <Stage
            label="Crawling website + extracting keywords"
            done={stage1Done}
            active={!stage1Done}
            detail={stage1Done ? `${total} keywords found` : 'Fetching homepage + inner pages...'}
          />
          <Stage
            label="Checking Google rankings"
            done={stage2Done}
            active={stage1Done && !stage2Done}
            detail={
              stage1Done
                ? stage2Done
                  ? `${total}/${total} checked`
                  : `${done}/${total} keywords checked (${progressPct}%)`
                : 'Waiting...'
            }
            progress={stage1Done && !stage2Done ? progressPct : undefined}
          />
          <Stage
            label="Detecting competitors + SERP features"
            done={false}
            active={stage2Done}
            detail={stage2Done ? 'Aggregating...' : 'Waiting...'}
          />
        </div>

        <p className="mt-4 text-xs text-gray-400">
          This usually takes 30–60 seconds. Free Serper.dev tier — counts toward your daily quota.
        </p>
      </div>
    );
  }

  if (scan.status === 'failed') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-red-400">
        Site scan failed. Possible reasons: site blocked the crawler, network timeout, or no keywords extracted. Check backend logs.
      </div>
    );
  }

  const results = scan.results ?? [];
  const ranked = results.filter((r) => r.found).length;
  const avgPosition = scan.avgPosition ?? null;
  const topCompetitors = Object.entries(scan.competitorMap ?? {}).slice(0, 5);
  const anomalies = scan.anomalies ?? [];

  return (
    <div className="space-y-4">
      {/* Export buttons */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {brand} · {domain} · scan from {formatFirestoreDate(scan.createdAt)}
        </div>
        <SeoExportButtons scan={scan} />
      </div>

      {/* Anomaly banner */}
      {anomalies.length > 0 && <AnomalyBanner anomalies={anomalies} />}

      <SectionIntro>
        We crawled your website, pulled the main keywords from your pages, then searched Google for each one. Below: how many keywords you rank for, your average position (1 = top result), and who beats you in the search results.
      </SectionIntro>

      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Keywords tracked"
          value={String(scan.totalKeywords ?? results.length)}
          tooltip="Auto-extracted from your homepage + linked pages (about, services, contact)."
        />
        <StatCard
          label="Ranked in top 10"
          value={String(ranked)}
          hint={`${results.length > 0 ? Math.round((ranked / results.length) * 100) : 0}% coverage`}
          tooltip="How many of your keywords appear in Google's first 10 results for the target country."
        />
        <StatCard
          label="Avg position"
          value={avgPosition !== null ? `#${avgPosition.toFixed(1)}` : '—'}
          hint={avgPosition !== null ? 'Lower is better' : 'No keywords ranked'}
          tooltip="Average rank across all your top-10 keywords. #1 = best. #10 = bottom of first page."
        />
        <StatCard
          label="Target market"
          value={scan.country.toUpperCase()}
          hint="Google country"
          tooltip="Country code used for Google search (gl parameter). Results vary by country."
        />
      </div>

      {/* Top Competitors */}
      {topCompetitors.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-800">Top SERP competitors</h3>
            <span className="text-xs text-gray-400">— domains that appear most often alongside {domain}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {topCompetitors.map(([d, count]) => (
              <div key={d} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-sm text-gray-700">{d}</span>
                <span className="text-xs text-gray-400">{count} keyword{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keywords table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              Keyword rankings — {brand}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {results.length} keywords auto-discovered from {domain}
            </p>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">No keywords extracted</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Keyword</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Your position</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Your page</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Top 3 competitors</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">SERP features</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => <ResultRow key={r.keyword} result={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
