// frontend/src/components/VisibilityChart.tsx
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { TimelinePoint } from '../api/client';
import { TrendingUp, LineChart as LineIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
    timeline: TimelinePoint[];
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function VisibilityChart({ timeline }: Props) {
    if (timeline.length === 0) {
        return (
            <div className="glass rounded-[var(--radius-card)] p-6 flex items-center justify-center h-48 text-sm text-slate-400 gap-2">
                <LineIcon className="w-4 h-4 text-slate-300" />
                No scan data yet. Run a scan to see the chart.
            </div>
        );
    }

    const data = timeline.map((point) => ({
        date: formatDate(point.date),
        score: point.avgScore,
        mentionRate: point.mentionRate,
    }));

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
            className="glass rounded-[var(--radius-card)] p-6"
        >
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_4px_10px_-2px_rgba(59,130,246,0.4)]">
                            <TrendingUp className="w-4 h-4 text-white" />
                        </span>
                        Visibility over time
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 ml-10">Average score per scan</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Mention rate %
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Avg score
                    </span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
                    <defs>
                        <linearGradient id="grad-score" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="grad-mention" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                        contentStyle={{
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '12px',
                            boxShadow: '0 12px 32px -8px rgba(15, 23, 42, 0.18)',
                            background: 'rgba(255,255,255,0.96)',
                            backdropFilter: 'blur(8px)',
                        }}
                        cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }}
                    />
                    <ReferenceLine y={50} stroke="#e2e8f0" strokeDasharray="4 4" />
                    <Area
                        type="monotone"
                        dataKey="mentionRate"
                        name="Mention rate %"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#grad-mention)"
                        dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="score"
                        name="Avg score"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fill="url(#grad-score)"
                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </motion.div>
    );
}
