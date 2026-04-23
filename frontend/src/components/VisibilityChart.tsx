// frontend/src/components/VisibilityChart.tsx
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { TimelinePoint } from '../api/client';
import { TrendingUp } from 'lucide-react';

interface Props {
    timeline: TimelinePoint[];
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function VisibilityChart({ timeline }: Props) {
    if (timeline.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex
                      items-center justify-center h-48 text-sm text-gray-400">
                No scan data yet. Run a scan to see the chart.
            </div>
        );
    }

    const data = timeline.map(point => ({
        date: formatDate(point.date),
        score: point.avgScore,
        mentionRate: point.mentionRate,
    }));


    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        Visibility over time
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Average score per scan</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-green-400 inline-block rounded" />
                        Mention rate %
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />
                        Avg score
                    </span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '12px',
                        }}
                        formatter={(value, name) => [value, name]}
                        itemSorter={(item) => item.dataKey === 'mentionRate' ? 0 : 1}
                    />
                    <ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="4 4" />
                    <Line
                        type="linear"
                        dataKey="mentionRate"
                        name="Mention rate %"
                        stroke="#4ade80"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#4ade80', strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                    />
                    <Line
                        type="linear"
                        dataKey="score"
                        name="Avg score"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}