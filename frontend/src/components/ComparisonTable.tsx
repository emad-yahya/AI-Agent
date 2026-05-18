import { type BrandComparisonResult } from '../api/client';

interface Props {
    results: BrandComparisonResult[];
}

const ENGINE_LABELS: Record<string, string> = {
    'chatgpt-style': 'ChatGPT-style',
    'gemini-style': 'Gemini-style',
    'perplexity-style': 'Perplexity-style',
};

function ScoreBadge({ score }: { score: number }) {
    const color =
        score >= 80
            ? 'bg-green-100 text-green-700'
            : score >= 50
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-600';
    return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
            {score}
        </span>
    );
}

function SentimentBadge({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) {
    const styles = {
        positive: 'text-green-600',
        neutral: 'text-gray-400',
        negative: 'text-red-500',
    };
    return <span className={`text-xs font-medium ${styles[sentiment]}`}>{sentiment}</span>;
}

function MentionBar({ rate }: { rate: number }) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${rate}%` }}
                />
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{rate}%</span>
        </div>
    );
}

export function ComparisonTable({ results }: Props) {
    const allEngines = [
        ...new Set(results.flatMap((r) => Object.keys(r.byEngine))),
    ];

    const winner = results.reduce((best, r) =>
        r.stats.avgScore > best.stats.avgScore ? r : best,
    );

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-medium text-gray-800">Comparison results</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left px-6 py-3 text-gray-400 font-normal w-40">Metric</th>
                            {results.map((r) => (
                                <th
                                    key={r.brand}
                                    className={`px-6 py-3 text-center font-semibold ${
                                        r.brand === winner.brand
                                            ? 'text-blue-600'
                                            : 'text-gray-700'
                                    }`}
                                >
                                    {r.brand}
                                    {r.brand === winner.brand && (
                                        <span className="ml-1.5 text-xs font-normal text-blue-400">
                                            ★ best
                                        </span>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {/* Overall stats */}
                        <tr className="bg-gray-50">
                            <td className="px-6 py-2.5 text-gray-500 text-xs uppercase tracking-wide" colSpan={results.length + 1}>
                                Overall
                            </td>
                        </tr>
                        <tr>
                            <td className="px-6 py-3 text-gray-600">Avg score</td>
                            {results.map((r) => (
                                <td key={r.brand} className="px-6 py-3 text-center">
                                    <ScoreBadge score={r.stats.avgScore} />
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <td className="px-6 py-3 text-gray-600">Mention rate</td>
                            {results.map((r) => (
                                <td key={r.brand} className="px-6 py-3">
                                    <MentionBar rate={r.stats.mentionRate} />
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <td className="px-6 py-3 text-gray-600">AI calls</td>
                            {results.map((r) => (
                                <td key={r.brand} className="px-6 py-3 text-center text-gray-500">
                                    {r.stats.mentioned}/{r.stats.total}
                                </td>
                            ))}
                        </tr>

                        {/* Per-engine breakdown */}
                        {allEngines.length > 0 && (
                            <>
                                <tr className="bg-gray-50">
                                    <td
                                        className="px-6 py-2.5 text-gray-500 text-xs uppercase tracking-wide"
                                        colSpan={results.length + 1}
                                    >
                                        By engine
                                    </td>
                                </tr>
                                {allEngines.map((engine) => (
                                    <tr key={engine}>
                                        <td className="px-6 py-3 text-gray-600">
                                            {ENGINE_LABELS[engine] ?? engine}
                                        </td>
                                        {results.map((r) => {
                                            const stats = r.byEngine[engine];
                                            return (
                                                <td key={r.brand} className="px-6 py-3 text-center">
                                                    {stats ? (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <ScoreBadge score={stats.avgScore} />
                                                            <SentimentBadge sentiment={stats.sentiment} />
                                                            <span className="text-xs text-gray-400">
                                                                {stats.mentionRate}% mentioned
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300">—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
