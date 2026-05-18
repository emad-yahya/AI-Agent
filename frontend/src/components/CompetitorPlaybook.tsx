import { useState } from 'react';
import type { CompetitorPlaybookEntry } from '../api/client';
import {
  Swords,
  ChevronDown,
  ChevronUp,
  Zap,
  Lightbulb,
  Target,
  TrendingUp,
} from 'lucide-react';

interface Props {
  playbook: CompetitorPlaybookEntry[];
  brand: string;
}

export function CompetitorPlaybook({ playbook, brand }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  if (!playbook || playbook.length === 0) return null;

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-red-50 rounded-lg">
          <Swords className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-800">
            Competitor Playbook
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Why these brands beat {brand} in AI results — and how to outrank them
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {playbook.map((entry, i) => {
          const isOpen = expanded.has(i);
          return (
            <div
              key={`${entry.competitor}-${i}`}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center text-xs font-bold text-red-700">
                    {i + 1}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-800">
                      {entry.competitor}
                    </div>
                    {entry.mentionFrequency > 0 && (
                      <div className="text-xs text-gray-400">
                        Mentioned {entry.mentionFrequency} time
                        {entry.mentionFrequency !== 1 ? 's' : ''} across this scan
                      </div>
                    )}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3 bg-gray-50/40">
                  <Section
                    icon={<Lightbulb className="w-4 h-4 text-amber-500" />}
                    label="Why AI knows them"
                    text={entry.whyNotable}
                  />
                  <Section
                    icon={<Target className="w-4 h-4 text-blue-500" />}
                    label="Their visibility strategy"
                    text={entry.strategy}
                  />
                  <Section
                    icon={<TrendingUp className="w-4 h-4 text-green-500" />}
                    label={`How ${brand} can replicate (30–90 days)`}
                    text={entry.howToReplicate}
                  />
                  {entry.quickWins && entry.quickWins.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Zap className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-medium text-amber-900 uppercase tracking-wide">
                          Quick wins (do this week)
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {entry.quickWins.map((qw, j) => (
                          <li key={j} className="text-sm text-amber-900 flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">→</span>
                            <span>{qw}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({
  icon,
  label,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed pl-6">{text}</p>
    </div>
  );
}
