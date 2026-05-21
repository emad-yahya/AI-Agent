import type { ScanResult } from "../api/client";
import { Check, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Hint, SectionIntro } from './Hint';

interface Props {
    results: ScanResult[];
    stats: {
        total: number;
        mentioned: number;
        mentionRate: number;
        avgScore: number;
        realTotal?: number;
        realMentioned?: number;
        realMentionRate?: number;
        realAvgScore?: number;
        echoTotal?: number;
        echoMentioned?: number;
        echoMentionRate?: number;
        echoAvgScore?: number;
    };
}

const ENGINE_LABEL: Record<string, string> = {
    'chatgpt-style': 'ChatGPT',
    'gemini-style': 'Gemini',
    'perplexity-style': 'Perplexity',
};

const ENGINE_PILL: Record<string, string> = {
    'chatgpt-style': 'text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_10px_-2px_rgba(16,185,129,0.4)]',
    'gemini-style': 'text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-[0_4px_10px_-2px_rgba(59,130,246,0.4)]',
    'perplexity-style': 'text-white bg-gradient-to-r from-violet-500 to-fuchsia-600 shadow-[0_4px_10px_-2px_rgba(168,85,247,0.4)]',
};

const SENTIMENT_COLOR: Record<string, string> = {
    positive: 'text-emerald-700 bg-emerald-50 ring-emerald-200',
    neutral: 'text-slate-600 bg-slate-100 ring-slate-200',
    negative: 'text-rose-700 bg-rose-50 ring-rose-200',
};

const STAT_TIPS: Record<string, string> = {
    'Total calls': 'How many questions we sent to AI engines this scan (engines × prompts).',
    'Mentioned': 'How many of those answers actually included your brand name.',
    'Mention rate': '% of answers that mentioned you — the higher, the more visible you are in AI search.',
    'Avg score': 'Quality score (0–100) for the answers that DID mention you. Combines ranking position + sentiment.',
    'Real visibility': 'Mention rate on UNBIASED prompts — questions that never name your brand. This is the metric that proves AI engines truly know you.',
    'Echo rate': 'Mention rate on BRAND-CUE prompts (e.g. "Besides {brand}…", "How is {brand}?"). The LLM is being prompted with your name, so a hit only means it can talk about you when asked, not that it surfaces you spontaneously.',
    'Mention rate (combined)': 'Real + Echo combined. Use Real visibility for the truer signal.',
    'Avg score (when mentioned)': 'Quality score (0–100) for answers that DID mention you. Combines ranking position + sentiment.',
};

const STAT_COLORS: Record<string, string> = {
    'Total calls': 'from-slate-500 to-slate-700',
    'Mentioned': 'from-blue-500 to-indigo-600',
    'Mention rate': 'from-emerald-500 to-teal-500',
    'Mention rate (combined)': 'from-emerald-500 to-teal-500',
    'Avg score': 'from-violet-500 to-fuchsia-500',
    'Avg score (when mentioned)': 'from-violet-500 to-fuchsia-500',
    'Real visibility': 'from-emerald-500 to-teal-500',
    'Echo rate': 'from-amber-500 to-orange-500',
};

