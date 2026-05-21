import { useEffect, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { api, type TimelinePoint, type SeoSite, type SeoSiteScan } from '../api/client';
import { parseFirestoreDate } from '../lib/firestoreDate';

interface Props {
    brand: string;
    aiTimeline: TimelinePoint[];
}

interface MergedPoint {
    day: string;            // YYYY-MM-DD bucket key
    label: string;          // short human label "20 May"
    fullDate: string;       // full date for tooltip
    aiScore: number | null;
    aiMention: number | null;
    googleCoverage: number | null;
    googleAvgPos: number | null;
}

function dayKey(d: Date | null): string | null {
    if (!d) return null;
    return d.toISOString().slice(0, 10);
}

function shortLabel(key: string): string {
    const d = new Date(key + 'T00:00:00');
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function UnifiedVisibilityChart({ brand, aiTimeline }: Props) {
    const [seoScans, setSeoScans] = useState<SeoSiteScan[]>([]);
    const [seoLoading, setSeoLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!brand) return;
        let cancelled = false;
        setSeoLoading(true);
        (async () => {
            try {
                const sites: SeoSite[] = await api.listSeoSites(brand);
                if (sites.length === 0) {
                    if (!cancelled) setSeoScans([]);
                    return;
                }
                // Pull scans for every site for this brand, then merge
                const all = await Promise.all(
                    sites.map((s) => api.listSeoSiteScans(s.id).catch(() => [])),
                );
                if (!cancelled) setSeoScans(all.flat());
            } finally {
                if (!cancelled) setSeoLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [brand, reloadKey]);

    // Build day-bucketed merged series
    const buckets = new Map<string, MergedPoint>();

    for (const p of aiTimeline) {
        const d = parseFirestoreDate(p.date);
        const k = dayKey(d);
        if (!k) continue;
        const prev = buckets.get(k);
        if (prev) {
            // Average if multiple AI scans same day
            prev.aiScore = avg(prev.aiScore, p.avgScore);
            prev.aiMention = avg(prev.aiMention, p.mentionRate);
        } else {
            buckets.set(k, {
                day: k,
                label: shortLabel(k),
                fullDate: d!.toLocaleString(),
                aiScore: p.avgScore,
                aiMention: p.mentionRate,
                googleCoverage: null,
                googleAvgPos: null,
            });
        }
    }

    for (const s of seoScans) {
        if (s.status !== 'done') continue;
        const d = parseFirestoreDate(s.createdAt);
        const k = dayKey(d);
        if (!k) continue;
        const ranked = s.rankedCount ?? 0;
        const total = s.totalKeywords ?? s.keywords?.length ?? 0;
        const cov = total > 0 ? Math.round((ranked / total) * 100) : 0;
        const prev = buckets.get(k);
        if (prev) {
            prev.googleCoverage = prev.googleCoverage === null ? cov : Math.round((prev.googleCoverage + cov) / 2);
            prev.googleAvgPos = s.avgPosition ?? prev.googleAvgPos;
        } else {
            buckets.set(k, {
                day: k,
                label: shortLabel(k),
                fullDate: d!.toLocaleString(),
                aiScore: null,
                aiMention: null,
                googleCoverage: cov,
                googleAvgPos: s.avgPosition ?? null,
            });
        }
    }

    const series = [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day));
    const aiPoints = series.filter((p) => p.aiMention !== null).length;
    const googlePoints = series.filter((p) => p.googleCoverage !== null).length;
    const doneSeoScans = seoScans.filter((s) => s.status === 'done').length;

    const isLoading = seoLoading;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
            className="glass rounded-[var(--radius-card)] p-6"
        >
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-[0_4px_10px_-2px_rgba(217,70,239,0.4)]">
                            <TrendingUp className="w-4 h-4 text-white" />
                        </span>
                        Brand visibility over time — AI &amp; Google
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 ml-10">
                        Each point = one scan day. Compare how {brand} evolves in AI answers and Google rankings side-by-side.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" /> AI mention %
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Google coverage %
                    </span>
                    <button
                        onClick={() => setReloadKey((k) => k + 1)}
                        title="Refresh Google data"
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                    >
                        <RefreshCw className={`w-3 h-3 ${seoLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center h-64 text-sm text-slate-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading Google data…
                </div>
            )}

            {!isLoading && series.length === 0 && (
                <div className="flex items-center justify-center h-64 text-sm text-slate-400">
                    No scan data yet. Run a Master scan to start tracking.
                </div>
            )}

            {!isLoading && series.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={series} margin={{ top: 8, right: 16, bottom: 4, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 6" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: '%', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 10 } }}
                        />
                        <Tooltip
                            contentStyle={{
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '12px',
                                boxShadow: '0 12px 32px -8px rgba(15, 23, 42, 0.18)',
                                background: 'rgba(255,255,255,0.96)',
                                backdropFilter: 'blur(8px)',
                            }}
                            labelFormatter={(_, payload) => {
                                if (payload && payload.length > 0) {
                                    const p = payload[0].payload as MergedPoint;
                                    return p.fullDate;
                                }
                                return '';
                            }}
                            formatter={(value: unknown, name: unknown) => {
                                const label = String(name);
                                if (value === null || value === undefined) return ['—', label];
                                return [`${Math.round(Number(value))}%`, label];
                            }}
                            cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                            iconType="circle"
                        />
                        <ReferenceLine y={50} stroke="#e2e8f0" strokeDasharray="4 4" />
                        <Line
                            type="monotone"
                            dataKey="aiMention"
                            name="AI mention %"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="googleCoverage"
                            name="Google coverage %"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }}
                            connectNulls
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}

            {!isLoading && series.length > 0 && (
                <>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                        <div className="flex items-start gap-1.5 bg-indigo-50/50 rounded-lg p-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                            <span><b className="text-indigo-700">AI mention %</b> ({aiPoints} day{aiPoints === 1 ? '' : 's'}) — out of all questions asked to ChatGPT/Gemini/Perplexity, how many named your brand.</span>
                        </div>
                        <div className="flex items-start gap-1.5 bg-emerald-50/50 rounded-lg p-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                            <span><b className="text-emerald-700">Google coverage %</b> ({googlePoints} day{googlePoints === 1 ? '' : 's'}) — out of all tracked keywords, how many your site ranks for in top 10.</span>
                        </div>
                    </div>
                    {googlePoints === 0 && (
                        <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            No completed Google scans yet for this brand ({doneSeoScans} done of {seoScans.length} total). Run a Master scan or open the Google sub-tab and click <b>Re-scan</b>, then hit the refresh icon above.
                        </div>
                    )}
                </>
            )}
        </motion.div>
    );
}

function avg(a: number | null, b: number | null): number | null {
    if (a === null && b === null) return null;
    if (a === null) return b;
    if (b === null) return a;
    return (a + b) / 2;
}
