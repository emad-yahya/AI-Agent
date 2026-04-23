// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { api, type AnalyticsResponse, type Brand } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { StatCard } from '../components/StatCard';
import { VisibilityChart } from '../components/VisibilityChart';
import { EngineBreakdown } from '../components/EngineBreakdown';
import { Activity, Target, Percent, LayoutDashboard } from 'lucide-react';

export function Dashboard() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const { data, loading, error, run } = useAsync<AnalyticsResponse>();

  // load brand list on mount
  useEffect(() => {
    api.getBrands().then(b => {
      setBrands(b);
      if (b.length > 0) setSelectedBrand(b[0].name);
    });
  }, []);

  // load analytics whenever selected brand changes
  useEffect(() => {
    if (!selectedBrand) return;
    run(api.getAnalytics(selectedBrand));
  }, [selectedBrand]);

  return (
    <div className="flex flex-col gap-6">

      {/* Brand selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-700 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-gray-500" />
          Dashboard
        </h2>
        {brands.length > 0 && (
          <select
            value={selectedBrand}
            onChange={e => setSelectedBrand(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm
                       text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {brands.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        // <div className="text-center text-sm text-gray-400 py-12">
        //   Loading analytics...
        // </div>
        <div className='flex flex-col gap-4 animate-pulse'>
          <div className='flex flex-row gap-4 items-center justify-around'>
            {[1, 2, 3].map(i => (
              <div key={i} className='bg-gray-200 w-full rounded-xl border border-gray-200 p-6 h-36'></div>
            ))}
          </div>
          <div className='bg-gray-200 rounded-xl border border-gray-200 p-6 h-80'></div>
          <div className='bg-gray-200 rounded-xl border border-gray-200 p-6 h-50'></div>
        </div>
      )}

      {error && (
        <div className="text-center text-sm text-red-400 py-12">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Total scans"
              value={data.overall.totalScans}
              sub="completed scans"
              color="blue"
              icon={Activity}
            />
            <StatCard
              label="Avg visibility score"
              value={data.overall.avgScore}
              sub="out of 100"
              color="green"
              icon={Target}
            />
            <StatCard
              label="Mention rate"
              value={`${data.overall.mentionRate}%`}
              sub="of all AI responses"
              color="purple"
              icon={Percent}
            />
          </div>

          {/* Charts */}
          <VisibilityChart timeline={data.timeline} />
          <EngineBreakdown byEngine={data.byEngine} />
        </>
      )}

      {!loading && brands.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-12">
          No brands tracked yet. Run a scan first.
        </div>
      )}
    </div>
  );
}