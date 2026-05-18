import { useEffect, useState } from 'react';
import { api, type ScanHistoryItem, type ScanResponse } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { ResultTable } from './ResultsTable';
import { History, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface Props {
  brand: string;
}

const STATUS_STYLE: Record<string, string> = {
  done: 'text-green-600 bg-green-50',
  failed: 'text-red-500 bg-red-50',
  running: 'text-yellow-600 bg-yellow-50',
};

export function ScanHistory({ brand }: Props) {
  const { data: scans, loading, run } = useAsync<ScanHistoryItem[]>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scanCache, setScanCache] = useState<Record<string, ScanResponse>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!brand) return;
    setActiveId(null);
    setScanCache({});
    run(api.listScans(brand));
  }, [brand]);

  const handleToggle = async (item: ScanHistoryItem) => {
    if (item.status !== 'done') return;
    if (activeId === item.scanId) { setActiveId(null); return; }

    setActiveId(item.scanId);

    if (!scanCache[item.scanId]) {
      setLoadingId(item.scanId);
      try {
        const result = await api.getScan(item.brandId, item.scanId);
        setScanCache(prev => ({ ...prev, [item.scanId]: result }));
      } finally {
        setLoadingId(null);
      }
    }
  };

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="h-4 bg-gray-100 rounded animate-pulse w-32 mb-4" />
      {[1, 2, 3].map(i => (
        <div key={i} className="h-10 bg-gray-50 rounded mb-2 animate-pulse" />
      ))}
    </div>
  );

  if (!scans || scans.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-gray-400" />
        Scan History
        <span className="text-xs text-gray-400 font-normal">({scans.length} scans)</span>
      </h3>

      <div className="flex flex-col gap-1">
        {scans.map(item => (
          <div key={item.scanId}>
            <button
              onClick={() => handleToggle(item)}
              disabled={item.status !== 'done'}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                text-sm transition-colors text-left
                ${item.status === 'done' ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-60'}
                ${activeId === item.scanId ? 'bg-gray-50' : ''}
              `}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[item.status] ?? ''}`}>
                  {item.status}
                </span>
                {item.anomaly && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium"
                    title={`Score dropped ${Math.abs(item.anomalyDelta)} pts vs average`}>
                    <AlertTriangle className="w-3 h-3" />
                    Anomaly ({item.anomalyDelta > 0 ? '+' : ''}{item.anomalyDelta} pts)
                  </span>
                )}
                <span className="text-gray-500 text-xs">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              {item.status === 'done' && (
                activeId === item.scanId
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {activeId === item.scanId && (
              <div className="mt-2 mb-2">
                {loadingId === item.scanId ? (
                  <div className="text-center text-xs text-gray-400 py-6">Loading results...</div>
                ) : scanCache[item.scanId] ? (
                  <ResultTable
                    results={scanCache[item.scanId].results}
                    stats={scanCache[item.scanId].stats}
                  />
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
