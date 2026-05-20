import { useEffect, useState } from 'react';
import { api, type SeoSiteScan } from '../api/client';
import { parseFirestoreDate } from '../lib/firestoreDate';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { TrendingUp, Loader2 } from 'lucide-react';

interface Props {
  siteId: string;
  refreshKey: number;
}

interface ChartPoint {
  date: string;
  fullDate: string;
  avgPosition: number | null;
  rankedCount: number;
  coveragePct: number;
}

export function SeoTrendChart({ siteId, refreshKey }: Props) {
  const [scans, setScans] = useState<SeoSiteScan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listSeoSiteScans(siteId)
      .then((data) => {
        if (!cancelled) {
          setScans(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, refreshKey]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span className="text-sm text-gray-500">Loading trend...</span>
      </div>
    );
  }

  const completed = scans.filter((s) => s.status === 'done');
  if (completed.length < 2) {
    return null;
  }

  const points: ChartPoint[] = completed
    .slice()
    .reverse()
    .map((s) => {
      const d = parseFirestoreDate(s.createdAt);
      const total = s.totalKeywords ?? s.keywords?.length ?? 0;
      const ranked = s.rankedCount ?? 0;
      return {
        date: d
          ? d.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : '—',
        fullDate: d ? d.toLocaleString() : '—',
        avgPosition: s.avgPosition ?? null,
        rankedCount: ranked,
        coveragePct: total > 0 ? Math.round((ranked / total) * 100) : 0,
      };
    });

  const latestPos = points[points.length - 1].avgPosition;
  const firstPos = points[0].avgPosition;
  const posDelta =
    latestPos !== null && firstPos !== null ? latestPos - firstPos : null;
  const trendDirection =
    posDelta === null ? 'flat' : posDelta < 0 ? 'up' : posDelta > 0 ? 'down' : 'flat';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Position trend
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Average Google ranking across all tracked keywords over time
          </p>
        </div>
        {posDelta !== null && (
          <div className="text-right">
            <div className="text-xs text-gray-400">vs first scan</div>
            <div
              className={`text-sm font-medium ${
                trendDirection === 'up'
                  ? 'text-green-600'
                  : trendDirection === 'down'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}
            >
              {posDelta < 0 ? '↑ improved ' : posDelta > 0 ? '↓ dropped ' : '→ stable '}
              {Math.abs(posDelta).toFixed(1)} positions
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis
            yAxisId="left"
            reversed
            domain={[1, 10]}
            ticks={[1, 3, 5, 10]}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            label={{
              value: 'Avg position (lower = better)',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              style: { fontSize: 10, fill: '#9ca3af' },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            label={{
              value: 'Coverage %',
              angle: 90,
              position: 'insideRight',
              offset: 10,
              style: { fontSize: 10, fill: '#9ca3af' },
            }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine yAxisId="left" y={3} stroke="#10b981" strokeDasharray="3 3" />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="avgPosition"
            name="Avg position"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3b82f6' }}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="coveragePct"
            name="Coverage %"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={{ r: 2, fill: '#a78bfa' }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 mt-2">
        Position 1–3 (above green line) = first-page top results.
      </p>
    </div>
  );
}