export function ResultTable({ results, stats }: Props) {
    if (!results || !stats) return null;

    const hasSplit =
        stats.realTotal !== undefined && stats.realTotal > 0 &&
        stats.echoTotal !== undefined && stats.echoTotal > 0;

    const statRows = hasSplit
        ? [
              {
                  label: 'Real visibility',
                  value: `${stats.realMentionRate ?? 0}%`,
                  caption: `${stats.realMentioned ?? 0} of ${stats.realTotal ?? 0} unbiased prompts mentioned you`,
              },
              {
                  label: 'Echo rate',
                  value: `${stats.echoMentionRate ?? 0}%`,
                  caption: `${stats.echoMentioned ?? 0} of ${stats.echoTotal ?? 0} brand-named prompts mentioned you`,
              },
              {
                  label: 'Mention rate (combined)',
                  value: `${stats.mentionRate}%`,
                  caption: `${stats.mentioned} of ${stats.total} total prompts`,
              },
              {
                  label: 'Avg score (when mentioned)',
                  value: stats.avgScore,
                  caption: `out of 100`,
              },
          ]
        : [
              { label: 'Total calls', value: stats.total, caption: 'AI questions sent' },
              { label: 'Mentioned', value: stats.mentioned, caption: 'answers naming you' },
              { label: 'Mention rate', value: `${stats.mentionRate}%`, caption: 'of total answers' },
              { label: 'Avg score', value: stats.avgScore, caption: 'out of 100' },
          ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
            className="glass rounded-[var(--radius-card)] p-6 w-full space-y-5"
        >
            <SectionIntro>
                <b>What this is:</b> Every row is one question we asked an AI engine. <b>Mentioned</b> = the engine actually named your brand in its reply. <b>Position</b> = where you appeared in its list (1 = first). <b>Score</b> = how visibly you were mentioned (out of 100).
            </SectionIntro>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {statRows.map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        whileHover={{ y: -2 }}
                        className="relative rounded-2xl border border-white/80 bg-white p-4 text-center overflow-hidden shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
                    >
                        <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${STAT_COLORS[s.label]}`} />
                        <div className="text-[26px] font-bold tracking-tight leading-none mt-1">
                            <span className={`bg-gradient-to-br ${STAT_COLORS[s.label]} bg-clip-text text-transparent`}>{s.value}</span>
                        </div>
                        <div className="text-[12px] text-slate-800 font-bold mt-2 flex items-center justify-center gap-1">
                            {s.label}
                            <Hint text={STAT_TIPS[s.label] ?? ''} />
                        </div>
                        {s.caption && (
                            <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                                {s.caption}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            <div className="overflow-x-auto -mx-2 px-2 rounded-xl">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="text-left text-[10px] uppercase tracking-[0.14em] text-slate-500 font-bold pb-3 pr-4">Engine</th>
                            <th className="text-left text-[10px] uppercase tracking-[0.14em] text-slate-500 font-bold pb-3 pr-4">Prompt</th>
                            <th className="text-center text-[10px] uppercase tracking-[0.14em] text-slate-500 font-bold pb-3 pr-4">Mentioned</th>
                            <th className="text-center text-[10px] uppercase tracking-[0.14em] text-slate-500 font-bold pb-3 pr-4">Pos</th>
                            <th className="text-center text-[10px] uppercase tracking-[0.14em] text-slate-500 font-bold pb-3 pr-4">Sentiment</th>
                            <th className="text-center text-[10px] uppercase tracking-[0.14em] text-slate-500 font-bold pb-3">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r, idx) => (
                            <motion.tr
                                key={r.id}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.24, delay: idx * 0.025 }}
                                className="border-b border-slate-100 hover:bg-white/60 transition-colors"
                            >
                                <td className="py-3 pr-4">
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${ENGINE_PILL[r.engine] ?? 'text-slate-700 bg-slate-100'}`}>
                                        {ENGINE_LABEL[r.engine] ?? r.engine}
                                    </span>
                                </td>
                                <td className="py-3 pr-4 text-slate-700 max-w-xs truncate" title={r.prompt}>
                                    {r.prompt}
                                </td>
                                <td className="py-3 pr-4 text-center">
                                    {r.mentioned
                                        ? <motion.span
                                              initial={{ scale: 0 }}
                                              animate={{ scale: 1 }}
                                              transition={{ type: 'spring', stiffness: 300, delay: idx * 0.025 + 0.1 }}
                                              className="inline-flex w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 items-center justify-center shadow-[0_4px_10px_-2px_rgba(16,185,129,0.5)]"
                                          >
                                              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                          </motion.span>
                                        : <span className="inline-flex w-7 h-7 rounded-full bg-slate-100 items-center justify-center">
                                              <Minus className="w-3.5 h-3.5 text-slate-400" />
                                          </span>
                                    }
                                </td>
                                <td className="py-3 pr-4 text-center text-slate-600 font-semibold tabular-nums">
                                    {r.position ?? <span className="text-slate-300">–</span>}
                                </td>
                                <td className="py-3 pr-4 text-center">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ring-1 ${SENTIMENT_COLOR[r.sentiment]}`}>
                                        {r.sentiment}
                                    </span>
                                </td>
                                <td className="py-3 text-center">
                                    <ScoreBar value={r.visibilityScore} />
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
}

function ScoreBar({ value }: { value: number }) {
    const pct = Math.max(0, Math.min(100, value));
    const color =
        pct >= 70 ? 'from-emerald-400 to-teal-500' :
        pct >= 40 ? 'from-amber-400 to-orange-500' :
                    'from-rose-400 to-pink-500';
    return (
        <div className="inline-flex items-center gap-2 min-w-[80px]">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                    className={`h-full bg-gradient-to-r ${color} rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
            </div>
            <span className="text-xs font-bold text-slate-700 tabular-nums w-6 text-right">{value}</span>
        </div>
    );
}
