import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { BrandComparisonResult } from '../api/client';

interface Props {
  results: BrandComparisonResult[];
}

const COLORS = ['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export function SovChart({ results }: Props) {
  const totalMentions = results.reduce((sum, r) => sum + r.stats.mentioned, 0);

  const data = results.map((r, i) => ({
    name: r.brand,
    mentions: r.stats.mentioned,
    sovPercent: totalMentions > 0 ? Math.round((r.stats.mentioned / totalMentions) * 100) : 0,
    color: COLORS[i % COLORS.length],
  }));

  if (totalMentions === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          Share of Voice
        </h3>
        <p className="text-xs text-gray-400 text-center py-8">
          No mentions found across all brands. Run a scan to see SOV data.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          Share of Voice
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          % of AI mentions captured vs competitors
        </p>
      </div>

      <div className="flex gap-6 items-center">
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="sovPercent"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value}%`, 'SOV']}
                contentStyle={{ border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left pb-2 font-medium">Brand</th>
                <th className="text-right pb-2 font-medium">Mentions</th>
                <th className="text-right pb-2 font-medium">SOV</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.name} className="border-t border-gray-50">
                  <td className="py-2 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-medium text-gray-700 truncate max-w-[100px]">{row.name}</span>
                  </td>
                  <td className="py-2 text-right text-gray-500">{row.mentions}</td>
                  <td className="py-2 text-right font-semibold" style={{ color: row.color }}>
                    {row.sovPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
