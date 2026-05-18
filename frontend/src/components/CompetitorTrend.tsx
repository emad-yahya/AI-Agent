import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Plus, X } from 'lucide-react';
import { api, type CompetitorTrend } from '../api/client';
import { useAsync } from '../hooks/useAsync';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short',
  });
}

export function CompetitorTrendChart() {
  const [brands, setBrands] = useState<string[]>(['']);
  const { data, loading, error, run } = useAsync<CompetitorTrend[]>();

  const addBrand = () => {
    if (brands.length < 4) setBrands((b) => [...b, '']);
  };

  const removeBrand = (i: number) => setBrands((b) => b.filter((_, idx) => idx !== i));

  const updateBrand = (i: number, val: string) =>
    setBrands((b) => b.map((v, idx) => (idx === i ? val : v)));

  const handleTrack = () => {
    const valid = brands.map((b) => b.trim()).filter(Boolean);
    if (valid.length < 2) return;
    run(api.getCompetitorTrends(valid));
  };

  const chartData = (() => {
    if (!data) return [];
    const dateSet = new Set<string>();
    for (const brand of data) {
      for (const pt of brand.timeline) dateSet.add(pt.date);
    }
    return Array.from(dateSet)
      .sort()
      .map((date) => {
        const row: Record<string, string | number> = { date: formatDate(date) };
        for (const brand of data) {
          const pt = brand.timeline.find((p) => p.date === date);
          row[brand.name] = pt?.avgScore ?? 0;
        }
        return row;
      });
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-blue-500" />
        Competitor Score Trends
      </h3>

      <div className="flex flex-col gap-3 mb-4">
        {brands.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <input
              value={b}
              onChange={(e) => updateBrand(i, e.target.value)}
              placeholder={`Brand ${i + 1}`}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {brands.length > 2 && (
              <button onClick={() => removeBrand(i)} className="text-gray-400 hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        <div className="flex gap-2">
          {brands.length < 4 && (
            <button
              onClick={addBrand}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add brand
            </button>
          )}
          <button
            onClick={handleTrack}
            disabled={loading || brands.filter((b) => b.trim()).length < 2}
            className="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium
              disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {loading ? 'Loading...' : 'Track trends'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 mb-3">{error}</p>
      )}

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {data!.map((brand, i) => (
              <Line
                key={brand.name}
                type="linear"
                dataKey={brand.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: COLORS[i % COLORS.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {data && chartData.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-8">
          No scan history found for these brands. Run scans first.
        </p>
      )}
    </div>
  );
}
