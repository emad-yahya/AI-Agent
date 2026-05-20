import { useEffect, useState } from 'react';
import { api, type SeoSite } from '../api/client';
import { Globe2, Loader2, Play } from 'lucide-react';

export function SeoSitesOverview() {
    const [sites, setSites] = useState<SeoSite[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState<string | null>(null);

    useEffect(() => {
        api.listSeoSites()
            .then((data) => setSites(data))
            .catch(() => setSites([]))
            .finally(() => setLoading(false));
    }, []);

    const runScan = async (siteId: string) => {
        setRunning(siteId);
        try {
            await api.runSeoSiteScan(siteId);
        } finally {
            setRunning(null);
        }
    };

    if (loading) {
        return (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading SEO sites...
                </div>
            </section>
        );
    }

    if (sites.length === 0) {
        return (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-2">
                    <Globe2 className="text-emerald-600" size={18} />
                    <h3 className="font-bold text-slate-900">Google rank tracker</h3>
                </div>
                <p className="text-sm text-slate-500">
                    No SEO sites yet. Run a Master scan with a domain to start tracking Google rankings.
                </p>
            </section>
        );
    }

    return (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <Globe2 className="text-emerald-600" size={18} />
                <h3 className="font-bold text-slate-900">Your tracked SEO sites</h3>
                <span className="text-xs text-slate-400">— {sites.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sites.map((site) => (
                    <div
                        key={site.id}
                        className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 hover:border-emerald-300 transition-colors"
                    >
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{site.brand}</div>
                            <div className="text-xs text-slate-500 truncate">{site.domain}</div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
                                {site.country} · {site.discoveredKeywords?.length ?? 0} keywords
                            </div>
                        </div>
                        <button
                            onClick={() => runScan(site.id)}
                            disabled={running === site.id}
                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 disabled:opacity-50"
                        >
                            {running === site.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Play className="w-3 h-3" />
                            )}
                            Re-scan
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}
