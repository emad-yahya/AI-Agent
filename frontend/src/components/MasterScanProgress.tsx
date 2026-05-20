import { motion } from 'framer-motion';
import { Check, Loader2, X, Minus } from 'lucide-react';
import {
    MODULE_LABELS,
    type MasterOrchestrationState,
    type ModuleKey,
    type ModuleStatus,
} from '../lib/masterOrchestrator';

const MODULE_ORDER: ModuleKey[] = [
    'brandPresence',
    'competitorAudit',
    'onPageSeo',
    'contentGap',
    'listicleGap',
    'seoSite',
];

export function MasterScanProgress({ state }: { state: MasterOrchestrationState }) {
    const total = MODULE_ORDER.length;
    const done = MODULE_ORDER.filter((k) => state.modules[k] === 'done').length;
    const failed = MODULE_ORDER.filter((k) => state.modules[k] === 'failed').length;
    const skipped = MODULE_ORDER.filter((k) => state.modules[k] === 'skipped').length;
    const running = MODULE_ORDER.filter((k) => state.modules[k] === 'running').length;
    const allFinished = done + failed + skipped === total;

    if (running === 0 && done === 0 && failed === 0 && skipped === 0) return null;

    const pct = ((done + failed + skipped) / total) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-br from-indigo-500/10 via-fuchsia-500/10 to-pink-500/10 border border-fuchsia-200/60 p-5"
        >
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        {!allFinished && <Loader2 className="w-4 h-4 animate-spin text-fuchsia-600" />}
                        Google diagnostics — {done}/{total} ready
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {allFinished
                            ? 'All modules finished. Switch to "Google Visibility" to see the data.'
                            : 'Running in background. You can already explore the Action Plan tab.'}
                    </p>
                </div>
                <span className="text-xs font-bold text-fuchsia-700">{Math.round(pct)}%</span>
            </div>

            <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden mb-4">
                <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4 }}
                />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {MODULE_ORDER.map((k) => (
                    <ModuleChip key={k} label={MODULE_LABELS[k]} status={state.modules[k]} error={state.errors[k]} />
                ))}
            </div>
        </motion.div>
    );
}

function ModuleChip({ label, status, error }: { label: string; status: ModuleStatus; error?: string }) {
    const config = STATUS_CONFIG[status];
    return (
        <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold border ${config.bg} ${config.text} ${config.border}`}
            title={error}
        >
            {config.Icon}
            <span className="truncate">{label}</span>
        </div>
    );
}

const STATUS_CONFIG: Record<ModuleStatus, { Icon: React.ReactNode; bg: string; text: string; border: string }> = {
    pending: { Icon: <span className="w-3 h-3 rounded-full bg-slate-300 shrink-0" />, bg: 'bg-white/60', text: 'text-slate-500', border: 'border-slate-200' },
    running: { Icon: <Loader2 className="w-3 h-3 animate-spin text-fuchsia-600 shrink-0" />, bg: 'bg-white', text: 'text-slate-800', border: 'border-fuchsia-300' },
    done: { Icon: <Check className="w-3 h-3 text-emerald-600 shrink-0" />, bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
    failed: { Icon: <X className="w-3 h-3 text-rose-600 shrink-0" />, bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
    skipped: { Icon: <Minus className="w-3 h-3 text-slate-400 shrink-0" />, bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
};
