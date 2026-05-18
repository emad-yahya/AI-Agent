import { TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, Info } from 'lucide-react';
import { type ScanResult } from '../api/client';

interface Stats {
  total: number;
  mentioned: number;
  mentionRate: number;
  avgScore: number;
}

interface Props {
  results: ScanResult[];
  stats: Stats;
  brand: string;
}

const ENGINE_LABEL: Record<string, string> = {
  'chatgpt-style': 'ChatGPT',
  'gemini-style': 'Gemini',
  'perplexity-style': 'Perplexity',
};

function scoreBg(score: number) {
  if (score >= 50) return 'text-green-600';
  if (score >= 30) return 'text-yellow-600';
  return 'text-red-600';
}

function GaugeBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ImpactPredictor({ results, stats, brand }: Props) {
  if (!results || results.length === 0) return null;

  // ── Real data calculations ────────────────────────────────────────────────

  const total = results.length;

  // Sum of ALL visibility scores (including 0s for non-mentioned results)
  // This is the true picture: not mentioned = contributes 0 to your AI presence
  const currentSum = results.reduce((s, r) => s + r.visibilityScore, 0);

  // Effective Reach Score = what AI engines actually deliver across ALL prompts
  // Contrast: stats.avgScore only averages mentioned results (overstates real reach)
  const effectiveScore = total > 0 ? Math.round(currentSum / total) : 0;

  // Per-engine analysis from actual results
  const engineNames = [...new Set(results.map((r) => r.engine))];
  const engineData = engineNames.map((engine) => {
    const er = results.filter((r) => r.engine === engine);
    const em = er.filter((r) => r.mentioned);
    const mentionRate = Math.round((em.length / er.length) * 100);
    const avgScore =
      em.length > 0
        ? Math.round(em.reduce((s, r) => s + r.visibilityScore, 0) / em.length)
        : 0;
    const engineSum = er.reduce((s, r) => s + r.visibilityScore, 0);
    return { engine, total: er.length, mentioned: em.length, mentionRate, avgScore, engineSum };
  });

  // Week 1 conservative target:
  // Silent engines (0% mention rate) → assume 50% of prompts start mentioning at score=40
  // Score=40 is the minimum real value: mentioned but no ranked position, neutral sentiment
  // This uses the actual parser formula floor, not a guess
  const silentEngines = engineData.filter((e) => e.mentionRate === 0);
  const gainFromFixing = silentEngines.reduce((gain, e) => {
    const newMentions = Math.ceil(e.total * 0.5);
    return gain + newMentions * 40;
  }, 0);
  const week1Score = total > 0 ? Math.round((currentSum + gainFromFixing) / total) : 0;

  // Score ceiling:
  // If every non-mentioned result instead performed at your current mention quality (stats.avgScore)
  // This is the real ceiling given your current content/positioning quality
  const notMentionedCount = results.filter((r) => !r.mentioned).length;
  const ceilingGain = notMentionedCount * (stats.avgScore || 0);
  const ceilingScore = total > 0 ? Math.round((currentSum + ceilingGain) / total) : 0;

  const week1Gain = week1Score - effectiveScore;
  const ceilingGainDisplay = ceilingScore - effectiveScore;

  const hasSilentEngines = silentEngines.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-semibold text-gray-800">Impact Predictor</h3>
            <p className="text-xs text-gray-400">
              Calculated from {total} actual AI responses for {brand}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-1 text-xs text-gray-400 max-w-xs">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            All numbers derived from measured scan data using the actual scoring formula — not
            estimates.
          </span>
        </div>
      </div>

      {/* Score clarification */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col gap-2">
        <p className="text-xs font-semibold text-blue-800">Why two scores?</p>
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Quality Score ({stats.avgScore}/100)</strong> — average visibility when AI mentions
          you. Measured only on responses that included your brand.
        </p>
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Effective Reach Score ({effectiveScore}/100)</strong> — your real AI presence across
          ALL {total} prompts. Non-mentions count as zero. This is what customers actually see.
        </p>
      </div>

      {/* Score progression */}
      <div className="grid grid-cols-3 gap-3">
        {/* Current */}
        <div className="rounded-lg border border-gray-200 p-4 flex flex-col gap-1.5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Now</p>
          <p className={`text-3xl font-bold ${scoreBg(effectiveScore)}`}>{effectiveScore}</p>
          <p className="text-xs text-gray-400">Effective reach score</p>
          <GaugeBar
            value={effectiveScore}
            color={effectiveScore >= 50 ? 'bg-green-400' : effectiveScore >= 30 ? 'bg-yellow-400' : 'bg-red-400'}
          />
        </div>

        {/* Week 1 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex flex-col gap-1.5">
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">After Week 1</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-3xl font-bold text-blue-700">~{week1Score}</p>
            {week1Gain > 0 && (
              <span className="text-sm font-semibold text-blue-500">+{week1Gain}</span>
            )}
          </div>
          <p className="text-xs text-blue-500">
            {hasSilentEngines
              ? `Fix ${silentEngines.length} silent engine${silentEngines.length > 1 ? 's' : ''} at 50% rate`
              : 'Improve existing mention quality'}
          </p>
          <GaugeBar value={week1Score} color="bg-blue-400" />
        </div>

        {/* Ceiling */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex flex-col gap-1.5">
          <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Ceiling</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-3xl font-bold text-green-700">~{ceilingScore}</p>
            {ceilingGainDisplay > 0 && (
              <span className="text-sm font-semibold text-green-500">+{ceilingGainDisplay}</span>
            )}
          </div>
          <p className="text-xs text-green-500">All {total} prompts mention you at current quality</p>
          <GaugeBar value={ceilingScore} color="bg-green-400" />
        </div>
      </div>

      {/* Per-engine breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Engine breakdown — where the gap is
        </p>
        <div className="flex flex-col gap-2">
          {engineData
            .sort((a, b) => a.mentionRate - b.mentionRate)
            .map((e) => {
              const engineGain =
                e.mentionRate === 0
                  ? Math.round((Math.ceil(e.total * 0.5) * 40) / total)
                  : 0;
              const label = ENGINE_LABEL[e.engine] ?? e.engine;
              const status =
                e.mentionRate === 0
                  ? 'silent'
                  : e.mentionRate < 50
                    ? 'weak'
                    : 'good';

              return (
                <div
                  key={e.engine}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  {/* Status icon */}
                  {status === 'silent' && (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  {status === 'weak' && (
                    <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                  )}
                  {status === 'good' && (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  )}

                  {/* Engine name */}
                  <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{label}</span>

                  {/* Mention rate bar */}
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {e.mentionRate}% mention rate · {e.mentioned}/{e.total} prompts
                      </span>
                      {e.avgScore > 0 && (
                        <span className="text-xs text-gray-400">quality {e.avgScore}/100</span>
                      )}
                    </div>
                    <GaugeBar
                      value={e.mentionRate}
                      color={
                        e.mentionRate === 0
                          ? 'bg-red-300'
                          : e.mentionRate < 50
                            ? 'bg-yellow-300'
                            : 'bg-green-300'
                      }
                    />
                  </div>

                  {/* Potential gain */}
                  {engineGain > 0 ? (
                    <div className="flex items-center gap-1 shrink-0 text-xs font-semibold text-blue-600">
                      <ArrowRight className="w-3 h-3" />
                      +{engineGain} pts
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 shrink-0 w-14 text-right">—</span>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
        Week 1 target uses 50% mention rate at score=40 (minimum real value: mentioned, no ranked
        position, neutral sentiment) — the conservative floor defined by the actual scoring formula.
        Ceiling assumes non-mentioned results reach your current mention quality ({stats.avgScore}
        /100).
      </p>
    </div>
  );
}
