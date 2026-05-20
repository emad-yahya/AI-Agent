import { useEffect, useState } from 'react';
import { api, type SeoSiteScan } from '../api/client';
import { History, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatFirestoreDate } from '../lib/firestoreDate';

interface Props {
  siteId: string;
  refreshKey: number;
  onSelectScan: (scanId: string) => void;
  activeScanId: string | null;
}

export function SeoSiteHistory({ siteId, refreshKey, onSelectScan, activeScanId }: Props) {
  const [scans, setScans] = useState<SeoSiteScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listSeoSiteScans(siteId)
      .then((data) => {
        if (!cancelled) {
          setScans(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load scan history');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, refreshKey]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span className="text-sm text-gray-500">Loading scan history...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-400">{error}</div>;
  }

  if (scans.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
        No scans yet — click "Run scan" to start.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <History className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-800">Scan history ({scans.length})</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {scans.map((scan) => {
          const isActive = scan.id === activeScanId;
          const date = formatFirestoreDate(scan.createdAt);
          const ranked = scan.rankedCount ?? 0;
          const total = scan.totalKeywords ?? scan.keywords?.length ?? 0;
          const avg = scan.avgPosition;

          return (
            <button
              key={scan.id}
              onClick={() => onSelectScan(scan.id)}
              className={`w-full text-left px-5 py-3 transition-colors ${
                isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {scan.status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : scan.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                  )}
                  <span className="text-sm text-gray-700">{date}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {scan.status === 'done'
                    ? `${ranked}/${total} ranked${avg !== null && avg !== undefined ? ` · avg #${avg.toFixed(1)}` : ''}`
                    : scan.status}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
