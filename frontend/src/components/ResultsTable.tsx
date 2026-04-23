import type { ScanResult } from "../api/client";
import { Check, Minus } from 'lucide-react';


interface Props {
    results: ScanResult[];
    stats: {
        total: number;
        mentioned: number;
        mentionRate: number;
        avgScore: number;
    };
}

const ENGINE_LABEL: Record<string, string> = {
    'chatgpt-style': 'ChatGPT',
    'gemini-style': 'Gemini',
    'perplexity-style': 'Perplexity',
};

const SENTIMENT_COLOR: Record<string, string> = {
    positive: 'text-green-600 bg-green-50',
    neutral: 'text-gray-500 bg-gray-100',
    negative: 'text-red-600 bg-red-50',
}

export function ResultTable({ results, stats }: Props) {
    if (!results || !stats) return null;
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 w-full">

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total calls', value: stats.total },
                    { label: 'Mentioned', value: stats.mentioned },
                    { label: 'Mention rate', value: `${stats.mentionRate}%` },
                    { label: 'Avg score', value: stats.avgScore },
                ].map(s => (
                    <div key={s.label} className="text-center">
                        <div className="text-2xl font-semibold text-gray-800">{s.value}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Results table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-4">Engine</th>
                            <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-4">Prompt</th>
                            <th className="text-center text-xs text-gray-400 font-medium pb-2 pr-4">Mentioned</th>
                            <th className="text-center text-xs text-gray-400 font-medium pb-2 pr-4">Position</th>
                            <th className="text-center text-xs text-gray-400 font-medium pb-2 pr-4">Sentiment</th>
                            <th className="text-center text-xs text-gray-400 font-medium pb-2">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map(r => (
                            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-2.5 pr-4">
                                    <span className="text-xs font-medium text-blue-600 bg-blue-50
                                   px-2 py-0.5 rounded-full">
                                        {ENGINE_LABEL[r.engine] ?? r.engine}
                                    </span>
                                </td>
                                <td className="py-2.5 pr-4 text-gray-600 max-w-xs truncate">
                                    {r.prompt}
                                </td>
                                <td className="py-2.5 pr-4 text-center">
                                    {r.mentioned
                                        ? <Check className="w-4 h-4 text-green-500 mx-auto" />
                                        : <Minus className="w-4 h-4 text-gray-300 mx-auto" />
                                    }
                                </td>
                                <td className="py-2.5 pr-4 text-center text-gray-500">
                                    {r.position ?? '–'}
                                </td>
                                <td className="py-2.5 pr-4 text-center">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                   ${SENTIMENT_COLOR[r.sentiment]}`}>
                                        {r.sentiment}
                                    </span>
                                </td>
                                <td className="py-2.5 text-center font-semibold text-gray-700">
                                    {r.visibilityScore}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}