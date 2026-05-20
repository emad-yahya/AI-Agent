import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Key,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { api, type IntegrationCheck, type SystemHealthResponse } from '../api/client';
import { SectionIntro } from './Hint';

const STATUS_STYLE: Record<
  IntegrationCheck['status'],
  { label: string; chip: string; icon: ReactNode }
> = {
  ok: {
    label: 'Connected',
    chip: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  missing: {
    label: 'Not configured',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <Key className="w-3.5 h-3.5" />,
  },
  invalid: {
    label: 'Key rejected',
    chip: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  rate_limited: {
    label: 'Rate-limited',
    chip: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  unknown: {
    label: 'Unknown',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
};

export function SystemHealthPanel() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSystemHealth();
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-slate-700" size={20} />
          <h3 className="font-bold text-slate-900">System Health · Integrations</h3>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Re-check
        </button>
      </div>
      <SectionIntro>
        Tests every external API the system depends on. <b>Required</b> keys must be green for full
        functionality. Click any row to see setup steps.
      </SectionIntro>

      {error && (
        <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {data && (
        <>
          {!data.coreOk && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <p className="font-semibold mb-0.5 inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Required integrations missing
              </p>
              <p>
                Some required keys are not configured. Features that depend on them will return
                empty data or fall back to lower-quality providers. Set the missing keys in your
                Railway environment variables and redeploy.
              </p>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {data.checks.map((c) => {
              const style = STATUS_STYLE[c.status];
              const isOpen = expanded.has(c.key);
              return (
                <div key={c.key} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-slate-50/60"
                  >
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.chip}`}
                    >
                      {style.icon} {style.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        <code className="font-mono">{c.envVar}</code>
                        {c.message && (
                          <span className="ml-2 text-slate-400">· {c.message}</span>
                        )}
                      </p>
                    </div>
                    {c.required && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                        Required
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-200 bg-slate-50/40 px-3 py-3 space-y-2">
                      <p className="text-xs text-slate-700">{c.description}</p>
                      {c.cost && (
                        <p className="text-[11px] text-slate-500">
                          <span className="font-semibold">Cost:</span> {c.cost}
                        </p>
                      )}
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
                          Setup steps
                        </div>
                        <ol className="space-y-0.5 list-decimal list-inside text-xs text-slate-700">
                          {c.setupSteps.map((s, i) => (
                            <li key={i} className="leading-relaxed">{s}</li>
                          ))}
                        </ol>
                      </div>
                      <a
                        href={c.setupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                      >
                        Open setup page <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
