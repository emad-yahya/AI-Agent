// frontend/src/components/EngineBreakdown.tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface Props {
  byEngine: Record<string, {
    avgScore: number;
    mentionRate: number;
    totalCalls: number;
  }>;
}

const ENGINE_LABEL: Record<string, string> = {
  'chatgpt-style': 'ChatGPT',
  'gemini-style': 'Gemini',
  'perplexity-style': 'Perplexity',
};

const ENGINE_COLOR: Record<string, string> = {
  'chatgpt-style': '#10a37f',  // ChatGPT green
  'gemini-style': '#4285f4',  // Google blue
  'perplexity-style': '#6366f1',  // Perplexity purple
};

export function EngineBreakdown({ byEngine }: Props) {
  const data = Object.entries(byEngine).map(([engine, stats]) => ({
    engine,
    name: ENGINE_LABEL[engine] ?? engine,
    score: stats.avgScore,
    mentionRate: stats.mentionRate,
    color: ENGINE_COLOR[engine] ?? '#6b7280',
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          Score by engine
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Average visibility score per AI engine
        </p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="name"
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
            formatter={(value: number, name: string) => [value, name]}
          />
          <Bar dataKey="score" name="Avg score" radius={[6, 6, 0, 0]}>
            {data.map(entry => (
              <Cell key={entry.engine} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Engine stats table below the chart */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {data.map(entry => (
          <div
            key={entry.engine}
            className="rounded-lg p-3 text-center"
            style={{ backgroundColor: `${entry.color}10` }}
          >
            <div
              className="text-sm font-semibold"
              style={{ color: entry.color }}
            >
              {entry.score}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{entry.name}</div>
            <div className="text-xs text-gray-400">{entry.mentionRate}% mentioned</div>
          </div>
        ))}
      </div>
    </div>
  );
}