import {
  Bot,
  ChevronDown,
  ExternalLink,
  FileCode,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Target,
  Zap,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  api,
  type GeoAction,
  type GeoActionCategory,
  type GeoActionPriority,
  type GeoActionsReport,
} from '../api/client';
import { SectionIntro } from './Hint';

interface Props {
  brand: string;
  onActionsLoaded?: (count: number) => void;
}

const PRIORITY_STYLES: Record<GeoActionPriority, { ring: string; chip: string }> = {
  critical: { ring: 'ring-rose-300', chip: 'bg-rose-500 text-white' },
  high: { ring: 'ring-orange-300', chip: 'bg-orange-500 text-white' },
  medium: { ring: 'ring-amber-200', chip: 'bg-amber-100 text-amber-800' },
  low: { ring: 'ring-slate-200', chip: 'bg-slate-100 text-slate-600' },
};

const CATEGORY_ICONS: Record<GeoActionCategory, ReactNode> = {
  schema: <FileCode className="w-3.5 h-3.5" />,
  'crawler-access': <Bot className="w-3.5 h-3.5" />,
  citation: <Link2 className="w-3.5 h-3.5" />,
  listicle: <Target className="w-3.5 h-3.5" />,
  'engine-weakness': <Zap className="w-3.5 h-3.5" />,
  content: <FileText className="w-3.5 h-3.5" />,
};

export function GeoActionsPanel({ brand, onActionsLoaded }: Props) {
  const [report, setReport] = useState<GeoActionsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getGeoActions(brand);
      setReport(data);
      onActionsLoaded?.(data.actions?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actions');
      onActionsLoaded?.(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <SectionIntro>
        Every action below is generated from <b>real data</b> — competitor audit
        gaps, AI citation analysis, and articles that mention your competitors
        but not you. No LLM guesswork. Each card links to the exact scan and
        evidence behind the recommendation.
      </SectionIntro>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-600" />
          Data-Driven GEO Actions
          <span className="text-xs text-gray-400 font-normal">
            — synthesized from your Citations + Listicle Gap + Audit scans
          </span>
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {report && (
        <>
          <SourcesStrip sources={report.sources} />
          {report.actions.length === 0 ? (
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3">
              No actions surfaced yet. Run a Competitor Audit and a Listicle Gap scan first — those produce the data this panel synthesizes.
            </div>
          ) : (
            <>
              <PrioritySummary summary={report.summary} />
              <div className="space-y-2">
                {report.actions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    expanded={expandedIds.has(action.id)}
                    onToggle={() => toggle(action.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SourcesStrip({ sources }: { sources: GeoActionsReport['sources'] }) {
  const items: Array<{ label: string; ok: boolean }> = [
    { label: 'AI scan', ok: sources.hasAiScan },
    { label: 'Listicle gap', ok: sources.hasListicleGap },
    { label: 'Competitor audit', ok: sources.hasCompetitorAudit },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px]">
      <span className="text-slate-500 font-semibold uppercase tracking-wider">
        Data sources:
      </span>
      {items.map((it) => (
        <span
          key={it.label}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border ${
            it.ok
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${it.ok ? 'bg-emerald-500' : 'bg-slate-300'}`}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function PrioritySummary({ summary }: { summary: GeoActionsReport['summary'] }) {
  const entries: Array<[GeoActionPriority, string]> = [
    ['critical', 'Critical'],
    ['high', 'High'],
    ['medium', 'Medium'],
    ['low', 'Low'],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {entries.map(([key, label]) => {
        const count = summary.byPriority[key] ?? 0;
        const style = PRIORITY_STYLES[key];
        return (
          <div
            key={key}
            className={`rounded-lg border border-slate-200 px-3 py-2 ${count > 0 ? style.ring + ' ring-1' : ''}`}
          >
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              {label}
            </div>
            <div className="text-lg font-bold text-slate-800 mt-0.5">{count}</div>
          </div>
        );
      })}
    </div>
  );
}

function ActionCard({
  action,
  expanded,
  onToggle,
}: {
  action: GeoAction;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = PRIORITY_STYLES[action.priority];
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-start gap-3 text-left hover:bg-slate-50/60"
      >
        <span
          className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded ${style.chip}`}
          title={`${action.priority} priority`}
        >
          {CATEGORY_ICONS[action.category]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${style.chip}`}
            >
              {action.priority}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {action.category} · {action.effort}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-1">{action.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{action.description}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50/40 px-3 py-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
              Steps
            </div>
            <ol className="space-y-1 list-decimal list-inside text-xs text-slate-700">
              {action.steps.map((s, i) => (
                <li key={i} className="leading-relaxed">{s}</li>
              ))}
            </ol>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
              Expected impact
            </div>
            <p className="text-xs text-slate-700">{action.expectedImpact}</p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
              Evidence ({action.evidence.scanType ?? action.evidence.type})
            </div>
            {action.evidence.detail && (
              <p className="text-xs text-slate-600 italic mb-1.5">{action.evidence.detail}</p>
            )}
            {action.evidence.urls && action.evidence.urls.length > 0 && (
              <ul className="space-y-1">
                {action.evidence.urls.map((u) => (
                  <li key={u}>
                    <a
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                    >
                      {u}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {action.evidence.values && (
              <div className="text-[11px] text-slate-500 mt-1.5">
                {Object.entries(action.evidence.values).map(([k, v]) => (
                  <span key={k} className="inline-block mr-3">
                    <span className="font-semibold">{k}:</span> {String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
