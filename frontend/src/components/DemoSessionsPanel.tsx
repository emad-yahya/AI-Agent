// frontend/src/components/DemoSessionsPanel.tsx
// Owner-only admin panel rendered in Settings → shows everyone who entered
// the public demo: when, from where (country + referrer), what browser/OS,
// how long they stayed, and which are still active right now.
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Users, Clock, Globe2, Activity, RefreshCw, Loader2, ExternalLink,
    TrendingUp, MonitorSmartphone,
} from 'lucide-react';
import {
    api,
    type DemoSessionRow,
    type DemoSessionsSummary,
} from '../api/client';

const COUNTRY_FLAGS: Record<string, string> = {
    AE: '🇦🇪', SA: '🇸🇦', US: '🇺🇸', GB: '🇬🇧', IN: '🇮🇳',
    EG: '🇪🇬', DE: '🇩🇪', FR: '🇫🇷', JO: '🇯🇴', SY: '🇸🇾',
    LB: '🇱🇧', KW: '🇰🇼', QA: '🇶🇦', BH: '🇧🇭', OM: '🇴🇲',
    TR: '🇹🇷', PK: '🇵🇰', BD: '🇧🇩', ID: '🇮🇩', MY: '🇲🇾',
    PH: '🇵🇭', SG: '🇸🇬', AU: '🇦🇺', CA: '🇨🇦', BR: '🇧🇷',
    MX: '🇲🇽', ES: '🇪🇸', IT: '🇮🇹', NL: '🇳🇱', RU: '🇷🇺',
};

function fmtDuration(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
}

function fmtRelative(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}

