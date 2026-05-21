import { useEffect, useState } from 'react';
import { api, type SeoSite } from '../api/client';
import { SeoTrendChart } from './SeoTrendChart';
import { Globe2, Loader2, Info } from 'lucide-react';

interface Props {
    brand: string;
}

export function BrandSeoTrend({ brand }: Props) {
    const [sites, setSites] = useState<SeoSite[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!brand) return;
        setLoading(true);
        api.listSeoSites(brand)
            .then((data) => {
                setSites(data);
                if (data.length > 0) setSelectedSiteId(data[0].id);
            })
            .catch(() => setSites([]))
            .finally(() => setLoading(false));
    }, [brand]);

    if (loading) {
        return (
            <div className="glass rounded-[var(--radius-card)] p-6 flex items-center justify-center h-48 text-sm text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading Google rank trend…
            </div>
        );
    }

    if (sites.length === 0) {
        return (
            <div className="glass rounded-[var(--radius-card)] p-6">
                <div className="flex items-center gap-2.5 mb-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_4px_10px_-2px_rgba(16,185,129,0.4)]">
                        <Globe2 className="w-4 h-4 text-white" />
                    </span>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">Google rank trend</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Position + coverage % over time</p>
                    </div>
                </div>
                <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                    <span>
                        No Google rank tracker site for <b>{brand}</b> yet. Run a <b>Master scan</b> with a domain — the system will create one automatically and start tracking your Google ranking weekly.
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {sites.length > 1 && (
                <div className="glass rounded-2xl px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Globe2 className="w-3.5 h-3.5 text-emerald-500" />
                        Tracking <b className="text-slate-800">{sites.length}</b> Google rank sites for {brand}
                    </div>
                    <select
                        value={selectedSiteId ?? ''}
                        onChange={(e) => setSelectedSiteId(e.target.value)}
                        className="border border-slate-200 rounded-xl px-3 py-1 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                    >
                        {sites.map((s) => (
                            <option key={s.id} value={s.id}>{s.domain} · {s.country}</option>
                        ))}
                    </select>
                </div>
            )}
            {selectedSiteId && <SeoTrendChart siteId={selectedSiteId} refreshKey={0} />}
        </div>
    );
}
