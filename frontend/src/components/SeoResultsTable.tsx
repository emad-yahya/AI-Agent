// frontend/src/components/SeoResultsTable.tsx
import { useEffect, useRef, useState } from 'react';
import { api, type SeoScan, type SeoResult } from '../api/client';
import { Loader2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  brandId: string;
  scanId: string;
  brand: string;
}

function PositionBadge({ position }: { position: number | null }) {
  if (position === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <XCircle className="w-3 h-3" /> Not found
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

function ResultRow({ result }: { result: SeoResult }) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">{result.keyword}</td>
      <td className="px-4 py-3">
        <PositionBadge position={result.position} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
        {result.title ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm">
        {result.url ? (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline flex items-center gap-1 max-w-[200px] truncate"
          >
            {result.url.replace(/^https?:\/\//, '').slice(0, 40)}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}

export function SeoResultsTable({ brandId, scanId, brand }: Props) {
  const [scan, setScan] = useState<SeoScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await api.getSeoScan(brandId, scanId);
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
    intervalRef.current = setInterval(() => void poll(), 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [brandId, scanId]);

  if (error) {
    return <div className="text-sm text-red-400 py-4">{error}</div>;
  }

  if (!scan || scan.status === 'running') {
    const done = scan?.results?.length ?? 0;
    const total = scan?.keywords?.length ?? 0;
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="text-sm text-gray-500">
          {total > 0 ? `Checking keyword ${done + 1} of ${total}...` : 'Running SEO scan...'}
        </span>
      </div>
    );
  }

  if (scan.status === 'failed') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-red-400">
        SEO scan failed. Check backend logs.
      </div>
    );
  }

  const results = scan.results ?? [];
  const found = results.filter((r) => r.found).length;
  const avgPosition = results.filter((r) => r.position !== null).reduce((s, r, _, a) => s + (r.position ?? 0) / a.length, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-800">
            SEO Results — {brand}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {found}/{results.length} keywords found in top 10
            {found > 0 && ` · avg position #${avgPosition.toFixed(1)}`}
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-gray-400">No results</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Keyword</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Position</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Page title</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">URL</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => <ResultRow key={r.keyword} result={r} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