function fmtAbsolute(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function flag(code: string | null): string {
    if (!code) return '🌐';
    return COUNTRY_FLAGS[code.toUpperCase()] ?? '🌐';
}

interface StatCardProps {
    label: string;
    value: string | number;
    sub?: string;
    Icon: typeof Users;
    gradient: string;
}

function StatCard({ label, value, sub, Icon, gradient }: StatCardProps) {
    return (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
                {sub && (
                    <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">
                        {sub}
                    </span>
                )}
            </div>
            <div className="mt-3 text-[26px] font-bold text-slate-900 leading-none">{value}</div>
            <div className="mt-1 text-[12px] text-slate-500">{label}</div>
        </div>
    );
}

interface RankListProps {
    title: string;
    items: Array<{ key: string; count: number; icon?: string }>;
    total: number;
    Icon: typeof Users;
}

function RankList({ title, items, total, Icon }: RankListProps) {
    if (items.length === 0) {
        return (
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-slate-500" />
                    <h4 className="text-[13px] font-bold text-slate-800">{title}</h4>
                </div>
                <p className="text-[12px] text-slate-400">No data yet.</p>
            </div>
        );
    }
    return (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-slate-500" />
                <h4 className="text-[13px] font-bold text-slate-800">{title}</h4>
            </div>
            <ul className="space-y-2">
                {items.map((it) => {
                    const pct = total > 0 ? Math.round((it.count / total) * 100) : 0;
                    return (
                        <li key={it.key} className="text-[12px]">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-slate-700 truncate flex items-center gap-1.5">
                                    {it.icon && <span>{it.icon}</span>}
                                    <span className="truncate">{it.key}</span>
                                </span>
                                <span className="text-slate-500 font-mono shrink-0">
                                    {it.count} · {pct}%
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export function DemoSessionsPanel() {
    const [sessions, setSessions] = useState<DemoSessionRow[] | null>(null);
    const [summary, setSummary] = useState<DemoSessionsSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [list, sum] = await Promise.all([
                api.listDemoSessions(200),
                api.getDemoSessionsSummary(),
            ]);
            setSessions(list);
            setSummary(sum);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load demo sessions';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl bg-gradient-to-br from-slate-50 to-white ring-1 ring-slate-200 p-6 shadow-sm"
        >
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold text-slate-900">Demo visitors</h3>
                        <p className="text-[11.5px] text-slate-500">
                            Every entry into the public demo — when, from where, how long.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-[12px] font-semibold text-slate-700 disabled:opacity-60 transition"
                >
                    {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Refresh
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-50 ring-1 ring-red-200 px-3 py-2 text-[12px] text-red-700">
                    {error}
                </div>
            )}

            {/* Stat cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                    <StatCard
                        label="Total visits (all-time)"
                        value={summary.total}
                        Icon={Users}
                        gradient="from-indigo-500 to-violet-500"
                    />
                    <StatCard
                        label="Today"
                        value={summary.today}
                        sub="24h"
                        Icon={TrendingUp}
                        gradient="from-emerald-500 to-teal-500"
                    />
                    <StatCard
                        label="Last 7 days"
                        value={summary.last7d}
                        Icon={Clock}
                        gradient="from-cyan-500 to-blue-500"
                    />
                    <StatCard
                        label="Active now"
                        value={summary.active}
                        sub="live"
                        Icon={Activity}
                        gradient="from-fuchsia-500 to-pink-500"
                    />
                    <StatCard
                        label="Avg session"
                        value={fmtDuration(summary.avgDurationSec)}
                        Icon={Clock}
                        gradient="from-amber-500 to-orange-500"
                    />
                </div>
            )}

            {/* Rank lists */}
            {summary && (
                <div className="grid md:grid-cols-3 gap-3 mb-5">
                    <RankList
                        title="Top countries"
                        items={summary.topCountries.map((c) => ({
                            key: c.country,
                            count: c.count,
                            icon: flag(c.country),
                        }))}
                        total={summary.total}
                        Icon={Globe2}
                    />
                    <RankList
                        title="Top referrers"
                        items={summary.topReferrers.map((r) => ({
                            key: r.source,
                            count: r.count,
                        }))}
                        total={summary.total}
                        Icon={ExternalLink}
                    />
                    <RankList
                        title="Top browser / OS"
                        items={summary.topUas.map((u) => ({
                            key: u.ua,
                            count: u.count,
                        }))}
                        total={summary.total}
                        Icon={MonitorSmartphone}
                    />
                </div>
            )}

            {/* Sessions table */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="text-[12px] font-bold text-slate-800 uppercase tracking-wide">
                        Latest sessions
                    </h4>
                    <span className="text-[11px] text-slate-500 font-mono">
                        {sessions?.length ?? 0} shown
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                        <thead className="bg-white border-b border-slate-100">
                            <tr className="text-left text-slate-500 uppercase tracking-wide text-[10px]">
                                <th className="px-4 py-2 font-bold">When</th>
                                <th className="px-4 py-2 font-bold">Duration</th>
                                <th className="px-4 py-2 font-bold">Country</th>
                                <th className="px-4 py-2 font-bold">IP</th>
                                <th className="px-4 py-2 font-bold">Device</th>
                                <th className="px-4 py-2 font-bold">Referrer</th>
                                <th className="px-4 py-2 font-bold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sessions?.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        No demo visits yet. Share the View Demo link to start tracking.
                                    </td>
                                </tr>
                            )}
                            {sessions?.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-2.5">
                                        <div className="text-slate-800 font-medium">{fmtRelative(s.startedAt)}</div>
                                        <div className="text-[10.5px] text-slate-400">{fmtAbsolute(s.startedAt)}</div>
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-slate-700">
                                        {fmtDuration(s.durationSec)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="text-base leading-none">{flag(s.country)}</span>
                                            <span className="text-slate-700 font-medium">{s.country ?? 'Unknown'}</span>
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                                        {s.ip}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-700">
                                        {s.uaSummary}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={s.referrer ?? ''}>
                                        {s.referrer ?? <span className="text-slate-400">Direct</span>}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        {s.active ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[10.5px] font-bold">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="text-[10.5px] text-slate-400">Ended</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    );
}
