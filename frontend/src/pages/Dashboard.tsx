// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, type AnalyticsResponse, type Brand } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../auth/AuthContext';
import { StatCard } from '../components/StatCard';
import { EngineBreakdown } from '../components/EngineBreakdown';
import { Activity, Target, Percent, AlertCircle, Inbox } from 'lucide-react';
import { ScanHistory } from '../components/ScanHistory';
import { ScheduledScansPanel } from '../components/ScheduledScansPanel';
import { SeoSitesOverview } from '../components/SeoSitesOverview';
import { UnifiedVisibilityChart } from '../components/UnifiedVisibilityChart';
import { SectionIntro } from '../components/Hint';

export function Dashboard() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const { data, loading, error, run } = useAsync<AnalyticsResponse>();
  const { isDemo } = useAuth();

  useEffect(() => {
    api.getBrands().then((b) => {
      setBrands(b);
      if (b.length > 0) setSelectedBrand(b[0].name);
    });
  }, []);

  useEffect(() => {
    if (!selectedBrand) return;
    run(api.getAnalytics(selectedBrand));
  }, [selectedBrand]);

  return (
    <div className="flex flex-col gap-6">
      <SectionIntro>
        <b>How this works:</b> Pick a brand to see its <b>history over time</b> — total scans, trend lines, which AI engine likes you best, and every past scan. Below: turn on automatic scheduled scans to keep this data fresh.
      </SectionIntro>

      {brands.length > 0 && (
        <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 glow-dot" />
            Tracking <b className="text-slate-800">{brands.length}</b> brand{brands.length > 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Brand</span>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white
                         text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400
                         shadow-[var(--shadow-soft)] cursor-pointer transition-all hover:border-slate-300"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton rounded-[var(--radius-card)] h-32" />
            ))}
          </div>
          <div className="skeleton rounded-[var(--radius-card)] h-72" />
          <div className="skeleton rounded-[var(--radius-card)] h-48" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {data && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-6"
        >
          {(() => {
            const tl = data.timeline;
            const scoreDelta = tl.length >= 2 ? tl[tl.length - 1].avgScore - tl[tl.length - 2].avgScore : null;
            const mentionDelta = tl.length >= 2 ? tl[tl.length - 1].mentionRate - tl[tl.length - 2].mentionRate : null;
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Total scans"
                  value={data.overall.totalScans}
                  sub="completed scans"
                  color="cyan"
                  icon={Activity}
                  hint="Every time you (or the scheduler) ran a scan for this brand."
                />
                <StatCard
                  label="Avg visibility score"
                  value={data.overall.avgScore}
                  sub="out of 100"
                  color="green"
                  icon={Target}
                  delta={scoreDelta}
                  hint="Quality of mentions across all scans. Higher = AI engines feature you more prominently."
                />
                <StatCard
                  label="Mention rate"
                  value={`${data.overall.mentionRate}%`}
                  sub="of all AI responses"
                  color="pink"
                  icon={Percent}
                  delta={mentionDelta}
                  deltaUnit="%"
                  hint="What share of AI answers actually named your brand."
                />
              </div>
            );
          })()}

          <UnifiedVisibilityChart brand={selectedBrand} aiTimeline={data.timeline} />
          <EngineBreakdown byEngine={data.byEngine} />
          {!isDemo && <ScanHistory brand={selectedBrand} />}
          {!isDemo && <SeoSitesOverview />}
          {!isDemo && <ScheduledScansPanel />}
        </motion.div>
      )}

      {!loading && brands.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden flex flex-col items-center gap-4 py-20 text-center glass rounded-[var(--radius-card)]"
        >
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 opacity-[0.08] blur-3xl" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-[var(--shadow-glow-brand)]">
            <Inbox className="w-7 h-7 text-white" />
          </div>
          <div className="relative">
            <p className="text-base font-bold text-slate-900">No brands tracked yet</p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">Run your first scan from the <b>New scan</b> tab to start building history.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
