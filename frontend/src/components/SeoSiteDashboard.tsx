import { useEffect, useState } from 'react';
import { api, type SeoSite } from '../api/client';
import { Globe2, Loader2, Play, ChevronRight } from 'lucide-react';

interface Props {
  refreshKey: number;
  onRunScan: (siteId: string, scanId: string, brand: string, domain: string) => void;
  onSelectSite: (siteId: string) => void;
  activeSiteId: string | null;
}

export function SeoSiteDashboard({ refreshKey, onRunScan, onSelectSite, activeSiteId }: Props) {
  const [sites, setSites] = useState<SeoSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSite, setRunningSite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listSeoSites()
      .then((data) => {
        if (!cancelled) {
          setSites(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load sites');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleRun = async (site: SeoSite) => {
    setRunningSite(site.id);
    try {
      const { scanId } = await api.runSeoSiteScan(site.id);
      onRunScan(site.id, scanId, site.brand, site.domain);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message ?? 'Failed to start scan');
    } finally {
      setRunningSite(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="text-sm text-gray-500">Loading tracked sites...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center">
        <Globe2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No sites tracked yet — add your first website above.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-800">Tracked sites ({sites.length})</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {sites.map((site) => {
          const isActive = site.id === activeSiteId;
          const isRunning = runningSite === site.id;
          return (
            <div
              key={site.id}
              className={`px-5 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => onSelectSite(site.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Globe2 className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {site.domain}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {site.brand} · {site.country.toUpperCase()}
                    {site.lastScanAt && ` · last scan ${new Date(site.lastScanAt).toLocaleString()}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleRun(site);
                  }}
                  disabled={isRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      Run scan
                    </>
                  )}
                </button>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
