import { useEffect, useState } from 'react';
import { Map, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { api, type PromptCoverageResponse } from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
}

const ENGINE_LABEL: Record<string, string> = {
  'chatgpt-style': 'ChatGPT',
  'gemini-style': 'Gemini',
  'perplexity-style': 'Perplexity',
};

const ENGINE_COLOR: Record<string, string> = {
  'chatgpt-style': '#10a37f',
  'gemini-style': '#4285f4',
  'perplexity-style': '#6366f1',
};

const ENGINES = ['chatgpt-style', 'gemini-style', 'perplexity-style'];

function CoverageCell({ value }: { value: boolean | null }) {
  if (value === null) {
    return <MinusCircle className="w-5 h-5 text-gray-300 mx-auto" />;
  }
  if (value) {
    return <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />;
  }
  return <XCircle className="w-5 h-5 text-red-400 mx-auto" />;
}

export function PromptCoverageMap({ brand }: Props) {
  const [data, setData] = useState<PromptCoverageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brand) return;
    setLoading(true);
    setError(null);
    api.getPromptCoverage(brand)
      .then(setData)
      .catch(() => setError('Failed to load coverage. Run a scan first.'))
      .finally(() => setLoading(false));
  }, [brand]);

  const mentionedCount = data?.coverage.reduce(
    (sum, row) => sum + ENGINES.filter((e) => row.byEngine[e] === true).length,
    0,
  ) ?? 0;
  const totalCells = (data?.coverage.length ?? 0) * ENGINES.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <SectionIntro>
        We asked each AI engine 5 different <b>types</b> of questions. This grid shows where {brand} got mentioned. <b>Green ✓</b> = mentioned. <b>Red ✗</b> = AI answered but didn't name you. <b>Gray —</b> = no data for this combo. Goal: fill the grid with green ✓.
      </SectionIntro>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <Map className="w-4 h-4 text-emerald-500" />
            Prompt Coverage Map
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Which question types mention {brand} per engine
          </p>
        </div>
        {data && totalCells > 0 && (
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
            {mentionedCount}/{totalCells} covered
          </span>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-400 text-center py-8">Loading coverage...</p>
      )}

      {error && (
        <p className="text-xs text-red-500 text-center py-8">{error}</p>
      )}

      {data && data.coverage.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pb-3 text-gray-400 font-medium pr-4">Prompt Intent</th>
                {ENGINES.map((engine) => (
                  <th
                    key={engine}
                    className="pb-3 text-center font-medium"
                    style={{ color: ENGINE_COLOR[engine] }}
                  >
                    {ENGINE_LABEL[engine]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.coverage.map((row) => {
                const coveredCount = ENGINES.filter((e) => row.byEngine[e] === true).length;
                return (
                  <tr key={row.intent} className="border-t border-gray-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            coveredCount === ENGINES.length
                              ? 'bg-emerald-500'
                              : coveredCount > 0
                              ? 'bg-amber-400'
                              : 'bg-red-400'
                          }`}
                        />
                        <span className="text-gray-700 font-medium">{row.label}</span>
                      </div>
                    </td>
                    {ENGINES.map((engine) => (
                      <td key={engine} className="py-3 text-center">
                        <CoverageCell value={row.byEngine[engine] ?? null} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Mentioned
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <XCircle className="w-3.5 h-3.5 text-red-400" /> Not mentioned
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <MinusCircle className="w-3.5 h-3.5 text-gray-300" /> No data
            </span>
          </div>
        </div>
      )}

      {data && data.coverage.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-8">
          No scan data found for {brand}. Run a scan first.
        </p>
      )}
    </div>
  );
}
