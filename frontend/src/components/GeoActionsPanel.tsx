import {
  Bot,
  ChevronDown,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileCode,
  FileText,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  api,
  type ActionCompletionState,
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
  presence: <Sparkles className="w-3.5 h-3.5" />,
  content: <FileText className="w-3.5 h-3.5" />,
};

export function GeoActionsPanel({ brand, onActionsLoaded }: Props) {
  const [report, setReport] = useState<GeoActionsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [completions, setCompletions] = useState<Record<string, ActionCompletionState>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, comps] = await Promise.all([
        api.getGeoActions(brand),
        api.listActionCompletions(brand).catch(() => ({} as Record<string, ActionCompletionState>)),
      ]);
      setReport(data);
      setCompletions(comps);
      onActionsLoaded?.(data.actions?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actions');
      onActionsLoaded?.(0);
    } finally {
      setLoading(false);
    }
  };

  const toggleCompletion = async (actionId: string) => {
    const current = !!completions[actionId]?.completed;
    setCompletions((prev) => ({
      ...prev,
      [actionId]: { completed: !current, updatedAt: new Date().toISOString() },
    }));
    try {
      await api.setActionCompletion(brand, actionId, !current);
    } catch {
      // revert on failure
      setCompletions((prev) => ({
        ...prev,
        [actionId]: { completed: current, updatedAt: prev[actionId]?.updatedAt ?? '' },
      }));
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
                    completed={!!completions[action.id]?.completed}
                    onToggle={() => toggle(action.id)}
                    onToggleCompletion={() => toggleCompletion(action.id)}
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

function CodeBlockCard({
  label,
  language,
  content,
}: {
  label: string;
  language: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — older browsers without clipboard API
    }
  };
  return (
    <div className="rounded-md border border-slate-300 bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-300">
          {label} <span className="text-slate-500 font-normal normal-case">· {language}</span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="px-3 py-2 text-[11px] text-slate-100 overflow-x-auto font-mono leading-snug max-h-96">
        <code>{content}</code>
      </pre>
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
  completed,
  onToggle,
  onToggleCompletion,
}: {
  action: GeoAction;
  expanded: boolean;
  completed: boolean;
  onToggle: () => void;
  onToggleCompletion: () => void;
}) {
  const style = PRIORITY_STYLES[action.priority];
  return (
    <div className={`border rounded-lg overflow-hidden ${completed ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
      <div className="flex">
        <button
          type="button"
          onClick={onToggleCompletion}
          title={completed ? 'Mark not done' : 'Mark complete'}
          className={`flex-shrink-0 w-10 flex items-center justify-center border-r ${completed ? 'bg-emerald-100 border-emerald-200 hover:bg-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
        >
          {completed ? (
            <Check className="w-4 h-4 text-emerald-700" />
          ) : (
            <span className="w-4 h-4 rounded border-2 border-slate-300" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 px-3 py-2.5 flex items-start gap-3 text-left hover:bg-slate-50/60"
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
            {completed && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">
                Done
              </span>
            )}
          </div>
          <p className={`text-sm font-semibold mt-1 ${completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{action.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{action.description}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50/40 px-3 py-3 space-y-3">
          {action.playbook?.why && (
            <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-blue-700 mb-1 inline-flex items-center gap-1">
                <Info className="w-3 h-3" /> Why this matters
              </div>
              <p className="text-xs text-blue-900 leading-relaxed">{action.playbook.why}</p>
            </div>
          )}

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

          {action.playbook?.codeBlocks?.map((cb, i) => (
            <CodeBlockCard key={i} label={cb.label} language={cb.language} content={cb.content} />
          ))}

          {action.playbook?.verifySteps && action.playbook.verifySteps.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-1.5 inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> How to verify it worked
              </div>
              <ol className="space-y-1 list-decimal list-inside text-xs text-slate-700">
                {action.playbook.verifySteps.map((s, i) => (
                  <li key={i} className="leading-relaxed">{s}</li>
                ))}
              </ol>
            </div>
          )}

          {action.playbook?.timeline && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-0.5 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> Expected timeline
              </div>
              <p className="text-xs text-amber-900">{action.playbook.timeline}</p>
            </div>
          )}

          {action.playbook?.pitfalls && action.playbook.pitfalls.length > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-rose-700 mb-1 inline-flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Common pitfalls
              </div>
              <ul className="space-y-1 list-disc list-inside text-xs text-rose-900">
                {action.playbook.pitfalls.map((p, i) => (
                  <li key={i} className="leading-relaxed">{p}</li>
                ))}
              </ul>
            </div>
          )}

          {action.playbook?.resources && action.playbook.resources.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
                Resources
              </div>
              <ul className="space-y-0.5">
                {action.playbook.resources.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                    >
                      {r.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
