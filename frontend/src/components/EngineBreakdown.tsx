// frontend/src/components/EngineBreakdown.tsx
import { BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

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
  'chatgpt-style': '#10b981',
  'gemini-style': '#3b82f6',
  'perplexity-style': '#a855f7',
};

const ENGINE_BG: Record<string, string> = {
  'chatgpt-style': 'from-emerald-500 to-teal-500',
  'gemini-style': 'from-blue-500 to-indigo-600',
  'perplexity-style': 'from-violet-500 to-fuchsia-600',
};

export function EngineBreakdown({ byEngine }: Props) {
  const data = Object.entries(byEngine).map(([engine, stats]) => ({
    engine,
    name: ENGINE_LABEL[engine] ?? engine,
    score: stats.avgScore,
    mentionRate: stats.mentionRate,
    color: ENGINE_COLOR[engine] ?? '#6b7280',
    bg: ENGINE_BG[engine] ?? 'from-slate-400 to-slate-600',
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="glass rounded-[var(--radius-card)] p-6"
    >
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-[0_4px_10px_-2px_rgba(168,85,247,0.4)]">
            <BarChart3 className="w-4 h-4 text-white" />
          </span>
          Score by engine
        </h3>
        <p className="text-xs text-slate-500 mt-1 ml-10">Average visibility score per AI engine</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.map((entry, i) => (
          <motion.div
            key={entry.engine}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
            whileHover={{ y: -2 }}
            className="relative rounded-2xl p-4 overflow-hidden border border-white/80 bg-white shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
          >
            <div className={`absolute -right-6 -top-6 w-20 h-20 rounded-full bg-gradient-to-br ${entry.bg} opacity-[0.10] blur-xl`} />
            <div className="relative flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r ${entry.bg} text-white`}>
                {entry.name}
              </span>
              <span className="text-2xl font-bold tracking-tight" style={{ color: entry.color }}>{entry.score}</span>
            </div>
            <div className="relative mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Avg score</span>
              <span className="font-semibold text-slate-700">{entry.mentionRate}% mentioned</span>
            </div>
            <div className="relative mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${entry.mentionRate}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full bg-gradient-to-r ${entry.bg}`}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
