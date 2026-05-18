import { Hash } from 'lucide-react';
import type { ScanResult } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  results: ScanResult[];
}

export function TopicsPanel({ results }: Props) {
  const freq: Record<string, number> = {};
  for (const r of results) {
    for (const topic of r.topics ?? []) {
      freq[topic] = (freq[topic] ?? 0) + 1;
    }
  }

  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  if (sorted.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <SectionIntro>
        Real names and concepts the AI engines kept bringing up in the answers about your category. Darker color = mentioned more often. Most of these are your <b>competitors</b>. Use them to see who you're up against.
      </SectionIntro>
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Hash className="w-4 h-4 text-purple-500" />
        Topics AI Associates with Your Brand
        <span className="text-xs text-gray-400 font-normal">
          — extracted from AI responses
        </span>
      </h3>

      <div className="flex flex-wrap gap-2">
        {sorted.map(([topic, count]) => {
          const weight = count >= 3 ? 'bg-purple-100 text-purple-700 border-purple-200'
            : count === 2 ? 'bg-blue-50 text-blue-600 border-blue-100'
            : 'bg-gray-50 text-gray-500 border-gray-100';
          return (
            <span
              key={topic}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${weight}`}
            >
              {topic}
              {count > 1 && (
                <span className="opacity-60">×{count}</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
