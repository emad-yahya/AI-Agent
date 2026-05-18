import { useEffect, useState } from 'react';
import { api, type SeoSite, type SeoCompareResponse } from '../api/client';
import { GitCompareArrows, Loader2, X } from 'lucide-react';
import { SectionIntro } from './Hint';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SeoCompareView({ open, onClose }: Props) {
  const [sites, setSites] = useState<SeoSite[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [data, setData] = useState<SeoCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api.listSeoSites().then(setSites).catch(() => undefined);
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  const handleCompare = async () => {
    if (selected.size < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.compareSeoSites([...selected]);
      setData(res);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message ?? e?.message ?? 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-blue-500" />
          Compare sites side-by-side
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <SectionIntro>
        Compare your site head-to-head with competitors (or your own other domains). Tick 2–4 sites. We'll show their latest scan side-by-side + a <b>keyword overlap table</b> — green positions = ranks well, gray dash = doesn't rank at all.
      </SectionIntro>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {sites.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-4">
            No sites tracked yet — add some first.
          </div>
        )}
        {sites.map((site) => {
          const checked = selected.has(site.id);
          return (
            <label
              key={site.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(site.id)}
                className="accent-blue-600"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{site.domain}</div>
                <div className="text-xs text-gray-400 truncate">
                  {site.brand} · {site.country.toUpperCase()}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => void handleCompare()}
          disabled={selected.size < 2 || loading}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm rounded-lg flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GitCompareArrows className="w-4 h-4" />
          )}
          Compare ({selected.size}/4)
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {data && data.sites.length > 0 && (
        <div className="border-t border-gray-100 pt-4 space-y-4">
          {/* Side-by-side summary cards */}
          <div className={`grid grid-cols-1 md:grid-cols-${Math.min(data.sites.length, 4)} gap-3`}>
            {data.sites.map(({ site, scan }) => (
              <div key={site.id} className="border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-400">{site.country.toUpperCase()}</div>
                <div className="text-sm font-medium text-gray-800 truncate">{site.domain}</div>
                {scan ? (
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <div>Keywords: <span className="font-medium">{scan.totalKeywords ?? 0}</span></div>
                    <div>Ranked: <span className="font-medium">{scan.rankedCount ?? 0}</span></div>
                    <div>
                      Avg position:{' '}
                      <span className="font-medium">
                        {scan.avgPosition !== null && scan.avgPosition !== undefined
                          ? `#${scan.avgPosition.toFixed(1)}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-400">No scans yet</div>
                )}
              </div>
            ))}
          </div>

          {/* Keyword overlap table */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-2">
              Keyword overlap ({data.keywordOverlap.length} keywords)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-3 font-medium text-gray-500 uppercase tracking-wide">
                      Keyword
                    </th>
                    {data.sites.map(({ site }) => (
                      <th
                        key={site.id}
                        className="text-center py-2 px-2 font-medium text-gray-500 uppercase tracking-wide"
                      >
                        {site.domain.split('.')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.keywordOverlap.slice(0, 25).map((row) => (
                    <tr key={row.keyword} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-1.5 pr-3 text-gray-700">{row.keyword}</td>
                      {data.sites.map(({ site }) => {
                        const pos = row.byDomain[site.domain];
                        return (
                          <td key={site.id} className="py-1.5 px-2 text-center">
                            {pos === null || pos === undefined ? (
                              <span className="text-gray-300">—</span>
                            ) : (
                              <span
                                className={
                                  pos <= 3
                                    ? 'text-green-600 font-medium'
                                    : pos <= 5
                                      ? 'text-yellow-600'
                                      : 'text-orange-600'
                                }
                              >
                                #{pos}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
